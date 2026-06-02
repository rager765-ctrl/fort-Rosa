// Set this to your production backend URL (e.g., 'http://localhost:5000') if the frontend is hosted separately.
// Leave it as null if the frontend and backend are served together from the same host.
const PRODUCTION_BACKEND_URL = "https://quick-sheep-eat.loca.lt";

const API_BASE = PRODUCTION_BACKEND_URL 
  ? `${PRODUCTION_BACKEND_URL}/api`
  : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
      ? `${window.location.protocol}//${window.location.hostname}:5000/api`
      : '/api');

// State Management
let state = {
  rooms: [],
  roomTypes: [],
  selectedRoomId: null,
  currentTab: 'booking' // 'booking' or 'status'
};

// DOM Elements
const navHome = document.getElementById('navHome');
const navCheckStatus = document.getElementById('navCheckStatus');
const bookingView = document.getElementById('bookingView');
const statusView = document.getElementById('statusView');

const blockFilter = document.getElementById('blockFilter');
const typeFilter = document.getElementById('typeFilter');
const roomSelectionGrid = document.getElementById('roomSelectionGrid');
const bookingSummaryDetails = document.getElementById('bookingSummaryDetails');
const btnSubmitBooking = document.getElementById('btnSubmitBooking');

const studentForm = document.getElementById('bookingForm');
const genderSelect = document.getElementById('gender');

// Status check elements
const searchQuery = document.getElementById('searchQuery');
const btnSearchBooking = document.getElementById('btnSearchBooking');
const searchResults = document.getElementById('searchResults');
const searchEmptyState = document.getElementById('searchEmptyState');

// Payment Modal Elements
const paymentModal = document.getElementById('paymentModal');
const btnClosePaymentModal = document.getElementById('btnClosePaymentModal');
const btnCancelPayment = document.getElementById('btnCancelPayment');
const paymentForm = document.getElementById('paymentForm');

const receiptBookingId = document.getElementById('receiptBookingId');
const receiptRoomNo = document.getElementById('receiptRoomNo');
const receiptStudentNo = document.getElementById('receiptStudentNo');
const receiptAmount = document.getElementById('receiptAmount');
const payBookingId = document.getElementById('payBookingId');
const payAmount = document.getElementById('payAmount');

// --- INITIALIZE PORTAL ---
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  await loadRoomTypes();
  await loadRooms();
  setupEventListeners();

  // Handle URL Query parameters for deep linking
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  const typeParam = params.get('type');

  if (tabParam === 'status') {
    switchTab('status');
  }

  if (typeParam) {
    setTimeout(() => {
      window.selectTypeFilter(typeParam);
    }, 500); // Wait for dropdown options to populate
  }
});

// --- TOAST NOTIFICATIONS ---
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
  
  // Trigger transition
  setTimeout(() => toast.classList.add('active'), 10);
  
  // Remove toast
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// --- NAVIGATION ---
function setupNavigation() {
  const handleBookingClick = (e) => {
    e.preventDefault();
    switchTab('booking');
  };
  const handleStatusClick = (e) => {
    e.preventDefault();
    switchTab('status');
  };

  navHome?.addEventListener('click', handleBookingClick);
  navCheckStatus?.addEventListener('click', handleStatusClick);

  const mobileNavHome = document.getElementById('mobileNavHome');
  const mobileNavCheckStatus = document.getElementById('mobileNavCheckStatus');

  mobileNavHome?.addEventListener('click', handleBookingClick);
  mobileNavCheckStatus?.addEventListener('click', handleStatusClick);
}

function switchTab(tab) {
  state.currentTab = tab;
  
  const navHome = document.getElementById('navHome');
  const navCheckStatus = document.getElementById('navCheckStatus');
  const mobileNavHome = document.getElementById('mobileNavHome');
  const mobileNavCheckStatus = document.getElementById('mobileNavCheckStatus');
  const portalHeader = document.getElementById('portalHeader');

  if (tab === 'booking') {
    navHome?.classList.add('active');
    navCheckStatus?.classList.remove('active');
    mobileNavHome?.classList.add('active');
    mobileNavCheckStatus?.classList.remove('active');
    
    if (portalHeader) portalHeader.style.display = '';
    if (bookingView) bookingView.style.display = 'block';
    if (statusView) statusView.style.display = 'none';
  } else {
    navHome?.classList.remove('active');
    navCheckStatus?.classList.add('active');
    mobileNavHome?.classList.remove('active');
    mobileNavCheckStatus?.classList.add('active');
    
    if (portalHeader) portalHeader.style.display = 'none';
    if (bookingView) bookingView.style.display = 'none';
    if (statusView) statusView.style.display = 'block';
  }
}

