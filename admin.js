// Set this to your production backend URL (e.g., 'http://localhost:5000') if the frontend is hosted separately.
// Leave it as null if the frontend and backend are served together from the same host.
const PRODUCTION_BACKEND_URL = "https://quick-sheep-eat.loca.lt";

const API_BASE = PRODUCTION_BACKEND_URL 
  ? `${PRODUCTION_BACKEND_URL}/api`
  : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
      ? `${window.location.protocol}//${window.location.hostname}:5000/api`
      : '/api');

// Authentication Wrapper for API Requests
async function adminFetch(url, options = {}) {
  const token = sessionStorage.getItem('adminToken');
  options.headers = options.headers || {};
  options.headers['Authorization'] = token || '';
  
  try {
    const res = await fetch(url, options);
    if (res.status === 401 || res.status === 403) {
      showToast('Session expired or unauthorized. Redirecting to login...', 'error');
      sessionStorage.removeItem('adminToken');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
      throw new Error('Unauthorized');
    }
    return res;
  } catch (err) {
    if (err.message === 'Unauthorized') throw err;
    console.error('Fetch error:', err);
    throw err;
  }
}

// Admin Application State
let adminState = {
  stats: {},
  bookings: [],
  rooms: [],
  roomTypes: [],
  allocations: [],
  payments: [],
  students: [],
  charts: {
    booking: null,
    room: null
  }
};

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Stats Counters
const countBookings = document.getElementById('countBookings');
const countRooms = document.getElementById('countRooms');
const countAllocations = document.getElementById('countAllocations');

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupForms();
  setupSearchAndFilters();
  setupLogout();
  await loadDashboardData();
});

// Toast system
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('active'), 10);
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// Set up Tab Navigation
function setupTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
}

// Set up Logout Controller
function setupLogout() {
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.removeItem('adminToken');
      showToast('Logged out successfully.', 'info');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1000);
    });
  }
}

// Load Core Data
async function loadDashboardData() {
  const loaders = [
    { name: 'Stats', fn: fetchStats },
    { name: 'Room Types', fn: fetchRoomTypes },
    { name: 'Bookings', fn: fetchBookings },
    { name: 'Rooms', fn: fetchRooms },
    { name: 'Allocations', fn: fetchAllocations },
    { name: 'Payments', fn: fetchPayments },
    { name: 'Students', fn: fetchStudents }
  ];

  for (const loader of loaders) {
    try {
      await loader.fn();
    } catch (err) {
      console.warn(`Error loading ${loader.name} component:`, err.message);
    }
  }
}

// 1. Fetch Stats & Populate Dashboard Cards
async function fetchStats() {
  const res = await adminFetch(`${API_BASE}/stats`);
  const json = await res.json();
  if (json.success) {
    adminState.stats = json.stats;
    
    // Update stats cards
    document.getElementById('statRooms').textContent = json.stats.totalRooms;
    document.getElementById('statStudents').textContent = json.stats.totalStudents;
    document.getElementById('statOccupancy').textContent = `${json.stats.occupancyRate}%`;
    document.getElementById('statRevenue').textContent = `GH₵${parseFloat(json.stats.totalRevenue).toFixed(2)}`;

    // Update charts defensively
    try {
      if (typeof Chart !== 'undefined') {
        renderCharts(json.stats);
      } else {
        console.warn('Chart.js is not loaded. Skipping analytics rendering.');
        const chartsContainer = document.getElementById('chartsContainer');
        if (chartsContainer) chartsContainer.style.display = 'none';
      }
    } catch (chartErr) {
      console.error('Error rendering analytics charts:', chartErr);
    }
  }
}

