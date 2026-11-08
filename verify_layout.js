import { chromium } from 'playwright';

(async () => {
  console.log('Starting Playwright browser verification...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const testViewports = [
    { width: 1920, height: 1080, name: 'desktop-1080p' },
    { width: 1440, height: 900, name: 'laptop-1440' },
    { width: 1024, height: 768, name: 'tablet-1024' }
  ];

  for (const vp of testViewports) {
    console.log(`\nTesting viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Verify Top Bar Navigation Links
    const navText = await page.textContent('nav');
    console.log(`Top nav text: "${navText?.replace(/\s+/g, ' ').trim()}"`);
    const hasWebSerialHubLink = await page.isVisible('nav a:has-text("Web Serial Hub")').catch(() => false);
    const hasThemesWidgetsLink = await page.isVisible('nav a:has-text("Themes & Widgets")').catch(() => false);
    console.log(`Navbar has "Web Serial Hub" link? ${hasWebSerialHubLink} (Should be false)`);
    console.log(`Navbar has "Themes & Widgets" link? ${hasThemesWidgetsLink} (Should be false)`);

    // 2. Check the Python Suite Card Layout & Dimensions
    const pythonCard = page.locator('text=Standalone Python Suite: Native Windows & macOS Monitors').locator('xpath=ancestor::div[contains(@class, "border-cyan-500")]');
    const cardBox = await pythonCard.boundingBox();
    console.log(`Python Suite Card bounding box:`, cardBox);

    // Check all buttons inside that card
    const buttons = pythonCard.locator('button, a');
    const buttonCount = await buttons.count();
    console.log(`Buttons inside Python Suite card: ${buttonCount}`);

    let overflowDetected = false;
    for (let i = 0; i < buttonCount; i++) {
      const btn = buttons.nth(i);
      const btnBox = await btn.boundingBox();
      const btnText = await btn.textContent();
      if (cardBox && btnBox) {
        const isOverflowingRight = btnBox.x + btnBox.width > cardBox.x + cardBox.width + 2;
        const isOverflowingLeft = btnBox.x < cardBox.x - 2;
        console.log(` - Button "${btnText?.trim()}": x=${btnBox.x.toFixed(1)}, width=${btnBox.width.toFixed(1)}, right=${(btnBox.x + btnBox.width).toFixed(1)} vs cardRight=${(cardBox.x + cardBox.width).toFixed(1)} -> Overflow: ${isOverflowingRight}`);
        if (isOverflowingRight || isOverflowingLeft) overflowDetected = true;
      }
    }

    // 3. Check for any page horizontal scrolling (overflowing body)
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowInnerWidth = await page.evaluate(() => window.innerWidth);
    console.log(`Page body scrollWidth: ${bodyScrollWidth} vs window innerWidth: ${windowInnerWidth}`);
    const pageHorizontalScroll = bodyScrollWidth > windowInnerWidth;
    console.log(`Page has horizontal scroll? ${pageHorizontalScroll}`);

    // Take screenshot
    const screenshotPath = `public/assets/playwright_${vp.name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot to ${screenshotPath}`);

    if (overflowDetected) {
      console.error(`❌ Overflow detected in viewport ${vp.name}!`);
    } else {
      console.log(`✅ No overflow in viewport ${vp.name}! Perfect layout.`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\nPlaywright verification complete!');
})();