// --- FETCH DATA ---
async function loadRoomTypes() {
  try {
    const res = await fetch(`${API_BASE}/room-types`);
    const json = await res.json();
    if (json.success) {
      state.roomTypes = json.data;
      
      // Populate type filter
      typeFilter.innerHTML = '<option value="all">All Types</option>';
      json.data.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type.type_id;
        opt.textContent = `${type.type_name} (Max ${type.capacity})`;
        typeFilter.appendChild(opt);
      });
    }
  } catch (error) {
    console.error('Error loading room types:', error);
    showToast('Failed to load room configurations.', 'error');
  }
}

async function loadRooms() {
  try {
    const res = await fetch(`${API_BASE}/rooms`);
    const json = await res.json();
    if (json.success) {
      state.rooms = json.data;
      renderRooms();
    }
  } catch (error) {
    console.error('Error loading rooms:', error);
    roomSelectionGrid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i>
        <p>Could not fetch rooms. Check database connections.</p>
      </div>
    `;
  }
}

// --- RENDER AVAILABLE ROOMS ---
function renderRooms() {
  const blockVal = blockFilter.value;
  const typeVal = typeFilter.value;
  const selectedGender = genderSelect.value;

  // Filter logic
  let filtered = state.rooms;

  // Auto-filter block based on gender (if user chose gender)
  // Let's guide the user: Block A is typically Male, Block B is Female
  if (selectedGender === 'Male') {
    filtered = filtered.filter(r => r.block_name === 'Block A');
  } else if (selectedGender === 'Female') {
    filtered = filtered.filter(r => r.block_name === 'Block B');
  } else {
    // If no gender selected, allow general filters
    if (blockVal !== 'all') {
      filtered = filtered.filter(r => r.block_name === blockVal);
    }
  }

  // Type filter
  if (typeVal !== 'all') {
    filtered = filtered.filter(r => r.type_id == typeVal);
  }

  if (filtered.length === 0) {
    roomSelectionGrid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-bed"></i>
        <p>No matching available rooms found for the selected gender or filters.</p>
      </div>
    `;
    return;
  }

  roomSelectionGrid.innerHTML = '';
  filtered.forEach(room => {
    const card = document.createElement('div');
    
    let occupancyClass = '';
    let statusText = 'Available';
    let isDisabled = false;

    if (room.status === 'Maintenance') {
      occupancyClass = 'maintenance';
      statusText = 'Maintenance';
      isDisabled = true;
    } else if (room.current_occupancy >= room.capacity || room.status === 'Full') {
      occupancyClass = 'full';
      statusText = 'Full';
      isDisabled = true;
    } else if (room.current_occupancy > 0) {
      statusText = `${room.capacity - room.current_occupancy} Bed(s) Free`;
    }

    card.className = `room-card ${occupancyClass} ${state.selectedRoomId === room.room_id ? 'selected' : ''}`;
    
    card.innerHTML = `
      <div class="room-header">
        <span class="room-number">${room.room_number}</span>
        <span class="room-type">${room.type_name}</span>
      </div>
      <div class="room-price">GH₵${parseFloat(room.price_per_semester).toFixed(2)}<span>/sem</span></div>
      <div class="room-details">
        <span class="room-block"><i class="fa-solid fa-building"></i>${room.block_name}</span>
        <span class="room-capacity"><i class="fa-solid fa-users"></i>${room.current_occupancy}/${room.capacity} Occupied</span>
      </div>
      <div style="margin-top: 0.75rem; text-align: right;">
        <span class="status-pill ${statusText.toLowerCase().replace(/[^a-z]/g, '') || 'available'}">${statusText}</span>
      </div>
    `;

    if (!isDisabled) {
      card.addEventListener('click', () => {
        selectRoom(room);
      });
    }

    roomSelectionGrid.appendChild(card);
  });
}