// Render Chart.js Analytics
function renderCharts(stats) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#94a3b8',
          font: { family: 'Plus Jakarta Sans', size: 11 }
        }
      }
    }
  };

  // 1. Booking Status Chart
  const bookingCtx = document.getElementById('bookingChart').getContext('2d');
  const bookingData = {
    labels: ['Pending', 'Paid', 'Confirmed', 'Cancelled', 'Expired'],
    datasets: [{
      data: [
        stats.bookingStats.Pending || 0,
        stats.bookingStats.Paid || 0,
        stats.bookingStats.Confirmed || 0,
        stats.bookingStats.Cancelled || 0,
        stats.bookingStats.Expired || 0
      ],
      backgroundColor: ['#f59e0b', '#10b981', '#6366f1', '#ef4444', '#64748b'],
      borderWidth: 0
    }]
  };

  if (adminState.charts.booking) {
    adminState.charts.booking.data = bookingData;
    adminState.charts.booking.update();
  } else {
    adminState.charts.booking = new Chart(bookingCtx, {
      type: 'doughnut',
      data: bookingData,
      options: {
        ...chartOptions,
        cutout: '70%'
      }
    });
  }

  // 2. Room Status Chart
  const roomCtx = document.getElementById('roomChart').getContext('2d');
  const roomData = {
    labels: ['Available', 'Full', 'Maintenance'],
    datasets: [{
      data: [
        stats.roomStats.Available || 0,
        stats.roomStats.Full || 0,
        stats.roomStats.Maintenance || 0
      ],
      backgroundColor: ['#10b981', '#ef4444', '#0ea5e9'],
      borderWidth: 0
    }]
  };

  if (adminState.charts.room) {
    adminState.charts.room.data = roomData;
    adminState.charts.room.update();
  } else {
    adminState.charts.room = new Chart(roomCtx, {
      type: 'pie',
      data: roomData,
      options: chartOptions
    });
  }
}

// 2. Room Types (Dropdown filler)
async function fetchRoomTypes() {
  const res = await adminFetch(`${API_BASE}/room-types`);
  const json = await res.json();
  if (json.success) {
    adminState.roomTypes = json.data;
    
    const newRoomType = document.getElementById('new_type_id');
    newRoomType.innerHTML = '';
    json.data.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.type_id;
      opt.textContent = `${t.type_name} (Price: GH₵${parseFloat(t.price_per_semester).toFixed(2)})`;
      newRoomType.appendChild(opt);
    });
  }
}

// 3. Fetch Bookings Registry
async function fetchBookings() {
  try {
    const res = await adminFetch(`${API_BASE}/bookings`);
    const json = await res.json();
    if (json.success) {
      adminState.bookings = json.data;
      countBookings.textContent = json.data.length;
      renderBookingsTable();
    }
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    console.error('Error fetching bookings:', error);
    document.getElementById('bookingsTableBody').innerHTML = `
      <tr><td colspan="7" class="empty-state" style="color:var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Error loading bookings registry.</td></tr>
    `;
  }
}

function renderBookingsTable() {
  const query = document.getElementById('bookingSearchInput').value.toLowerCase();
  const status = document.getElementById('bookingStatusFilter').value;
  const tbody = document.getElementById('bookingsTableBody');

  let filtered = adminState.bookings.filter(b => {
    const matchQuery = 
      b.first_name.toLowerCase().includes(query) ||
      b.last_name.toLowerCase().includes(query) ||
      b.student_number.toLowerCase().includes(query) ||
      b.room_number.toLowerCase().includes(query) ||
      b.email.toLowerCase().includes(query);
    
    const matchStatus = status === 'all' || b.booking_status === status;
    return matchQuery && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-folder-open"></i> No bookings match filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(b => {
    const tr = document.createElement('tr');
    const dateStr = new Date(b.booking_date).toLocaleDateString();

    let actionBtnHtml = '';
    if (b.booking_status === 'Pending' || b.booking_status === 'Paid') {
      actionBtnHtml = `
        <button class="btn btn-secondary btn-sm" style="color:var(--success); border-color:rgba(16,185,129,0.2);" onclick="updateBookingStatus(${b.booking_id}, 'Confirmed')">Confirm</button>
        <button class="btn btn-danger btn-sm" style="margin-left:0.25rem;" onclick="updateBookingStatus(${b.booking_id}, 'Cancelled')">Cancel</button>
      `;
    } else if (b.booking_status === 'Confirmed') {
      actionBtnHtml = `
        <button class="btn btn-danger btn-sm" onclick="updateBookingStatus(${b.booking_id}, 'Cancelled')">Revoke</button>
      `;
    } else {
      actionBtnHtml = `<span style="font-size:0.8rem; color:var(--text-dark);">No actions</span>`;
    }

    tr.innerHTML = `
      <td><strong>#BK-${b.booking_id}</strong></td>
      <td>
        <strong>${b.first_name} ${b.last_name}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${b.student_number} • ${b.email}</div>
      </td>
      <td>
        <strong>Room ${b.room_number}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${b.block_name} • ${b.type_name}</div>
      </td>
      <td>${b.academic_year}<br><span style="font-size:0.8rem; color:var(--text-muted);">Sem ${b.semester}</span></td>
      <td>${dateStr}</td>
      <td><span class="status-pill ${b.booking_status.toLowerCase()}">${b.booking_status}</span></td>
      <td style="text-align: right; white-space: nowrap;">${actionBtnHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Action: Update Booking Status
window.updateBookingStatus = async function(id, newStatus) {
  if (!confirm(`Are you sure you want to change booking status to "${newStatus}"?`)) return;

  try {
    const res = await adminFetch(`${API_BASE}/bookings/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      await loadDashboardData(); // Refresh UI
    } else {
      showToast(json.message, 'error');
    }
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    showToast('Failed to update status.', 'error');
  }
};

