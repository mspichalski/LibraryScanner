let html5QrcodeScanner = null;
let isScanning = false;
let lastScannedBarcode = null;
let scanningStep = 'employee'; // 'employee' or 'book'
let employeeBadge = null;

// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const scanStatus = document.getElementById('scanStatus');
const scansList = document.getElementById('scansList');
const confirmModal = document.getElementById('confirmModal');
const modalBarcode = document.getElementById('modalBarcode');
const notesInput = document.getElementById('notesInput');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

// Event Listeners
startBtn.addEventListener('click', startScanner);
stopBtn.addEventListener('click', stopScanner);
confirmYes.addEventListener('click', addBarcodeToDatabase);
confirmNo.addEventListener('click', closeModal);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadRecentScans();
  checkCameraSupport();
});

// Check camera support and show warnings
function checkCameraSupport() {
  const isSecureContext = window.isSecureContext;
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
  
  if (!isSecureContext && !isLocalhost) {
    const warning = document.createElement('div');
    warning.className = 'status-message error';
    warning.style.display = 'block';
    warning.style.marginBottom = '15px';
    warning.innerHTML = `
      <strong>⚠️ HTTPS Required</strong><br>
      Camera access requires HTTPS on non-localhost connections.<br>
      <small>Access via <code>localhost</code> on this device, or set up HTTPS.</small>
    `;
    document.querySelector('.scanner-section').insertBefore(
      warning, 
      document.getElementById('reader')
    );
  }
  
  // Check if getUserMedia is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const warning = document.createElement('div');
    warning.className = 'status-message error';
    warning.style.display = 'block';
    warning.style.marginBottom = '15px';
    warning.innerHTML = `
      <strong>⚠️ Camera Not Supported</strong><br>
      Your browser doesn't support camera access.
    `;
    document.querySelector('.scanner-section').insertBefore(
      warning, 
      document.getElementById('reader')
    );
  }
}

// Start the barcode scanner
async function startScanner() {
  try {
    // Check if we're on HTTPS or localhost
    const isSecureContext = window.isSecureContext;
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    if (!isSecureContext && !isLocalhost) {
      showStatus('⚠️ Camera requires HTTPS! Please see console for instructions.', 'error');
      console.error('🔒 HTTPS Required for Camera Access');
      console.log('📱 Solutions:');
      console.log('1. Access via localhost on the same device');
      console.log('2. Use HTTPS (see server.js for setup)');
      console.log('3. For testing, use Chrome with flag: chrome://flags/#unsafely-treat-insecure-origin-as-secure');
      console.log('   Add your server IP to the list');
      startBtn.style.display = 'inline-block';
      stopBtn.style.display = 'none';
      return;
    }
    
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    
    showStatus('Requesting camera access...', 'info');
    
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };
    
    await html5QrcodeScanner.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanError
    );
    
    isScanning = true;
    const stepMessage = scanningStep === 'employee' 
      ? '✓ Scanner started. Please scan EMPLOYEE BADGE.' 
      : '✓ Scanner started. Please scan BOOK CODE.';
    showStatus(stepMessage, 'info');
  } catch (err) {
    console.error('Error starting scanner:', err);
    
    let errorMsg = 'Error starting scanner.';
    
    if (err.toString().includes('NotAllowedError') || err.toString().includes('Permission')) {
      errorMsg = '❌ Camera permission denied. Please allow camera access in your browser settings.';
    } else if (err.toString().includes('NotFoundError')) {
      errorMsg = '❌ No camera found on this device.';
    } else if (err.toString().includes('NotReadableError')) {
      errorMsg = '❌ Camera is already in use by another app.';
    } else if (err.toString().includes('OverconstrainedError')) {
      errorMsg = '❌ Camera constraints not supported.';
    } else if (err.toString().includes('TypeError')) {
      errorMsg = '❌ Camera not available. Check HTTPS requirement.';
    }
    
    showStatus(errorMsg, 'error');
    startBtn.style.display = 'inline-block';
    stopBtn.style.display = 'none';
  }
}