// --- ROOM SELECTION HANDLING ---
function selectRoom(room) {
  state.selectedRoomId = room.room_id;
  
  // Re-render rooms to show new selected border
  const cards = roomSelectionGrid.querySelectorAll('.room-card');
  cards.forEach(c => c.classList.remove('selected'));
  
  // Find card and add class
  renderRooms();

  // Update summary panel
  bookingSummaryDetails.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
        <span style="color: var(--text-muted);">Room Selected:</span>
        <strong style="color: var(--text-primary); font-size: 1.1rem;">Room ${room.room_number}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
        <span style="color: var(--text-muted);">Building Block:</span>
        <strong>${room.block_name}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
        <span style="color: var(--text-muted);">Room Style:</span>
        <span>${room.type_name}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
        <span style="color: var(--text-muted);">Term:</span>
        <span>${document.getElementById('academic_year').value}, Sem ${document.getElementById('semester').value}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 700; margin-top: 0.5rem;">
        <span style="color: var(--primary);">Total Semester Price:</span>
        <span style="color: var(--primary);">GH₵${parseFloat(room.price_per_semester).toFixed(2)}</span>
      </div>
    </div>
  `;
  
  btnSubmitBooking.disabled = false;
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
  blockFilter.addEventListener('change', renderRooms);
  typeFilter.addEventListener('change', renderRooms);
  
  genderSelect.addEventListener('change', () => {
    // Lock or filter blocks appropriately based on gender selection
    if (genderSelect.value === 'Male') {
      blockFilter.value = 'Block A';
      blockFilter.disabled = true;
    } else if (genderSelect.value === 'Female') {
      blockFilter.value = 'Block B';
      blockFilter.disabled = true;
    } else {
      blockFilter.disabled = false;
    }
    renderRooms();
  });

  // Track Academic term changes to update summary
  document.getElementById('academic_year').addEventListener('change', () => {
    if (state.selectedRoomId) {
      const room = state.rooms.find(r => r.room_id === state.selectedRoomId);
      if (room) selectRoom(room);
    }
  });
  document.getElementById('semester').addEventListener('change', () => {
    if (state.selectedRoomId) {
      const room = state.rooms.find(r => r.room_id === state.selectedRoomId);
      if (room) selectRoom(room);
    }
  });

  // Booking submit button
  btnSubmitBooking.addEventListener('click', submitBooking);

  // Search bookings button
  btnSearchBooking.addEventListener('click', searchBookings);
  searchQuery.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBookings();
  });

  // Close modals
  btnClosePaymentModal.addEventListener('click', () => togglePaymentModal(false));
  btnCancelPayment.addEventListener('click', () => togglePaymentModal(false));

  // Payment form submit
  paymentForm.addEventListener('submit', submitPayment);
}

// --- SUBMIT BOOKING RESERVATION ---
async function submitBooking() {
  // Validate form
  if (!studentForm.checkValidity()) {
    studentForm.reportValidity();
    return;
  }

  if (!state.selectedRoomId) {
    showToast('Please select a room.', 'warning');
    return;
  }

  const formData = {
    student_number: document.getElementById('student_number').value.trim(),
    first_name: document.getElementById('first_name').value.trim(),
    last_name: document.getElementById('last_name').value.trim(),
    email: document.getElementById('email').value.trim(),
    phone_number: document.getElementById('phone_number').value.trim(),
    gender: genderSelect.value,
    emergency_contact: document.getElementById('emergency_contact').value.trim(),
    room_id: state.selectedRoomId,
    academic_year: document.getElementById('academic_year').value,
    semester: parseInt(document.getElementById('semester').value)
  };

  btnSubmitBooking.disabled = true;
  btnSubmitBooking.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reserving Room...';

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      
      // Auto transition to status checking tab and search for this booking
      studentForm.reset();
      state.selectedRoomId = null;
      btnSubmitBooking.disabled = true;
      btnSubmitBooking.innerHTML = '<i class="fa-solid fa-circle-check"></i> Book Selected Room';
      
      // Refresh room layout
      await loadRooms();
      
      // Transition & query
      switchTab('status');
      searchQuery.value = formData.student_number;
      await searchBookings();
    } else {
      showToast(json.message || 'Booking reservation failed.', 'error');
      btnSubmitBooking.disabled = false;
      btnSubmitBooking.innerHTML = '<i class="fa-solid fa-circle-check"></i> Book Selected Room';
    }
  } catch (error) {
    console.error('Error submitting booking:', error);
    showToast('Network error during booking registration.', 'error');
    btnSubmitBooking.disabled = false;
    btnSubmitBooking.innerHTML = '<i class="fa-solid fa-circle-check"></i> Book Selected Room';
  }
}

// --- SEARCH BOOKINGS ---
async function searchBookings() {
  const query = searchQuery.value.trim();
  if (!query) {
    showToast('Please enter your index/student number or email address.', 'warning');
    return;
  }

  searchResults.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p>Searching bookings registry...</p>
    </div>
  `;
  searchEmptyState.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/bookings/search?query=${encodeURIComponent(query)}`);
    const json = await res.json();
    
    if (json.success && json.data.length > 0) {
      searchResults.innerHTML = '';
      
      json.data.forEach(booking => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor = 'rgba(255,255,255,0.06)';
        
        let actionsHtml = '';
        if (booking.booking_status === 'Pending') {
          actionsHtml = `
            <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
              <button class="btn btn-primary btn-sm" onclick="openPaymentModal(${booking.booking_id}, '${booking.room_number} (${booking.block_name})', '${booking.student_number}', ${booking.price_per_semester})">
                <i class="fa-solid fa-credit-card"></i> Pay Now (GH₵${parseFloat(booking.price_per_semester).toFixed(2)})
              </button>
            </div>
          `;
        }

        const dateStr = new Date(booking.booking_date).toLocaleDateString(undefined, { 
          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' 
        });

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem; margin-bottom: 1rem;">
            <div>
              <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dark); font-weight: 700;">Booking Reference</span>
              <h3 style="font-size: 1.25rem;">Ref: #BK-${booking.booking_id}</h3>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Registered on ${dateStr}</span>
            </div>
            <span class="status-pill ${booking.booking_status.toLowerCase()}">${booking.booking_status}</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.5rem; font-size: 0.9rem;">
            <div>
              <label>Student Profile</label>
              <strong>${booking.first_name} ${booking.last_name}</strong>
              <p style="font-size: 0.8rem;">ID: ${booking.student_number}</p>
            </div>
            <div>
              <label>Room Allocation</label>
              <strong>Room ${booking.room_number}</strong>
              <p style="font-size: 0.8rem;">${booking.block_name} • ${booking.type_name}</p>
            </div>
            <div>
              <label>Term / Period</label>
              <strong>${booking.academic_year}</strong>
              <p style="font-size: 0.8rem;">Semester ${booking.semester}</p>
            </div>
            <div>
              <label>Rate Per Semester</label>
              <strong style="color: var(--primary); font-size: 1.1rem;">GH₵${parseFloat(booking.price_per_semester).toFixed(2)}</strong>
            </div>
          </div>
          ${actionsHtml}
        `;
        searchResults.appendChild(card);
      });
    } else {
      searchResults.innerHTML = '';
      searchEmptyState.style.display = 'block';
    }
  } catch (error) {
    console.error('Error searching bookings:', error);
    searchResults.innerHTML = '';
    showToast('Failed to connect to bookings database.', 'error');
  }
}

