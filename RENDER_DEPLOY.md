# ZenFii ↔ MikroTik Bridge - Render.com Deployment

## Quick Deployment (5 minutes)

### Step 1: Create GitHub Repository

```bash
cd C:\Users\mwaka
git init
git add -A
git commit -m "Initial zenfii-mikrotik-bridge"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/zenfii-mikrotik-bridge.git
git push -u origin main
```

### Step 2: Deploy on Render.com

1. **Go to** https://render.com
2. **Sign up** with GitHub account
3. **Connect** your GitHub repo
4. **Create** → **Web Service**
5. Select your `zenfii-mikrotik-bridge` repository
6. Fill in:
   - **Name**: `zenfii-mikrotik-bridge`
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### Step 3: Add Environment Variables

In Render dashboard:
- Go to your Web Service
- Click **Environment**
- Add these variables:

```
ZENFII_URL=https://web.zenfii.net
ZENFII_USERNAME=lukeyung1@outlook.com
ZENFII_PASSWORD=1714@Con2
MIKROTIK_HOST=vpn4.xenfi.net
MIKROTIK_PORT=33548
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=Sycho123
POLL_INTERVAL=120
HOTSPOT_PROFILE=default
VOUCHER_PASSWORD=voucher
PORT=3000
```

### Step 4: Deploy

Click **Deploy** button. Render will:
- Clone your GitHub repo
- Install dependencies
- Start the bot
- Keep it running 24/7

### Step 5: Monitor

- Render Dashboard shows live logs
- Click **Logs** tab to watch bot output
- You'll see when bot creates users

---

## What Happens Next

Once deployed, the bot will:

1. **Every 2 minutes:**
   - Connect to ZenFii via SSH (vpn4.xenfi.net:33548)
   - Fetch completed transactions
   - Create MikroTik hotspot users

2. **Your customers get:**
   - Automatic access when they pay
   - No manual voucher delays
   - Username = Transaction ID
   - Password = `voucher`

---

## Important Notes

⚠️ **Security**
- `.env` is in `.gitignore` (won't be pushed to GitHub)
- Add variables directly in Render dashboard
- Never commit `.env` to Git

✅ **Testing Before Production**
- Test locally first: `npm start`
- Verify bot creates users
- Then deploy to Render

✅ **Monitoring**
- Check Render logs for errors
- Verify Winbox shows new users
- Test customer login

---

## File Structure Pushed to GitHub

```
zenfii-mikrotik-bridge/
├── index.js              # Main bot code
├── package.json          # Dependencies
├── .env.example          # Template (don't include real .env!)
├── .gitignore            # Excludes .env and node_modules
├── README.md             # Documentation
├── QUICK_START.md        # Quick reference
└── DEPLOYMENT_*.md       # Deployment guides
```

---

## Troubleshooting Render Deployment

### "Build failed"
- Check `npm install` completes successfully
- Verify package.json is in root directory
- Check Node version compatibility

### "Bot won't start"
- Check Render logs for error messages
- Verify all environment variables are set
- Test bot locally first: `npm start`

### "Cannot connect to MikroTik"
- Verify `vpn4.xenfi.net:33548` is accessible from Render servers
- Confirm credentials are correct
- Check if SSH key auth is needed (currently using password)

### "ZenFii connection fails"
- Verify ZenFii username/password
- Check if API endpoints changed
- Manually test login in browser

---

## Logs in Render

Click **Logs** in your Render dashboard to see:

```
[timestamp] 📥 Fetching transactions from ZenFii...
[timestamp] ✓ Found 3 transaction(s)
[timestamp] → Processing transaction: 4363864731
[timestamp] ✅ Created hotspot user: 4363864731
[timestamp] ✓ Poll complete: 1 new user(s) created
```

---

## Updating Code

After deployment, if you want to update:

1. Make changes locally
2. `git add -A && git commit -m "Update"`
3. `git push`
4. Render auto-redeploys! 

---

## Free Tier Limits

Render's free tier:
- ✅ 750 compute hours/month
- ✅ Free SSL certificate  
- ✅ Auto-deploys on GitHub push
- ⚠️ Spins down after 15 minutes of inactivity (can delay first request)

For production use (always on), upgrade to paid tier ($7-15/month).

---

## Success Indicators

You'll know it's working when:
- ✅ Render dashboard shows "deployed"
- ✅ Logs show successful MikroTik connection
- ✅ New hotspot users appear in Winbox
- ✅ Customers can log in with transaction ID

---

**Ready to deploy? Start with Step 1!**
