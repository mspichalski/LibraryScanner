# Camera Access Troubleshooting Guide

## Why Camera Access Isn't Working

Modern browsers (Chrome, Safari, Firefox) **require HTTPS** for camera access, except when accessing from `localhost` or `127.0.0.1`.

### The Problem:
- ✅ Works: `http://localhost:3000` (on the same device as the server)
- ❌ Doesn't work: `http://192.168.1.100:3000` (from your phone)
- ✅ Works: `https://192.168.1.100:3000` (with HTTPS enabled)

## Solutions (Choose One)

### Solution 1: Test Locally First (Easiest)
Access the app on the same device running the server:

```
http://localhost:3000
```

This is perfect for testing on your computer with a webcam!

### Solution 2: Enable HTTPS (Recommended for Phone Use)

#### Option A: Use Self-Signed Certificate (Quick)

1. **Generate a self-signed certificate:**

```bash
cd /Users/mspich/Dev/LibraryHelper
openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365
```

When prompted, you can press Enter for most fields. For "Common Name", enter your server's IP address (e.g., `192.168.1.100`).

2. **The server already supports HTTPS** - just place `server.key` and `server.cert` in the project root.

3. **Restart the server:**
```bash
npm start
```

The server will automatically detect the certificates and enable HTTPS on port 3443.

4. **Access from your phone:**
```
https://YOUR_IP:3443
```

5. **Accept the security warning:**
   - **iOS Safari**: Tap "Advanced" → "Proceed to Website"
   - **Chrome Android**: Tap "Advanced" → "Proceed to [your-ip] (unsafe)"
   
   This is safe for local development!

#### Option B: Use mkcert (Better - Trusted Certificate)

1. **Install mkcert:**

**macOS:**
```bash
brew install mkcert
brew install nss  # for Firefox
```

**Linux:**
```bash
# Download from https://github.com/FiloSottile/mkcert/releases
# Or use your package manager
```

2. **Create a local CA:**
```bash
mkcert -install
```

3. **Generate certificates:**
```bash
cd /Users/mspich/Dev/LibraryHelper
mkcert localhost 192.168.1.100 YOUR_COMPUTER_IP
```

This creates `localhost+2.pem` and `localhost+2-key.pem`.

4. **Rename the files:**
```bash
mv localhost+2.pem server.cert
mv localhost+2-key.pem server.key
```

5. **Install the CA on your phone:**
   - **iOS**: Email yourself the rootCA.pem file (found at `$(mkcert -CAROOT)/rootCA.pem`)
     - Open on iPhone → Install Profile
     - Go to Settings → General → About → Certificate Trust Settings
     - Enable full trust for the mkcert CA
   
   - **Android**: Transfer rootCA.pem to phone
     - Settings → Security → Install from storage
     - Select the certificate

6. **Access via HTTPS:**
```
https://YOUR_IP:3443
```

No security warnings! 🎉

### Solution 3: Use ngrok (Easiest for Remote Access)

ngrok provides a public HTTPS URL that tunnels to your local server:

1. **Install ngrok:**
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

2. **Sign up at ngrok.com** and get your auth token

3. **Configure ngrok:**
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

4. **Start your server normally:**
```bash
npm start
```

5. **In another terminal, start ngrok:**
```bash
ngrok http 3000
```

6. **Use the HTTPS URL provided:**
```
https://abc123.ngrok.io
```

This URL works from anywhere (not just your local network) and has valid HTTPS!

### Solution 4: Chrome Flag (Development Only)

For Chrome/Edge on Android, you can temporarily allow HTTP camera access:

1. **On your phone, open Chrome and go to:**
```
chrome://flags/#unsafely-treat-insecure-origin-as-secure
```

2. **Add your server's IP:**
```
http://192.168.1.100:3000
```

3. **Restart Chrome**

4. **Access the app** - camera will now work over HTTP

⚠️ **Note**: This is only for development testing!

## Verifying Camera Permissions

### Check Browser Console
1. Open the app
2. Open browser developer tools (F12 or right-click → Inspect)
3. Go to Console tab
4. Click "Start Scanner"
5. Look for errors

### Common Error Messages:

| Error | Meaning | Solution |
|-------|---------|----------|
| `NotAllowedError` | Permission denied by user | Allow camera in browser settings |
| `NotFoundError` | No camera detected | Check if device has a camera |
| `NotReadableError` | Camera in use | Close other apps using camera |
| `NotSecureContext` | HTTPS required | Use one of the solutions above |

### Testing Camera Access Directly

You can test if your browser can access the camera at all:

1. **Open browser console** (F12)
2. **Run this code:**
```javascript
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('✓ Camera access works!');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(err => console.error('✗ Camera error:', err));
```

## Browser-Specific Instructions

### iOS Safari
- **HTTPS Required**: Even for local IP addresses (strictest)
- **Recommended**: Use mkcert or ngrok
- Camera permission is per-website and persists

### Chrome Android
- **HTTPS Required**: Can use Chrome flag as workaround
- **Recommended**: Use ngrok (easiest) or self-signed cert
- Check Settings → Site Settings → Camera

### Firefox Mobile
- **HTTPS Required**: Similar to Chrome
- Check Settings → Site Permissions → Camera

## Raspberry Pi Specifics

When running on Raspberry Pi:

1. **Generate certificate on the Pi:**
```bash
cd ~/LibraryHelper
openssl req -nodes -new -x509 -keyout server.key -out server.cert -days 365
```

2. **Server auto-detects certificates** and enables HTTPS

3. **Access from phone:**
```
https://PI_IP_ADDRESS:3443
```

4. **Accept the security warning** (one time only per device)

## Quick Checklist

- [ ] Is the server running? (`npm start`)
- [ ] Are you using HTTPS or localhost?
- [ ] Did you grant camera permission when prompted?
- [ ] Is another app using the camera?
- [ ] Check browser console for specific errors
- [ ] Try accessing via `http://localhost:3000` on the server machine first

## Still Having Issues?

1. **Check what URL you're using:**
   - `http://localhost:3000` ✓ (on server machine)
   - `http://192.168.x.x:3000` ✗ (needs HTTPS)
   - `https://192.168.x.x:3443` ✓ (with certificates)

2. **Verify certificates exist:**
```bash
ls -la server.key server.cert
```

3. **Check server logs** for startup messages

4. **Try a different browser** to rule out browser-specific issues

5. **Restart your phone** (sometimes permissions get stuck)

## Summary: Recommended Approach

**For Development/Testing:**
- Use `http://localhost:3000` on the same device

**For Phone Access (Home Network):**
- Use **ngrok** (easiest, no certificate setup needed)
- Or use **mkcert** (better security, trusted certs)

**For Production (Raspberry Pi):**
- Use **Let's Encrypt** with a domain name
- Or **ngrok** for quick deployment
- Or **self-signed certificate** if only you will use it

