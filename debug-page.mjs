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
      waitUntil: 'load'
    });
    
    // Wait for React to render
    await page.waitForTimeout(5000);
    
    // Check page HTML content
    const content = await page.content();
    const hasInputs = content.includes('<input');
    const hasForm = content.includes('Welcome Back');
    const hasRoot = content.includes('id="root"');
    
    console.log('Page has input elements:', hasInputs);
    console.log('Page has "Welcome Back":', hasForm);
    console.log('Page has root div:', hasRoot);
    console.log('Page length:', content.length);
    
    // Take screenshot to see what's rendered
    await page.screenshot({ path: '/tmp/debug-page.png', fullPage: true });
    console.log('Debug screenshot saved');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
