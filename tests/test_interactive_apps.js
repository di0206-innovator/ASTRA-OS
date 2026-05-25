const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || '/Users/divyanshusinha/.gemini/antigravity-ide/brain/4cc533f9-5d58-4dec-9dc1-a131d096d858';
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.stack || err));
  
  await page.setViewport({ width: 1280, height: 800 });
  await page.setCacheEnabled(false);

  console.log("Navigating to local server...");
  await page.goto('http://localhost:8080/');
  await new Promise(r => setTimeout(r, 1000));
  
  console.log("Logging in...");
  await page.type('#lock-password', '1234');
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 2000));

  console.log("Opening App Store...");
  await page.click('.dock-item[data-app="appstore"]');
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot before install
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'appstore_open.png') });

  console.log("Installing Astro Defender (astroid)...");
  // Find the button with data-pkg="astroid" inside the app store and click it via DOM
  await page.evaluate(() => {
    const btn = document.querySelector('.btn[data-pkg="astroid"]');
    if (btn) btn.click();
  });
  console.log("Waiting for installation simulation...");
  await new Promise(r => setTimeout(r, 2000)); // wait for 2 seconds (simulated 1.5s installation)

  // Verify the shortcut exists in the dock
  const hasDockItem = await page.evaluate(() => {
    return !!document.getElementById('dock-astroid');
  });
  console.log("Astro Defender dock shortcut appended:", hasDockItem);

  console.log("Launching Astro Defender from dock...");
  await page.click('#dock-astroid');
  await new Promise(r => setTimeout(r, 1000));

  console.log("Starting defense game...");
  await page.click('#astroid-play-btn');
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot of the game running
  console.log("Taking screenshot of Astro Defender gameplay...");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'astroid_gameplay.png') });

  console.log("Closing Astro Defender game window...");
  await page.click('.window[data-app="astroid"] .dot-close');
  await new Promise(r => setTimeout(r, 500));

  console.log("Debugging: Checking packages in DOM...");
  const pkgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-pkg]')).map(btn => ({
      pkg: btn.getAttribute('data-pkg'),
      text: btn.textContent,
      visible: btn.offsetWidth > 0 && btn.offsetHeight > 0
    }));
  });
  console.log("Packages in DOM:", JSON.stringify(pkgs, null, 2));

  console.log("Installing PulseWave (pulsewave)...");
  // Find the button with data-pkg="pulsewave" inside the app store and click it via DOM
  await page.evaluate(() => {
    const btn = document.querySelector('.btn[data-pkg="pulsewave"]');
    if (btn) btn.click();
  });
  console.log("Waiting for installation simulation...");
  await new Promise(r => setTimeout(r, 2000));

  // Verify the shortcut exists in the dock
  const hasPulsewaveDock = await page.evaluate(() => {
    return !!document.getElementById('dock-pulsewave');
  });
  console.log("PulseWave dock shortcut appended:", hasPulsewaveDock);

  console.log("Launching PulseWave from dock...");
  await page.click('#dock-pulsewave');
  await new Promise(r => setTimeout(r, 1000));

  console.log("Starting Audio Engine in PulseWave...");
  await page.click('#pw-start-audio');
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot of PulseWave player running
  console.log("Taking screenshot of PulseWave Synth player...");
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pulsewave_active.png') });

  await browser.close();
  console.log("Interactive test completed.");
})();