// Stop the barcode scanner
async function stopScanner(resetState = true) {
  if (html5QrcodeScanner && isScanning) {
    try {
      await html5QrcodeScanner.stop();
      html5QrcodeScanner.clear();
      html5QrcodeScanner = null;
      isScanning = false;
      
      // Only reset scanning state if explicitly requested (e.g., manual stop)
      if (resetState) {
        scanningStep = 'employee';
        employeeBadge = null;
        lastScannedBarcode = null;
      }
      
      startBtn.style.display = 'inline-block';
      stopBtn.style.display = 'none';
      
      if (resetState) {
        showStatus('Scanner stopped.', 'info');
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  }
}

// Handle successful scan
function onScanSuccess(decodedText, decodedResult) {
  // Prevent duplicate rapid scans
  if (decodedText === lastScannedBarcode) {
    return;
  }
  
  lastScannedBarcode = decodedText;
  
  if (scanningStep === 'employee') {
    // First step: Employee badge scanned
    employeeBadge = decodedText;
    playBeep();
    
    // Stop scanner temporarily (without resetting state)
    if (isScanning) {
      stopScanner(false);
    }
    
    showStatus(`✓ Employee badge scanned: ${decodedText}`, 'success');
    
    // Move to next step
    scanningStep = 'book';
    
    // Auto-restart scanner for book code after a short delay
    setTimeout(() => {
      lastScannedBarcode = null;
      startScanner();
    }, 1500);
    
  } else {
    // Second step: Book code scanned
    playBeep();
    
    // Stop scanner temporarily to show modal (without resetting state yet)
    if (isScanning) {
      stopScanner(false);
    }
    
    // Show confirmation modal with both values
    showConfirmationModal(employeeBadge, decodedText);
  }
}

// Handle scan errors (silent - just for logging)
function onScanError(errorMessage) {
  // Ignore common scanning errors
}

// Show confirmation modal
function showConfirmationModal(employeeBadgeValue, bookCode) {
  document.getElementById('modalEmployeeBadge').textContent = employeeBadgeValue;
  document.getElementById('modalBarcode').textContent = bookCode;
  notesInput.value = '';
  confirmModal.classList.add('show');
}

// Close modal
function closeModal() {
  confirmModal.classList.remove('show');
  lastScannedBarcode = null;
  
  // Reset to first step
  scanningStep = 'employee';
  employeeBadge = null;
  
  showStatus('Scan cancelled. Ready to scan employee badge.', 'info');
}

// Add barcode to database
async function addBarcodeToDatabase() {
  const employee_badge = document.getElementById('modalEmployeeBadge').textContent;
  const barcode = document.getElementById('modalBarcode').textContent;
  const notes = notesInput.value.trim();
  
  try {
    const response = await fetch('/api/barcodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ employee_badge, barcode, notes })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showStatus(`✓ Book ${barcode} added for employee ${employee_badge}!`, 'success');
      loadRecentScans();
      closeModal();
    } else {
      showStatus(`Error: ${data.error}`, 'error');
    }
  } catch (err) {
    console.error('Error adding barcode:', err);
    showStatus('Error connecting to server.', 'error');
  }
  
  // Reset for next scan
  scanningStep = 'employee';
  employeeBadge = null;
  lastScannedBarcode = null;
}

// Load recent scans from database
async function loadRecentScans() {
  try {
    const response = await fetch('/api/barcodes');
    const data = await response.json();
    
    if (data.barcodes && data.barcodes.length > 0) {
      displayScans(data.barcodes);
    } else {
      scansList.innerHTML = '<p class="empty-state">No items scanned yet</p>';
    }
  } catch (err) {
    console.error('Error loading scans:', err);
    scansList.innerHTML = '<p class="empty-state">Error loading scans</p>';
  }
}

// Display scans in the list
function displayScans(barcodes) {
  scansList.innerHTML = barcodes.map(item => `
    <div class="scan-item">
      <div class="scan-info">
        <div class="scan-barcode"><strong>Employee:</strong> ${item.employee_badge}</div>
        <div class="scan-barcode"><strong>Book:</strong> ${item.barcode}</div>
        <div class="scan-time">${formatDate(item.scanned_at)}</div>
        ${item.notes ? `<div class="scan-notes">${item.notes}</div>` : ''}
      </div>
      <button class="delete-btn" onclick="deleteBarcode(${item.id})">Delete</button>
    </div>
  `).join('');
}

// Delete barcode from database
async function deleteBarcode(id) {
  if (!confirm('Are you sure you want to delete this item?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/barcodes/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showStatus('Item deleted successfully.', 'success');
      loadRecentScans();
    } else {
      showStatus('Error deleting item.', 'error');
    }
  } catch (err) {
    console.error('Error deleting barcode:', err);
    showStatus('Error connecting to server.', 'error');
  }
}

// Show status message
function showStatus(message, type) {
  scanStatus.textContent = message;
  scanStatus.className = `status-message ${type}`;
  scanStatus.style.display = 'block';
  
  setTimeout(() => {
    scanStatus.style.display = 'none';
  }, 5000);
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Play beep sound on successful scan
function playBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (err) {
    // Beep not critical - ignore errors
  }
}