// --- PAYMENT MODAL WINDOWS ---
window.openPaymentModal = function(bookingId, roomInfo, studentNo, amount) {
  receiptBookingId.textContent = `#BK-${bookingId}`;
  receiptRoomNo.textContent = roomInfo;
  receiptStudentNo.textContent = studentNo;
  receiptAmount.textContent = `GH₵${parseFloat(amount).toFixed(2)}`;
  
  payBookingId.value = bookingId;
  payAmount.value = amount;
  
  togglePaymentModal(true);
};

function togglePaymentModal(show) {
  if (show) {
    paymentModal.classList.add('active');
  } else {
    paymentModal.classList.remove('active');
    paymentForm.reset();
  }
}

// --- SUBMIT PAYMENT VIA TRANSACTIONS ---
async function submitPayment() {
  if (!paymentForm.checkValidity()) {
    paymentForm.reportValidity();
    return;
  }

  const formData = {
    booking_id: parseInt(payBookingId.value),
    amount_paid: parseFloat(payAmount.value),
    payment_method: document.getElementById('payment_method').value,
    transaction_reference: document.getElementById('transaction_reference').value.trim()
  };

  const btnConfirm = document.getElementById('btnConfirmPayment');
  btnConfirm.disabled = true;
  btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Securely...';

  try {
    const res = await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      togglePaymentModal(false);
      
      // Refresh current searches & rooms
      await loadRooms();
      await searchBookings();
    } else {
      showToast(json.message || 'Payment processing error.', 'error');
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<i class="fa-solid fa-lock"></i> Submit Payment';
    }
  } catch (error) {
    console.error('Error submitting payment:', error);
    showToast('Network error during transaction processing.', 'error');
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = '<i class="fa-solid fa-lock"></i> Submit Payment';
  }
}

// Landing page helper: Selects room category and scrolls to form
window.selectTypeFilter = function(typeName) {
  const typeFilter = document.getElementById('typeFilter');
  if (typeFilter) {
    for (let i = 0; i < typeFilter.options.length; i++) {
      if (typeFilter.options[i].text.toLowerCase().includes(typeName.toLowerCase()) || 
          typeFilter.options[i].value.toLowerCase().includes(typeName.toLowerCase())) {
        typeFilter.selectedIndex = i;
        typeFilter.dispatchEvent(new Event('change'));
        break;
      }
    }
  }
  // Scroll to booking form and focus on student index input
  const formElement = document.getElementById('student_number');
  if (formElement) {
    formElement.focus();
  }
};

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully:', reg.scope))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}
