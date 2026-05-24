const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Log page console and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.stack || err));
  
  // Log network request failures and HTTP errors
  page.on('requestfailed', request => {
    console.error(`REQUEST FAILED: ${request.url()} - ${request.failure() ? request.failure().errorText : 'unknown'}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      console.error(`HTTP ERROR ${response.status()}: ${response.url()}`);
    }
  });
  
  // Set a standard desktop resolution
  await page.setViewport({ width: 1280, height: 800 });
  await page.setCacheEnabled(false);

  console.log("Navigating to local server...");
  await page.goto('http://localhost:8080/');
  
  // Wait a bit for the OS to initialize
  await new Promise(r => setTimeout(r, 1000));
  
  // Take screenshot of the lock/login screen
  console.log("Taking screenshot of login screen...");
  await page.screenshot({ path: '/Users/divyanshusinha/.gemini/antigravity-ide/brain/dc6fe00c-ce99-4995-94e0-a070899a72d3/login_screen.png' });

  // Try to log in
  console.log("Attempting to login with password '1234'...");
  
  // We need to find the password input. In ui.js: id="lock-password"
  // If it's a prompt or a login form:
  try {
    await page.type('#lock-password', '1234');
    await page.keyboard.press('Enter');
    
    // Wait for unlock animation
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Taking screenshot of desktop...");
    await page.screenshot({ path: '/Users/divyanshusinha/.gemini/antigravity-ide/brain/dc6fe00c-ce99-4995-94e0-a070899a72d3/desktop.png' });
    
  } catch (err) {
    console.error("Error during login interaction:", err);
  }

  await browser.close();
  console.log("Done.");
})();