// 4. Fetch Rooms
async function fetchRooms() {
  const res = await adminFetch(`${API_BASE}/rooms`);
  const json = await res.json();
  if (json.success) {
    adminState.rooms = json.data;
    countRooms.textContent = json.data.length;
    renderRoomsTable();
  }
}

function renderRoomsTable() {
  const block = document.getElementById('roomBlockFilter').value;
  const tbody = document.getElementById('roomsTableBody');

  let filtered = adminState.rooms;
  if (block !== 'all') {
    filtered = filtered.filter(r => r.block_name === block);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-folder-open"></i> No rooms match block filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(r => {
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
      <td><strong>Room ${r.room_number}</strong></td>
      <td>${r.block_name}</td>
      <td>${r.type_name}</td>
      <td>${r.current_occupancy} / ${r.capacity} Occupied</td>
      <td>GH₵${parseFloat(r.price_per_semester).toFixed(2)}</td>
      <td>
        <select onchange="updateRoomStatus(${r.room_id}, this.value)" style="width:auto; padding:0.25rem 0.5rem; font-size:0.8rem; border-radius:4px; background: rgba(9,13,22,0.8);">
          <option value="Available" ${r.status === 'Available' ? 'selected' : ''}>Available</option>
          <option value="Full" ${r.status === 'Full' ? 'selected' : ''}>Full</option>
          <option value="Maintenance" ${r.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
        </select>
      </td>
      <td style="text-align: right;">
        <button class="btn btn-danger btn-sm" onclick="deleteRoom(${r.room_id})"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Action: Update Room Status Dropdown
window.updateRoomStatus = async function(roomId, newStatus) {
  const room = adminState.rooms.find(r => r.room_id === roomId);
  if (!room) return;

  const body = {
    room_number: room.room_number,
    block_name: room.block_name,
    type_id: room.type_id,
    status: newStatus
  };

  try {
    const res = await adminFetch(`${API_BASE}/rooms/${roomId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.success) {
      showToast('Room status updated.', 'success');
      await loadDashboardData();
    } else {
      showToast(json.message || 'Failed to update status', 'error');
    }
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    showToast('Failed to update status', 'error');
  }
};

// Action: Delete Room
window.deleteRoom = async function(id) {
  if (!confirm('Are you sure you want to delete this room? This cannot be undone.')) return;

  try {
    const res = await adminFetch(`${API_BASE}/rooms/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      await loadDashboardData();
    } else {
      showToast(json.message || 'Could not delete room.', 'error');
    }
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    showToast('Network error during room deletion.', 'error');
  }
};

// 5. Fetch Allocations
async function fetchAllocations() {
  const res = await adminFetch(`${API_BASE}/allocations`);
  const json = await res.json();
  if (json.success) {
    adminState.allocations = json.data;
    const activeAllocs = json.data.filter(a => a.is_active === 1);
    countAllocations.textContent = activeAllocs.length;
    renderAllocationsTable();
  }
}

function renderAllocationsTable() {
  const query = document.getElementById('allocationsSearchInput').value.toLowerCase();
  const tbody = document.getElementById('allocationsTableBody');

  let filtered = adminState.allocations.filter(a => {
    return a.is_active === 1 && (
      a.first_name.toLowerCase().includes(query) ||
      a.last_name.toLowerCase().includes(query) ||
      a.student_number.toLowerCase().includes(query) ||
      a.room_number.toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-folder-open"></i> No active allocations found.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(a => {
    const tr = document.createElement('tr');
    const dateStr = new Date(a.allocation_date).toLocaleDateString();

    tr.innerHTML = `
      <td><strong>#AL-${a.allocation_id}</strong></td>
      <td><strong>${a.first_name} ${a.last_name}</strong></td>
      <td>${a.student_number}</td>
      <td><strong>Room ${a.room_number}</strong></td>
      <td>${a.block_name}</td>
      <td>${a.type_name}</td>
      <td>${dateStr}</td>
      <td style="text-align: right;">
        <button class="btn btn-danger btn-sm" onclick="deactivateAllocation(${a.allocation_id})">Deallocate</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Action: Deallocate Student Room allocation
window.deactivateAllocation = async function(id) {
  if (!confirm('Are you sure you want to deallocate this student? They will lose their room spot.')) return;

  try {
    const res = await adminFetch(`${API_BASE}/allocations/deactivate/${id}`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      await loadDashboardData();
    } else {
      showToast(json.message || 'Error deallocating.', 'error');
    }
  } catch (error) {
    if (error.message === 'Unauthorized') return;
    showToast('Failed to connect to allocation service.', 'error');
  }
};

// 6. Fetch Payments
async function fetchPayments() {
  const res = await adminFetch(`${API_BASE}/payments`);
  const json = await res.json();
  if (json.success) {
    adminState.payments = json.data;
    renderPaymentsTable();
  }
}

function renderPaymentsTable() {
  const query = document.getElementById('paymentsSearchInput').value.toLowerCase();
  const tbody = document.getElementById('paymentsTableBody');

  let filtered = adminState.payments.filter(p => {
    return (
      p.first_name.toLowerCase().includes(query) ||
      p.last_name.toLowerCase().includes(query) ||
      p.student_number.toLowerCase().includes(query) ||
      p.transaction_reference.toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><i class="fa-solid fa-folder-open"></i> No payment logs found.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(p => {
    const tr = document.createElement('tr');
    const dateStr = new Date(p.payment_date).toLocaleString();

    tr.innerHTML = `
      <td><strong>#PM-${p.payment_id}</strong></td>
      <td>
        <strong>${p.first_name} ${p.last_name}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">${p.student_number}</div>
      </td>
      <td>${p.transaction_reference}</td>
      <td>#BK-${p.booking_id}</td>
      <td style="color: var(--success); font-weight:700;">GH₵${parseFloat(p.amount_paid).toFixed(2)}</td>
      <td>${p.transaction_reference}</td>
      <td>${p.payment_method}</td>
      <td style="font-size:0.8rem; color:var(--text-muted);">${dateStr}</td>
      <td><span class="status-pill success">${p.payment_status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 7. Fetch Students Directory
async function fetchStudents() {
  const res = await adminFetch(`${API_BASE}/students`);
  const json = await res.json();
  if (json.success) {
    adminState.students = json.data;
    renderStudentsTable();
  }
}

// Render Students
function renderStudentsTable() {
  const query = document.getElementById('studentsSearchInput').value.toLowerCase();
  const tbody = document.getElementById('studentsTableBody');

  let filtered = adminState.students.filter(s => {
    return (
      s.first_name.toLowerCase().includes(query) ||
      s.last_name.toLowerCase().includes(query) ||
      s.student_number.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-folder-open"></i> No student files matched.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#ST-${s.student_id}</td>
      <td><strong>${s.student_number}</strong></td>
      <td>${s.first_name} ${s.last_name}</td>
      <td>${s.email}</td>
      <td>${s.phone_number}</td>
      <td>${s.gender}</td>
      <td>${s.emergency_contact || '<span style="color:var(--text-dark);">None</span>'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- SETUP FORMS SUBMISSIONS ---
function setupForms() {
  const addRoomForm = document.getElementById('addRoomForm');
  addRoomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnSubmit = document.getElementById('btnAddRoom');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    const formData = {
      room_number: document.getElementById('new_room_number').value.trim(),
      block_name: document.getElementById('new_block_name').value,
      type_id: parseInt(document.getElementById('new_type_id').value),
      status: document.getElementById('new_room_status').value
    };

    try {
      const res = await adminFetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      
      if (json.success) {
        showToast(json.message, 'success');
        addRoomForm.reset();
        await loadDashboardData();
      } else {
        showToast(json.message || 'Room creation failed.', 'error');
      }
    } catch (error) {
      if (error.message === 'Unauthorized') return;
      showToast('Error connecting to servers.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Register Room';
    }
  });
}

// --- SETUP SEARCH & FILTERS EVENT LISTENERS ---
function setupSearchAndFilters() {
  // Bookings
  document.getElementById('bookingSearchInput').addEventListener('input', renderBookingsTable);
  document.getElementById('bookingStatusFilter').addEventListener('change', renderBookingsTable);

  // Rooms
  document.getElementById('roomBlockFilter').addEventListener('change', renderRoomsTable);

  // Allocations
  document.getElementById('allocationsSearchInput').addEventListener('input', renderAllocationsTable);

  // Payments
  document.getElementById('paymentsSearchInput').addEventListener('input', renderPaymentsTable);

  // Students
  document.getElementById('studentsSearchInput').addEventListener('input', renderStudentsTable);
}
