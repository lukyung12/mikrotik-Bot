/**
 * ZenFii ↔ MikroTik Automated Hotspot User Bridge (v2.0)
 * Uses REST API to connect to MikroTik (works with VPN tunnels)
 * Fetches ZenFii transactions and creates users on MikroTik
 */

const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// Configuration
const CONFIG = {
  zenfiiUrl: process.env.ZENFII_URL || 'https://web.zenfii.net',
  zenfiiUsername: process.env.ZENFII_USERNAME || '',
  zenfiiPassword: process.env.ZENFII_PASSWORD || '',
  
  mikrotikHost: process.env.MIKROTIK_HOST || 'vpn4.xenfi.net',
  mikrotikPort: parseInt(process.env.MIKROTIK_PORT || 8728),
  mikrotikUsername: process.env.MIKROTIK_USERNAME || 'admin',
  mikrotikPassword: process.env.MIKROTIK_PASSWORD || '',
  
  pollInterval: parseInt(process.env.POLL_INTERVAL || 120) * 1000,
  hotspotProfile: process.env.HOTSPOT_PROFILE || 'default',
  voucherPassword: process.env.VOUCHER_PASSWORD || 'voucher'
};

// State management
const state = {
  processedTransactions: new Set(),
  lastPollTime: null,
  isRunning: false
};

// Load processed transactions from file
function loadProcessedTransactions() {
  try {
    const filePath = path.join(__dirname, 'processed_transactions.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      state.processedTransactions = new Set(data);
      console.log(`✓ Loaded ${data.length} previously processed transactions`);
    }
  } catch (error) {
    console.error('Error loading processed transactions:', error.message);
  }
}

// Save processed transactions to file
function saveProcessedTransactions() {
  try {
    const filePath = path.join(__dirname, 'processed_transactions.json');
    fs.writeFileSync(filePath, JSON.stringify(Array.from(state.processedTransactions), null, 2));
  } catch (error) {
    console.error('Error saving processed transactions:', error.message);
  }
}

/**
 * Test MikroTik REST API connection
 */
