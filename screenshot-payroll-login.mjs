import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    
    console.log('Navigating to login page...');
    await page.goto('https://localhost:5050/', {
      waitUntil: 'networkidle'
    });
    
    // Find all input fields
    const inputs = await page.locator('input').all();
    console.log('Found inputs:', inputs.length);
    
    // Try to find input fields by type
    const userIdInput = await page.locator('input[type="text"]').first();
    const passwordInput = await page.locator('input[type="password"]').first();
    
    console.log('Filling credentials...');
    await userIdInput.fill('admin');
    await passwordInput.fill('admin');
    
    // Click the sign in button
    const signInBtn = await page.locator('button').filter({ hasText: /Sign In|Login/i }).first();
    console.log('Clicking sign in...');
    await signInBtn.click();
    
    // Wait for navigation
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {
      console.log('No navigation detected');
    });
    
    await page.waitForTimeout(2000);
    
    // Navigate to payroll
    console.log('Going to payroll page...');
    await page.goto('https://localhost:5050/dashboard/salary', {
      waitUntil: 'networkidle'
    });
    
    await page.waitForTimeout(2000);
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: '/tmp/payroll_authenticated.png', fullPage: true });
    console.log('Screenshot saved');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await browser.close();
  }
})();
