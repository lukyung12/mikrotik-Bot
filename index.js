/**
 * ZenFii ↔ MikroTik Automated Hotspot User Bridge (LOCAL VERSION)
 * Runs locally on Windows - connects to MikroTik via local network
 * Fetches ZenFii transactions and creates users on MikroTik
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

// Configuration
const CONFIG = {
  zenfiiUrl: process.env.ZENFII_URL || 'https://web.zenfii.net',
  zenfiiUsername: process.env.ZENFII_USERNAME || '',
  zenfiiPassword: process.env.ZENFII_PASSWORD || '',
  
  mikrotikHost: process.env.MIKROTIK_HOST || '10.128.10.1',
  mikrotikPort: parseInt(process.env.MIKROTIK_PORT || 22),
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
 * Execute SSH command on MikroTik
 */
async function executeSshCommand(command) {
  return new Promise((resolve, reject) => {
    const sshArgs = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-p', CONFIG.mikrotikPort.toString(),
      `${CONFIG.mikrotikUsername}@${CONFIG.mikrotikHost}`,
      command
    ];

    const ssh = spawn('ssh', sshArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000
    });

    let stdout = '';
    let stderr = '';

    // Send password via stdin
    ssh.stdin.write(`${CONFIG.mikrotikPassword}\n`);
    ssh.stdin.end();

    ssh.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ssh.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ssh.on('close', (code) => {
      if (code === 0 || stdout) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `SSH command failed with code ${code}`));
      }
    });

    ssh.on('error', (error) => {
      reject(error);
    });

    // Handle timeout
    setTimeout(() => {
      ssh.kill();
      reject(new Error('SSH command timeout'));
    }, 15000);
  });
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
 * Create hotspot user on MikroTik via SSH
 */
async function createMikroTikUser(transactionId) {
  try {
    // Check if user exists
    try {
      const listCommand = `/ip hotspot user print where name="${transactionId}"`;
      const result = await executeSshCommand(listCommand);
      if (result && result.includes(transactionId)) {
        console.log(`  ℹ️  User '${transactionId}' already exists`);
        return false;
      }
    } catch (err) {
      // Continue with creation
    }

    // Create the user
    const createCommand = `/ip hotspot user add name="${transactionId}" profile="${CONFIG.hotspotProfile}" password="${CONFIG.voucherPassword}"`;
    
    try {
      await executeSshCommand(createCommand);
      console.log(`✅ Created hotspot user: ${transactionId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create user '${transactionId}': ${error.message}`);
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
 * Test MikroTik connection
 */
async function testMikroTikConnection() {
  console.log(`\n🔗 Testing MikroTik SSH connection (${CONFIG.mikrotikHost}:${CONFIG.mikrotikPort})...`);
  try {
    const result = await executeSshCommand('system identity print');
    if (result && result.length > 0) {
      console.log('✓ MikroTik SSH connection successful');
      return true;
    }
  } catch (error) {
    console.error('✗ Cannot connect to MikroTik:', error.message);
    return false;
  }
}

/**
 * Start the bridge
 */
async function start() {
  console.log('════════════════════════════════════════════════════════');
  console.log('ZenFii ↔ MikroTik Automated Hotspot User Bridge');
  console.log('LOCAL VERSION (Windows)');
  console.log('════════════════════════════════════════════════════════');
  console.log(`
Configuration:
  - ZenFii: ${CONFIG.zenfiiUrl}
  - MikroTik: ${CONFIG.mikrotikHost}:${CONFIG.mikrotikPort} (Local Network)
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
  
  console.log(`\n🔄 Starting polling loop every ${CONFIG.pollInterval / 1000}s`);
  console.log('Press Ctrl+C to stop\n');
  
  // Start polling
  setInterval(async () => {
    pollCount++;
    await poll();
  }, CONFIG.pollInterval);
  
  // Do first poll immediately
  await poll();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down gracefully...');
  saveProcessedTransactions();
  process.exit(0);
});

// Start the bot
start().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