async function testMikroTikConnection() {
  console.log('\n🔗 Testing MikroTik REST API connection...');
  try {
    const url = `http://${CONFIG.mikrotikHost}:${CONFIG.mikrotikPort}/rest/system/identity`;
    const response = await axios({
      method: 'get',
      url: url,
      auth: {
        username: CONFIG.mikrotikUsername,
        password: CONFIG.mikrotikPassword
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      console.log('✓ MikroTik REST API connection successful');
      return true;
    } else {
      console.error(`✗ API returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('✗ Cannot connect to MikroTik:', error.message);
    return false;
  }
}

/**
 * Create Axios client for ZenFii
 */
function createZenFiiClient() {
  return axios.create({
    baseURL: CONFIG.zenfiiUrl,
    auth: {
      username: CONFIG.zenfiiUsername,
      password: CONFIG.zenfiiPassword
    },
    timeout: 15000,
    validateStatus: () => true
  });
}

/**
 * Fetch ZenFii transactions
 */
async function fetchZenFiiTransactions() {
  try {
    console.log('\n📥 Fetching transactions from ZenFii...');
    
    const client = createZenFiiClient();
    
    // Try multiple endpoints
    const endpoints = [
      '/api/v2/customer/transactions',
      '/api/v1/customer/transactions',
      '/api/transactions',
      '/api/billing/transactions',
      '/api/v2/transactions',
      '/api/v1/transactions'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await client.get(endpoint);
        
        if (response.status >= 200 && response.status < 300 && response.data) {
          let transactions = [];
          
          // Try different data structures
          if (Array.isArray(response.data)) {
            transactions = response.data;
          } else if (response.data?.items && Array.isArray(response.data.items)) {
            transactions = response.data.items;
          } else if (response.data?.data && Array.isArray(response.data.data)) {
            transactions = response.data.data;
          } else if (response.data?.transactions && Array.isArray(response.data.transactions)) {
            transactions = response.data.transactions;
          }
          
          if (transactions.length > 0) {
            console.log(`✓ Found ${transactions.length} transaction(s) via ${endpoint}`);
            return transactions;
          }
        }
      } catch (err) {
        // Try next endpoint
      }
    }
    
    console.log('  No transactions found via API endpoints');
    return [];
    
  } catch (error) {
    console.error('❌ Error fetching transactions:', error.message);
    return [];
  }
}

/**
 * Create hotspot user on MikroTik via REST API
 */
async function createMikroTikUser(transactionId) {
  try {
    // Check if user exists
    try {
      const checkUrl = `http://${CONFIG.mikrotikHost}:${CONFIG.mikrotikPort}/rest/ip/hotspot/user?name=${transactionId}`;
      const checkResponse = await axios({
        method: 'get',
        url: checkUrl,
        auth: {
          username: CONFIG.mikrotikUsername,
          password: CONFIG.mikrotikPassword
        },
        timeout: 10000,
        validateStatus: () => true
      });
      
      if (checkResponse.status === 200 && checkResponse.data && checkResponse.data.length > 0) {
        console.log(`  ℹ️  User '${transactionId}' already exists`);
        return false;
      }
    } catch (err) {
      // Continue with creation if check fails
    }

    // Create the user via REST API
    const createUrl = `http://${CONFIG.mikrotikHost}:${CONFIG.mikrotikPort}/rest/ip/hotspot/user`;
    const createResponse = await axios({
      method: 'post',
      url: createUrl,
      auth: {
        username: CONFIG.mikrotikUsername,
        password: CONFIG.mikrotikPassword
      },
      data: {
        name: transactionId,
        profile: CONFIG.hotspotProfile,
        password: CONFIG.voucherPassword
      },
      timeout: 10000,
      validateStatus: () => true
    });
    
    if (createResponse.status >= 200 && createResponse.status < 300) {
      console.log(`✅ Created hotspot user: ${transactionId}`);
      return true;
    } else {
      console.error(`❌ Failed to create user '${transactionId}': API status ${createResponse.status}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error creating user '${transactionId}':`, error.message);
    return false;
  }
}

/**
 * Process a single transaction
 */
async function processTransaction(transaction) {
  const txnId = transaction.id || transaction.transactionId || transaction.payment_id;
  
  if (!txnId) {
    return false;
  }
  
  // Skip if already processed
  if (state.processedTransactions.has(txnId)) {
    return false;
  }
  
  // Create user on MikroTik
  const success = await createMikroTikUser(txnId);
  
  if (success) {
    state.processedTransactions.add(txnId);
    saveProcessedTransactions();
  }
  
  return success;
}

/**
 * Poll for new transactions
 */
async function poll() {
  try {
    console.log(`\n[${new Date().toLocaleString()}] Polling...`);
    
    const transactions = await fetchZenFiiTransactions();
    
    if (transactions.length === 0) {
      console.log('  ℹ️  No transactions found');
      return 0;
    }
    
    let processedCount = 0;
    for (const transaction of transactions) {
      const success = await processTransaction(transaction);
      if (success) processedCount++;
    }
    
    state.lastPollTime = new Date();
    console.log(`✓ Poll complete: ${processedCount} new user(s) created`);
    
    return processedCount;
    
  } catch (error) {
    console.error('❌ Poll error:', error.message);
    return 0;
  }
}

/**
 * Start the bridge
 */
async function start() {
  console.log('════════════════════════════════════════════════════════');
  console.log('ZenFii ↔ MikroTik Automated Hotspot User Bridge');
  console.log('════════════════════════════════════════════════════════');
  console.log(`
Configuration:
  - ZenFii: ${CONFIG.zenfiiUrl}
  - MikroTik: ${CONFIG.mikrotikHost}:${CONFIG.mikrotikPort} (REST API)
  - Poll Interval: ${CONFIG.pollInterval / 1000}s
  - Hotspot Profile: ${CONFIG.hotspotProfile}
  `);
  
  // Load previously processed transactions
  loadProcessedTransactions();
  
  // Test MikroTik connection
  const mikrotikOk = await testMikroTikConnection();
  if (!mikrotikOk) {
    console.error('Cannot start without MikroTik access');
    process.exit(1);
  }
  
  state.isRunning = true;
  let pollCount = 0;
  
  // Web server
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', isRunning: state.isRunning, pollCount, lastPoll: state.lastPollTime });
  });
  
  app.get('/status', (req, res) => {
    res.json({
      isRunning: state.isRunning,
      pollCount,
      lastPollTime: state.lastPollTime,
      processedTransactions: state.processedTransactions.size
    });
  });
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🌐 Web server listening on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
  });
  
  // Start polling
  console.log(`\n🔄 Starting polling loop every ${CONFIG.pollInterval / 1000}s`);
  
  setInterval(async () => {
    pollCount++;
    await poll();
  }, CONFIG.pollInterval);
  
  // Do first poll immediately
  await poll();
}

// Start the bot
start().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
