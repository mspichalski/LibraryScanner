# Running Library Helper on Raspberry Pi

This guide will help you set up the Library Helper barcode scanner on your Raspberry Pi.

## Prerequisites

- Raspberry Pi (any model with network connectivity)
- Raspberry Pi OS (Raspbian) installed
- Your Pi and phone on the same WiFi network

## Installation Steps

### 1. Update Your Raspberry Pi

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 2. Install Node.js

Check if Node.js is installed:
```bash
node --version
```

If not installed or version is too old (need 14+), install the latest:

```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify installation:
```bash
node --version
npm --version
```

### 3. Install Build Tools (for SQLite native module)

```bash
sudo apt-get install -y build-essential python3
```

### 4. Transfer or Clone Your App

**Option A: Transfer from your computer**
```bash
# On your computer (from the LibraryHelper directory)
scp -r /Users/mspich/Dev/LibraryHelper pi@raspberrypi.local:~/

# Or use rsync
rsync -avz /Users/mspich/Dev/LibraryHelper/ pi@raspberrypi.local:~/LibraryHelper/
```

**Option B: Git clone** (if you have it in a repository)
```bash
cd ~
git clone <your-repo-url>
cd LibraryHelper
```

**Option C: Manual transfer via USB drive**
Copy the LibraryHelper folder to a USB drive, then mount and copy on the Pi.

### 5. Install Dependencies

```bash
cd ~/LibraryHelper
npm install
```

### 6. Find Your Raspberry Pi's IP Address

```bash
hostname -I
```

The first IP address shown (usually 192.168.x.x) is what you'll use.

### 7. Start the Server

```bash
npm start
```

The server will start on port 3000.

### 8. Access from Your Phone

Open your phone's browser and go to:
```
http://YOUR_PI_IP_ADDRESS:3000
```

For example: `http://192.168.1.100:3000`

## Running as a Background Service

To keep the app running even after you close the terminal:

### Option 1: Using PM2 (Recommended)

Install PM2:
```bash
sudo npm install -g pm2
```

Start the app:
```bash
cd ~/LibraryHelper
pm2 start server.js --name library-helper
```

Make it start on boot:
```bash
pm2 startup
pm2 save
```

Useful PM2 commands:
```bash
pm2 status              # Check status
pm2 logs library-helper # View logs
pm2 restart library-helper
pm2 stop library-helper
pm2 delete library-helper
```

### Option 2: Using systemd

Create a service file:
```bash
sudo nano /etc/systemd/system/library-helper.service
```

Add this content (adjust paths if needed):
```ini
[Unit]
Description=Library Helper Barcode Scanner
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/LibraryHelper
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable library-helper
sudo systemctl start library-helper
```

Check status:
```bash
sudo systemctl status library-helper
```

View logs:
```bash
journalctl -u library-helper -f
```

## Accessing from Outside Your Home Network (Optional)

### Option 1: Port Forwarding
1. Log into your router
2. Forward port 3000 to your Pi's IP address
3. Find your public IP: `curl ifconfig.me`
4. Access via: `http://YOUR_PUBLIC_IP:3000`

⚠️ **Security Warning**: Consider adding authentication if exposing to the internet!

### Option 2: Use ngrok (Easier)
```bash
# Install ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm.tgz
sudo tar xvzf ngrok-v3-stable-linux-arm.tgz -C /usr/local/bin

# Sign up at ngrok.com and get your auth token
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Start tunnel
ngrok http 3000
```

You'll get a public URL like: `https://abc123.ngrok.io`

## Troubleshooting

### Port 3000 Already in Use
Change the port in server.js or set environment variable:
```bash
PORT=8080 npm start
```

### SQLite Build Errors
If you get errors about SQLite:
```bash
npm rebuild sqlite3 --build-from-source
```

### Permission Errors
If the app can't create the database file:
```bash
chmod 755 ~/LibraryHelper
```

### Can't Access from Phone
1. Make sure your phone and Pi are on the same WiFi network
2. Check Pi's firewall:
```bash
sudo ufw status
# If active, allow port 3000:
sudo ufw allow 3000
```

### Camera Not Working
- Camera access requires HTTPS for remote access (except localhost)
- Use ngrok or set up HTTPS with Let's Encrypt if needed
- On local network (192.168.x.x), HTTP should work fine

## Performance Tips

1. **Use a good SD card** - Class 10 or better for better database performance
2. **Overclock (optional)** - For better responsiveness
3. **Disable unnecessary services** - Free up resources
4. **Use a wired connection** - More stable than WiFi

## Backup Your Database

The SQLite database is stored in `library.db`. To backup:

```bash
# Manual backup
cp ~/LibraryHelper/library.db ~/LibraryHelper/library.db.backup

# Automated daily backup (add to crontab)
0 2 * * * cp ~/LibraryHelper/library.db ~/LibraryHelper/backups/library-$(date +\%Y\%m\%d).db
```

## Updating the App

```bash
cd ~/LibraryHelper
git pull  # If using git
npm install  # If dependencies changed
pm2 restart library-helper  # If using PM2
# or
sudo systemctl restart library-helper  # If using systemd
```

## Recommended Raspberry Pi Models

- **Raspberry Pi 4** (2GB+) - Best performance
- **Raspberry Pi 3 B+** - Good for this app
- **Raspberry Pi Zero 2 W** - Works but slower
- **Raspberry Pi 5** - Excellent, if you have one

## Resource Usage

Typical usage on this app:
- RAM: ~50-100 MB
- CPU: <5% idle, ~10-20% during scans
- Storage: <50 MB (excluding database growth)

Your database will grow based on how many items you scan (typically a few KB per item).

## Need Help?

If you run into issues, check:
1. Node.js version: `node --version` (should be 14+)
2. Port is available: `sudo netstat -tlnp | grep 3000`
3. Server logs: Look at the terminal output or PM2/systemd logs
4. Network connectivity: `ping google.com`

