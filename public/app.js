let html5QrcodeScanner = null;
let isScanning = false;
let lastScannedCode = null;
let scanningStep = 'book'; // 'book' or 'badge'
let currentBook = null;

// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const scanStatus = document.getElementById('scanStatus');
const scansList = document.getElementById('scansList');

// Event Listeners
startBtn.addEventListener('click', startScanner);
stopBtn.addEventListener('click', stopScanner);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadActiveCheckouts();
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
    const isSecureContext = window.isSecureContext;
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    if (!isSecureContext && !isLocalhost) {
      showStatus('⚠️ Camera requires HTTPS!', 'error');
      console.error('🔒 HTTPS Required for Camera Access');
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
    const stepMessage = scanningStep === 'book' 
      ? '✓ Scanner started. Please scan BOOK CODE.' 
      : '✓ Scanner started. Please scan USER BADGE.';
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
      
      if (resetState) {
        scanningStep = 'book';
        currentBook = null;
        lastScannedCode = null;
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
async function onScanSuccess(decodedText, decodedResult) {
  // Prevent duplicate rapid scans
  if (decodedText === lastScannedCode) {
    return;
  }
  
  lastScannedCode = decodedText;
  
  if (scanningStep === 'book') {
    // First step: Book code scanned
    playBeep();
    
    // Stop scanner temporarily
    if (isScanning) {
      await stopScanner(false);
    }
    
    showStatus(`Checking book ${decodedText}...`, 'info');
    
    // Check if book exists and get its status
    try {
      const response = await fetch(`/api/books/code/${encodeURIComponent(decodedText)}`);
      const data = await response.json();
      
      if (response.ok) {
        currentBook = data.book;
        
        if (currentBook.status === 'available') {
          // Book is available - ask to scan badge for checkout
          showStatus(`✓ Book "${currentBook.title}" is AVAILABLE. Scan user badge to check out.`, 'success');
          scanningStep = 'badge';
          
          setTimeout(() => {
            lastScannedCode = null;
            startScanner();
          }, 2000);
        } else {
          // Book is checked out - ask to scan badge for return
          showStatus(`⚠️ Book "${currentBook.title}" is CHECKED OUT to ${currentBook.checked_out_to}. Scan badge to return.`, 'warning');
          scanningStep = 'badge';
          
          setTimeout(() => {
            lastScannedCode = null;
            startScanner();
          }, 2000);
        }
      } else {
        showStatus(`❌ Book not found: ${decodedText}`, 'error');
        setTimeout(() => {
          lastScannedCode = null;
          startScanner();
        }, 2000);
      }
    } catch (err) {
      console.error('Error checking book:', err);
      showStatus('Error connecting to server', 'error');
      setTimeout(() => {
        lastScannedCode = null;
        startScanner();
      }, 2000);
    }
    
  } else {
    // Second step: Badge scanned
    playBeep();
    
    // Stop scanner
    if (isScanning) {
      await stopScanner(false);
    }
    
    const userCode = decodedText;
    showStatus(`Checking user ${userCode}...`, 'info');
    
    // Verify user exists
    try {
      const response = await fetch(`/api/users/code/${encodeURIComponent(userCode)}`);
      const data = await response.json();
      
      if (!response.ok) {
        showStatus(`❌ User not found: ${userCode}`, 'error');
        resetToBookScan();
        return;
      }
      
      const user = data.user;
      
      if (currentBook.status === 'available') {
        // Checkout the book
        await checkoutBook(currentBook.code, userCode, user.name);
      } else {
        // Try to return the book
        if (currentBook.checked_out_to_code === userCode) {
          // Correct user - return the book
          await returnBook(currentBook.code, user.name);
        } else {
          // Wrong user
          showStatus(`❌ WARNING: Book is checked out to ${currentBook.checked_out_to}, not ${user.name}!`, 'error');
          resetToBookScan();
        }
      }
      
    } catch (err) {
      console.error('Error checking user:', err);
      showStatus('Error connecting to server', 'error');
      resetToBookScan();
    }
  }
}

// Handle scan errors (silent - just for logging)
function onScanError(errorMessage) {
  // Ignore common scanning errors
}

// Checkout a book
async function checkoutBook(bookCode, userCode, userName) {
  try {
    const response = await fetch('/api/checkouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_code: bookCode, user_code: userCode, due_days: 14 })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showStatus(`✓ SUCCESS: "${currentBook.title}" checked out to ${userName}!`, 'success');
      loadActiveCheckouts();
      resetToBookScan();
    } else {
      showStatus(`❌ Error: ${data.error}`, 'error');
      resetToBookScan();
    }
  } catch (err) {
    console.error('Error checking out book:', err);
    showStatus('Error connecting to server', 'error');
    resetToBookScan();
  }
}

// Return a book
async function returnBook(bookCode, userName) {
  try {
    const response = await fetch('/api/checkouts/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_code: bookCode })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showStatus(`✓ SUCCESS: "${currentBook.title}" returned by ${userName}!`, 'success');
      loadActiveCheckouts();
      resetToBookScan();
    } else {
      showStatus(`❌ Error: ${data.error}`, 'error');
      resetToBookScan();
    }
  } catch (err) {
    console.error('Error returning book:', err);
    showStatus('Error connecting to server', 'error');
    resetToBookScan();
  }
}

// Reset to book scanning
function resetToBookScan() {
  setTimeout(() => {
    scanningStep = 'book';
    currentBook = null;
    lastScannedCode = null;
    startScanner();
  }, 3000);
}

// Load active checkouts from database
async function loadActiveCheckouts() {
  try {
    const response = await fetch('/api/checkouts/active');
    const data = await response.json();
    
    if (data.checkouts && data.checkouts.length > 0) {
      displayCheckouts(data.checkouts);
    } else {
      scansList.innerHTML = '<p class="empty-state">No books currently checked out</p>';
    }
  } catch (err) {
    console.error('Error loading checkouts:', err);
    scansList.innerHTML = '<p class="empty-state">Error loading checkouts</p>';
  }
}

// Display checkouts in the list
function displayCheckouts(checkouts) {
  scansList.innerHTML = checkouts.map(item => {
    const dueDate = new Date(item.due_date);
    const isOverdue = dueDate < new Date();
    
    return `
      <div class="scan-item">
        <div class="scan-info">
          <div class="scan-barcode"><strong>Book:</strong> ${item.title} by ${item.author}</div>
          <div class="scan-barcode"><strong>Code:</strong> ${item.book_code}</div>
          <div class="scan-barcode"><strong>User:</strong> ${item.user_name} (${item.user_code})</div>
          <div class="scan-time ${isOverdue ? 'overdue' : ''}">
            <strong>Due:</strong> ${formatDate(item.due_date)} ${isOverdue ? '(OVERDUE)' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Show status message
function showStatus(message, type) {
  scanStatus.textContent = message;
  scanStatus.className = `status-message ${type}`;
  scanStatus.style.display = 'block';
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
