import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    
    console.log('Navigating to login...');
    await page.goto('https://localhost:5050/', {
      waitUntil: 'domcontentloaded'
    });
    
    await page.waitForTimeout(1000);
    
    // Try with admin/admin credentials (common default)
    console.log('Attempting login with admin credentials...');
    await page.fill('input[placeholder*="User ID"]', 'admin');
    await page.fill('input[placeholder*="password"]', 'admin');
    
    // Click sign in button
    await page.click('button:has-text("Sign In to Dashboard")');
    
    // Wait for navigation or error
    await page.waitForTimeout(3000);
    
    // Check if login was successful by looking for dashboard elements
    const currentUrl = page.url();
    console.log('Current URL after login attempt:', currentUrl);
    
    // Try to navigate to payroll page
    console.log('Navigating to payroll page...');
    await page.goto('https://localhost:5050/dashboard/salary', {
      waitUntil: 'domcontentloaded'
    });
    
    await page.waitForTimeout(2000);
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: '/tmp/payroll_screenshot_auth.png', fullPage: true });
    console.log('Screenshot saved');
    
    // Get page content for debugging
    const title = await page.title();
    console.log('Page title:', title);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
