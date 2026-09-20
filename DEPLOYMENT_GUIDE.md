# ZenFii ↔ MikroTik Automated Bridge - Cloud Deployment Guide

## Overview

This bot automatically:
1. ✅ Logs into your ZenFii account
2. ✅ Scrapes transaction IDs from Dashboard → Transactions
3. ✅ Creates hotspot users on MikroTik with transaction IDs
4. ✅ Runs continuously every 2 minutes
5. ✅ Prevents duplicate user creation

## Prerequisites

1. **Node.js 18+** installed locally OR use a free hosting service
2. **MikroTik API access** on port 8728 (unencrypted) or 8729 (encrypted)
3. **ZenFii credentials** (your login username/email and password)

## Option 1: Run Locally (Testing)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure .env file
# (Already configured in C:\Users\mwaka\.env)

# 3. Run the bot
npm start
```

### Output
```
ZenFii ↔ MikroTik Automated Hotspot User Bridge

📥 Fetching transactions from ZenFii...
🔐 Logging in...
📋 Navigating to transactions page...
✓ Found 5 transaction(s)
→ Processing transaction: 4363864731
✅ Created hotspot user: 4363864731
✓ Poll complete: 1 new user(s) created
```

## Option 2: Deploy to Railway.app (Recommended for Free Hosting)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Create a new project

### Step 2: Connect Your Repository
1. Fork or upload this project to GitHub
2. In Railway, click "New Project" → "Deploy from GitHub repo"
3. Select your repository

### Step 3: Add Environment Variables
In Railway, go to **Variables** and add:
```
ZENFII_URL=https://web.zenfii.net
ZENFII_USERNAME=lukeyung1@outlook.com
ZENFII_PASSWORD=1714@Con2
MIKROTIK_HOST=vpn4.xenfi.net
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=Sycho123
POLL_INTERVAL=120
HOTSPOT_PROFILE=default
VOUCHER_PASSWORD=voucher
PORT=3000
```

### Step 4: Deploy
- Railway will automatically deploy when you push to GitHub
- View logs in the Railway dashboard
- The bot will start polling immediately

## Option 3: Deploy to Render.com (Also Free)

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up
3. Create a new "Web Service"

### Step 2: Connect Repository
1. Choose "Deploy from GitHub"
2. Select your repository
3. Set **Runtime** to "Node"
4. Set **Build Command** to: `npm install`
5. Set **Start Command** to: `npm start`

### Step 3: Add Environment Variables
In Environment Variables section, add all variables from above

### Step 4: Deploy
Click "Create Web Service" and Render will deploy automatically

## Important: Enable MikroTik REST API

The bot communicates with MikroTik via REST API (port 8728/8729).

**Check if it's enabled:**

1. Open Winbox → System → Services
2. Look for **api** (port 8728) or **api-ssl** (port 8729)
3. If not enabled:
   - Check the checkbox next to "api" to enable port 8728
   - OR enable "api-ssl" for encrypted access on port 8729

If you're using port 8729 (SSL), update `.env`:
```
MIKROTIK_PORT=8729
```

## Testing the Bot

### Test Locally
```bash
npm start
```
Watch console for "Created hotspot user" messages

### Test Deployed Version
Use the `/health` endpoint:
```
GET http://your-deployment-url/health
```

Should return:
```json
{
  "status": "healthy",
  "running": true,
  "timestamp": "2026-09-20T...",
  "stats": {
    "processedTransactions": 5,
    "lastPoll": "2026-09-20T..."
  }
}
```

### Manual Poll
```
POST http://your-deployment-url/poll
```

## Monitoring

### View Logs
- **Railway**: Dashboard → Logs tab
- **Render**: Dashboard → Logs tab
- **Local**: Console output

### Check Created Users
1. Open Winbox
2. Go to **IP → Hotspot → Users**
3. New users with transaction IDs should appear

## Troubleshooting

### "Cannot connect to MikroTik"
- Ensure port 8728 is accessible from your cloud server
- Check MikroTik firewall rules allow API access
- Verify credentials in .env

### "Failed to login to ZenFii"
- Double-check username/password
- Ensure ZenFii website is accessible from the server
- Try manual login in browser

### "No transactions found"
- Login to ZenFii manually and verify transactions exist
- Check date range in ZenFii (might be showing old data)
- Ensure your account has completed transactions

### Bot runs but no users created
- Check MikroTik hotspot profile exists (default profile)
- Verify transaction IDs aren't already created in MikroTik
- Check bot logs for errors

## Updating Credentials

If you need to change credentials:

**Local:**
1. Update .env file
2. Restart bot: `npm start`

**Railway/Render:**
1. Update Environment Variables in dashboard
2. Bot will restart automatically

## Production Considerations

1. **Use SSH API** instead of unencrypted API (port 8729)
2. **Set up backups** of processed transactions (the bot tracks them in `processed_transactions.json`)
3. **Monitor logs** regularly for errors
4. **Use secure passwords** - don't commit .env to git
5. **Add webhook notifications** when issues occur

## Support

If issues persist:
1. Enable debug logging (add `DEBUG=*` to environment)
2. Check bot logs for specific error messages
3. Test MikroTik API manually: `curl -u admin:password http://mikrotik-ip:8728/rest/ip/hotspot/user`
4. Test ZenFii login manually in browser
