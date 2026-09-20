# 🚀 ZenFii-MikroTik Bridge - LOCAL WINDOWS VERSION

## Quick Start (5 minutes)

### Step 1: Install SSH Client
Windows 10/11 already has SSH. Test it:
```powershell
ssh -V
```

If you get "ssh not found", install [Git for Windows](https://git-scm.com/download/win) which includes SSH.

### Step 2: Test MikroTik SSH Connection
Open PowerShell and test:
```powershell
ssh -p 22 admin@10.128.10.1
```

You should be prompted for password. Enter your MikroTik password to verify it works.

### Step 3: Run the Bot
```powershell
cd C:\Users\mwaka
npm install
node index.js
```

You should see:
```
✓ MikroTik SSH connection successful
🔄 Starting polling loop every 120s
```

### Step 4: Test with a Real Payment
1. Make a test payment on ZenFii
2. Wait 2 minutes for the bot to poll
3. Check MikroTik Hotspot Users in Winbox
4. New user should appear with Transaction ID as username
5. Try logging in with password: `voucher`

---

## Running 24/7 (Keep PC Running)

### Option A: Manual
Just leave PowerShell running with the bot. Keep your PC on.

### Option B: Windows Task Scheduler (Auto-start)
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: "At log on"
4. Set action: `C:\Program Files\nodejs\node.exe C:\Users\mwaka\index.js`
5. Check "Run whether user is logged in or not"

### Option C: NSSM (Service Manager)
Install [NSSM](https://nssm.cc/download):
```powershell
nssm install ZenFiiBot "C:\Program Files\nodejs\node.exe" "C:\Users\mwaka\index.js"
nssm start ZenFiiBot
```

---

## Monitoring

### Watch Real-Time Logs
Just watch the PowerShell window. You'll see:
```
[9/20/2026 11:00:00 PM] Polling...
📥 Fetching transactions from ZenFii...
✓ Found X transaction(s)
✅ Created hotspot user: 1234567890
```

### Check Status File
```powershell
cat C:\Users\mwaka\processed_transactions.json
```

---

## Troubleshooting

### "SSH command timeout"
- **Cause**: Can't connect to MikroTik
- **Fix**: 
  1. Verify MikroTik is on and reachable: `ping 10.128.10.1`
  2. Test SSH manually: `ssh -p 22 admin@10.128.10.1`
  3. Check password is correct in `.env`

### "No transactions found"
- **Cause**: ZenFii API not responding or wrong credentials
- **Fix**:
  1. Verify ZenFii username/password in `.env`
  2. Test manually: Open browser, login to ZenFii
  3. Check which API endpoint works (bot will log this)

### "User already exists"
- **Normal**: Transaction already processed
- **File**: `processed_transactions.json` tracks this
- **Reset**: Delete file if you want to reprocess old transactions

---

## Configuration

Edit `.env`:
```
ZENFII_USERNAME=lukeyung1@outlook.com
ZENFII_PASSWORD=1714@Con2
MIKROTIK_HOST=10.128.10.1
MIKROTIK_PORT=22
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=Sycho123
POLL_INTERVAL=120              # Check every 2 minutes
HOTSPOT_PROFILE=default        # Your MikroTik profile
VOUCHER_PASSWORD=voucher       # Password for new users
```

---

## What's Different from Cloud Version

| Feature | Cloud (Render) | Local (Windows) |
|---------|---|---|
| **Connection** | VPN tunnel (blocked) ❌ | Local network ✅ |
| **Reliability** | Unreliable | Rock solid |
| **Requires** | Render.com account | Just your PC |
| **Always on** | Yes (paid) | Only when PC is on |
| **Cost** | $7+/month | $0 |

---

## Support

If bot crashes:
1. Check `.env` is configured correctly
2. Verify MikroTik is accessible
3. Check PowerShell for error messages
4. Restart: Just run `node index.js` again

**This version works 100% reliably** because it connects locally to your MikroTik! 🎉
