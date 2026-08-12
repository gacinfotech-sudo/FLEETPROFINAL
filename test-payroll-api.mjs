import https from 'https';

// Ignore certificate errors for self-signed cert
const agent = new https.Agent({
  rejectUnauthorized: false
});

async function testAPI() {
  try {
    console.log('Testing payroll API endpoints...\n');
    
    // Test 1: Check if drivers endpoint works (will return auth error but proves API works)
    console.log('1. Testing /api/drivers (should show auth error):');
    const res1 = await fetch('https://localhost:5050/api/drivers', {
      agent,
      headers: { 'Accept': 'application/json' }
    });
    const data1 = await res1.json();
    console.log(`   Status: ${res1.status}`);
    console.log(`   Response: ${JSON.stringify(data1)}\n`);
    
    // Test 2: Check salary summary endpoint
    console.log('2. Testing /api/finance/salary-summary (payroll endpoint):');
    const res2 = await fetch('https://localhost:5050/api/finance/salary-summary?month=8&year=2026', {
      agent,
      headers: { 'Accept': 'application/json' }
    });
    console.log(`   Status: ${res2.status}`);
    const data2 = await res2.json();
    console.log(`   Response type: ${typeof data2}`);
    if (data2.message) {
      console.log(`   Message: ${data2.message}\n`);
    } else if (data2.success === false) {
      console.log(`   Error: ${data2.error}\n`);
    } else {
      console.log(`   Data keys: ${Object.keys(data2).join(', ')}`);
      if (data2.summary) {
        console.log(`   Summary: ${JSON.stringify(data2.summary)}\n`);
      }
    }
    
    // Test 3: Check driver-salary list endpoint
    console.log('3. Testing /api/driver-salary/list:');
    const res3 = await fetch('https://localhost:5050/api/driver-salary/list', {
      agent,
      headers: { 'Accept': 'application/json' }
    });
    console.log(`   Status: ${res3.status}`);
    const data3 = await res3.json();
    if (data3.message) {
      console.log(`   Message: ${data3.message}\n`);
    } else if (data3.error) {
      console.log(`   Error: ${data3.error}\n`);
    } else {
      console.log(`   Response type: ${typeof data3}`);
      console.log(`   Data keys: ${Object.keys(data3).join(', ')}\n`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();
