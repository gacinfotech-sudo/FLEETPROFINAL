import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    
    console.log('Navigating to payroll page...');
    await page.goto('https://localhost:5050/dashboard/salary', {
      waitUntil: 'domcontentloaded'
    });
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: '/tmp/payroll_screenshot.png', fullPage: true });
    console.log('Screenshot saved to /tmp/payroll_screenshot.png');
    
    // Get page title and body content for verification
    const title = await page.title();
    const bodyText = await page.textContent('body');
    console.log('Page title:', title);
    console.log('Page loaded successfully');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
