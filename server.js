const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database('./library.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDatabase();
  }
});

// Create tables if they don't exist
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS barcodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Database table ready.');
    }
  });
}

// API Routes

// Get all barcodes
app.get('/api/barcodes', (req, res) => {
  db.all('SELECT * FROM barcodes ORDER BY scanned_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ barcodes: rows });
  });
});

// Check if barcode exists
app.get('/api/barcodes/:barcode', (req, res) => {
  const barcode = req.params.barcode;
  db.get('SELECT * FROM barcodes WHERE barcode = ?', [barcode], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ exists: !!row, barcode: row });
  });
});

// Add a new barcode
app.post('/api/barcodes', (req, res) => {
  const { barcode, notes } = req.body;
  
  if (!barcode) {
    res.status(400).json({ error: 'Barcode is required' });
    return;
  }

  db.run(
    'INSERT INTO barcodes (barcode, notes) VALUES (?, ?)',
    [barcode, notes || ''],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(409).json({ error: 'Barcode already exists in database' });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      res.json({
        id: this.lastID,
        barcode: barcode,
        message: 'Barcode added successfully'
      });
    }
  );
});

// Delete a barcode
app.delete('/api/barcodes/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM barcodes WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Barcode deleted successfully', changes: this.changes });
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Check for SSL certificates
const keyPath = path.join(__dirname, 'server.key');
const certPath = path.join(__dirname, 'server.cert');

let server;

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  // HTTPS mode
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  
  server = https.createServer(httpsOptions, app);
  server.listen(HTTPS_PORT, () => {
    console.log(`✓ HTTPS Server running on https://localhost:${HTTPS_PORT}`);
    console.log(`📱 Access from your phone: https://YOUR_IP:${HTTPS_PORT}`);
    console.log(`🔒 HTTPS enabled - camera access will work from mobile devices!`);
    console.log(`⚠️  You may need to accept the security warning for self-signed certificates`);
  });
} else {
  // HTTP mode
  server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`✓ HTTP Server running on http://localhost:${PORT}`);
    console.log(`📱 Access from your phone: http://YOUR_IP:${PORT}`);
    console.log(`⚠️  Camera access requires HTTPS for non-localhost connections`);
    console.log(`📖 See CAMERA_SETUP.md for instructions on enabling HTTPS`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Closed the database connection.');
    process.exit(0);
  });
});

