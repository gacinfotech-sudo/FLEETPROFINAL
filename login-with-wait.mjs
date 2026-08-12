import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    
    console.log('Loading page...');
    await page.goto('https://localhost:5050/', {
      waitUntil: 'domcontentloaded'
    });
    
    // Wait for React app and form to load
    console.log('Waiting for login form...');
    try {
      await page.waitForSelector('input[type="text"]', { timeout: 10000 });
      console.log('Login form found!');
    } catch (e) {
      console.log('Form not found with type=text selector, trying alternative...');
      await page.waitForSelector('input', { timeout: 10000 });
      console.log('Found input elements');
    }
    
    // Take screenshot of the loaded form
    await page.screenshot({ path: '/tmp/form-loaded.png', fullPage: true });
    
    // Try to find and fill inputs
    const inputs = await page.locator('input').all();
    console.log('Total inputs on page:', inputs.length);
    
    if (inputs.length >= 2) {
      console.log('Filling first input with "admin"...');
      await inputs[0].fill('admin');
      console.log('Filling second input with "admin"...');
      await inputs[1].fill('admin');
      
      // Find and click sign in button
      const buttons = await page.locator('button').all();
      console.log('Total buttons on page:', buttons.length);
      
      for (let i = 0; i < Math.min(3, buttons.length); i++) {
        const text = await buttons[i].textContent();
        console.log(`Button ${i}: "${text}"`);
        if (text && (text.includes('Sign In') || text.includes('Login'))) {
          console.log('Clicking sign in button...');
          await buttons[i].click();
          break;
        }
      }
      
      // Wait for page to load after login
      await page.waitForTimeout(3000);
      
      // Navigate to payroll
      console.log('Navigating to payroll...');
      await page.goto('https://localhost:5050/dashboard/salary', {
        waitUntil: 'networkidle'
      });
      
      await page.waitForTimeout(2000);
      
      // Take payroll screenshot
      await page.screenshot({ path: '/tmp/payroll_final.png', fullPage: true });
      console.log('Payroll screenshot saved!');
    } else {
      console.log('Could not find input fields');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
