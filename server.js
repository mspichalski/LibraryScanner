const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Access from your phone using your computer's IP address on port ${PORT}`);
});

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

