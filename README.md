# Library Helper - Barcode Scanner Web App

A mobile-friendly web application for scanning barcodes and adding them to a SQLite database.

**🥧 Perfect for Raspberry Pi!** - See [RASPBERRY_PI_SETUP.md](RASPBERRY_PI_SETUP.md) for detailed setup instructions.

## Features

- 📱 Mobile-optimized camera barcode scanning
- 📷 Uses phone camera for real-time barcode detection
- 💾 SQLite database for persistent storage
- ✅ Confirmation dialog before adding items
- 📝 Optional notes for each scanned item
- 📊 View history of all scanned items
- 🗑️ Delete items from database
- 🎨 Beautiful, modern UI with smooth animations

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Access the app:
   - On your computer: `http://localhost:3000`
   - On your phone: `http://YOUR_COMPUTER_IP:3000`
     (Make sure your phone and computer are on the same network)

## Usage

1. Open the app on your phone's browser
2. Click "Start Scanner" to activate the camera
3. Point the camera at a barcode
4. When a barcode is detected, you'll be asked if you want to add it
5. Optionally add notes about the item
6. Click "Yes, Add It" to save to the database
7. View all scanned items in the "Recent Scans" section

## ⚠️ Camera Not Working?

Modern browsers require **HTTPS** for camera access (except on localhost).

**Quick Solutions:**
- **Test locally first**: Open `http://localhost:3000` on the server machine
- **Enable HTTPS**: See [CAMERA_SETUP.md](CAMERA_SETUP.md) for detailed instructions
- **Use ngrok**: Instant HTTPS tunnel (easiest for phone testing)

## Finding Your Computer's IP Address

### macOS:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Windows:
```bash
ipconfig
```
Look for "IPv4 Address"

### Linux:
```bash
ip addr show
```

## API Endpoints

- `GET /api/barcodes` - Get all barcodes
- `GET /api/barcodes/:barcode` - Check if barcode exists
- `POST /api/barcodes` - Add new barcode
- `DELETE /api/barcodes/:id` - Delete barcode

## Technologies Used

- **Backend**: Node.js, Express, SQLite3
- **Frontend**: HTML5, CSS3, JavaScript
- **Barcode Scanning**: html5-qrcode library
- **Camera Access**: WebRTC getUserMedia API

## Browser Compatibility

Works on modern mobile browsers that support:
- Camera access (getUserMedia)
- ES6 JavaScript
- Flexbox/Grid CSS

Tested on:
- iOS Safari
- Chrome for Android
- Firefox Mobile

## Security Notes

- Camera access requires HTTPS in production (HTTP works on localhost)
- The app requests camera permissions - users must grant access
- Database is stored locally on the server

## Development

For development with auto-restart:
```bash
npm run dev
```

## Database

The SQLite database (`library.db`) is created automatically and contains:
- `id`: Auto-incrementing primary key
- `barcode`: The scanned barcode (unique)
- `scanned_at`: Timestamp of when it was added
- `notes`: Optional notes about the item

## License

ISC

