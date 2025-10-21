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

// Initialize SQLite database - using shared database with LibraryManager
const dbPath = path.join(__dirname, '../LibraryManager/library.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the shared library database.');
    console.log(`Database location: ${dbPath}`);
  }
});

// API Routes

// Get book by code
app.get('/api/books/code/:code', (req, res) => {
  const code = req.params.code;
  const query = `
    SELECT b.*, 
           CASE WHEN b.status = 'checked_out' THEN u.name ELSE NULL END as checked_out_to,
           CASE WHEN b.status = 'checked_out' THEN u.code ELSE NULL END as checked_out_to_code
    FROM books b
    LEFT JOIN checkouts c ON b.id = c.book_id AND c.status = 'checked_out'
    LEFT JOIN users u ON c.user_id = u.id
    WHERE b.code = ?
  `;
  
  db.get(query, [code], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    res.json({ book: row });
  });
});

// Get user by code
app.get('/api/users/code/:code', (req, res) => {
  const code = req.params.code;
  db.get('SELECT * FROM users WHERE code = ?', [code], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: row });
  });
});

// Checkout a book
app.post('/api/checkouts', (req, res) => {
  const { book_code, user_code, due_days } = req.body;
  
  if (!book_code || !user_code) {
    res.status(400).json({ error: 'Book code and user code are required' });
    return;
  }

  // Find book and user
  db.get('SELECT * FROM books WHERE code = ?', [book_code], (err, book) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    if (book.status !== 'available') {
      res.status(400).json({ error: 'Book is not available' });
      return;
    }

    db.get('SELECT * FROM users WHERE code = ?', [user_code], (err, user) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (due_days || 14));

      // Create checkout record
      db.run(
        'INSERT INTO checkouts (book_id, user_id, due_date, status) VALUES (?, ?, ?, ?)',
        [book.id, user.id, dueDate.toISOString(), 'checked_out'],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          // Update book status
          db.run(
            'UPDATE books SET status = ? WHERE id = ?',
            ['checked_out', book.id],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              res.json({
                id: this.lastID,
                message: 'Book checked out successfully',
                book: book.title,
                user: user.name,
                due_date: dueDate
              });
            }
          );
        }
      );
    });
  });
});

// Return a book
app.post('/api/checkouts/return', (req, res) => {
  const { book_code } = req.body;
  
  if (!book_code) {
    res.status(400).json({ error: 'Book code is required' });
    return;
  }

  // Find book
  db.get('SELECT * FROM books WHERE code = ?', [book_code], (err, book) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    if (book.status !== 'checked_out') {
      res.status(400).json({ error: 'Book is not checked out' });
      return;
    }

    // Find active checkout
    db.get(
      'SELECT * FROM checkouts WHERE book_id = ? AND status = ?',
      [book.id, 'checked_out'],
      (err, checkout) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!checkout) {
          res.status(404).json({ error: 'Checkout record not found' });
          return;
        }

        // Update checkout record
        db.run(
          'UPDATE checkouts SET return_date = ?, status = ? WHERE id = ?',
          [new Date().toISOString(), 'returned', checkout.id],
          (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            // Update book status
            db.run(
              'UPDATE books SET status = ? WHERE id = ?',
              ['available', book.id],
              (err) => {
                if (err) {
                  res.status(500).json({ error: err.message });
                  return;
                }
                res.json({
                  message: 'Book returned successfully',
                  book: book.title
                });
              }
            );
          }
        );
      }
    );
  });
});

// Get active checkouts
app.get('/api/checkouts/active', (req, res) => {
  const query = `
    SELECT c.*, b.title, b.author, b.code as book_code, u.name as user_name, u.code as user_code
    FROM checkouts c
    JOIN books b ON c.book_id = b.id
    JOIN users u ON c.user_id = u.id
    WHERE c.status = 'checked_out'
    ORDER BY c.due_date ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ checkouts: rows });
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

