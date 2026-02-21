const { chromium, devices } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const { faker } = require('@faker-js/faker');
const path = require('path');
const fs = require('fs');

chromium.use(stealth);

async function run() {
    console.log("🚀 Launching Authentic Browser with Persistent Profile...");

    const context = await chromium.launchPersistentContext('./google_session', {
        headless: false,
        args: ['--no-sandbox'],
        viewport: null,
        acceptDownloads: true,
        permissions: ['clipboard-read', 'clipboard-write']
    });

    const page = context.pages()[0] || await context.newPage();

    const humanType = async (locator, text) => {
        await locator.click();
        await page.keyboard.type(text, { delay: Math.floor(Math.random() * 100) + 50 });
    };

    const randomWait = () => page.waitForTimeout(Math.floor(Math.random() * 2000) + 1000);

    // 1. Name Section
    await page.goto('https://accounts.google.com/signup', { waitUntil: 'networkidle' });
    await randomWait();

    console.log("📝 Filling Name...");
    await humanType(page.getByLabel('First name'), faker.person.firstName());
    await humanType(page.getByLabel('Last name'), faker.person.lastName());
    await randomWait();
    await page.getByRole('button', { name: 'Next' }).click();

    // 2. DOB Section
    console.log("🎂 Selecting Month and Gender...");
    try {
        await page.waitForSelector('#month', { timeout: 8000 });
        await page.locator('#month').click();
        await page.getByRole('option', { name: 'April' }).click();
        await randomWait();

        await humanType(page.getByLabel('Day'), '06');
        await humanType(page.getByLabel('Year'), '2000');
        await randomWait();

        await page.locator('#gender').click();
        await page.getByRole('option', { name: 'Male', exact: true }).click();
        await randomWait();
        await page.getByRole('button', { name: 'Next' }).click();
    } catch (e) {
        console.log("⚠️ Selector issue, check browser for blocks.");
    }

    // 3. Email Selection
    console.log("📧 Moving to Email Selection...");
    try {
        const existingEmailBtn = page.getByRole('button', { name: 'Use your existing email' });
        await existingEmailBtn.waitFor({ state: 'visible', timeout: 8000 });
        await randomWait();
        await existingEmailBtn.click();
    } catch (e) {
        console.log("⚠️ Manual intervention might be needed for email choice.");
    }

    // 4. Manual OTP Phase
    console.log("📩 STOP: Enter the Email and OTP manually in the browser now.");

    // 5. Wait for Password field
    const passwordField = page.locator('input[name="Passwd"]');
    await passwordField.waitFor({ state: 'visible', timeout: 300000 });

    console.log("🔑 Password page detected. Filling automatically...");
    const myPassword = "MySecureP@ssw0rd!";
    await randomWait();
    await humanType(passwordField, myPassword);
    await humanType(page.locator('input[name="PasswdAgain"]'), myPassword);
    await randomWait();
    // After password Next click
    await page.getByRole('button', { name: 'Next' }).click();

    // 6. Wait specifically for the QR code page
    console.log("⏳ Waiting for QR code page to fully load...");

    // Wait for the QR image to actually appear on the page
    await page.waitForSelector('img[src*="qr"]', { timeout: 120000 }).catch(() => {
        console.log("⚠️ QR image selector not found, trying alternative...");
    });

    // Extra wait to ensure the QR is fully rendered
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // 7. NOW take the screenshot
    console.log("📸 QR page confirmed. Taking screenshot...");
    const screenshotDir = './screenshots';
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);
    const screenshotPath = path.resolve(`${screenshotDir}/qr-page.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Screenshot saved: ${screenshotPath}`);

    // 8. Open ScanQR tab and upload the screenshot
    console.log("🔍 Opening QR scanner tab...");
    const scanPage = await context.newPage();
    await scanPage.goto('https://scanqr.org/', { waitUntil: 'domcontentloaded' }); // 👈 Fixed timeout issue
    await scanPage.waitForTimeout(2000);

    console.log("📂 Uploading screenshot to QR scanner...");
    const fileInput = scanPage.locator('#file-selector');
    await fileInput.setInputFiles(screenshotPath);
    await scanPage.waitForTimeout(3000);

    // 9. Click Copy Results - specifically the one in the #scan section
    console.log("📋 Clicking Copy Results...");
    await scanPage.locator('#scan').getByRole('button', { name: /Copy Results/i }).click(); // 👈 Fixed strict mode error
    await scanPage.waitForTimeout(1000);

    // 10. Read clipboard content
    console.log("📎 Reading clipboard...");
    const qrUrl = await scanPage.evaluate(() => navigator.clipboard.readText());
    console.log(`✅ QR URL decoded: ${qrUrl}`);

    // 11. Open Browserling and test the URL
    console.log(":globe_with_meridians: Opening Browserling...");
    const browserlingPage = await context.newPage();
    await browserlingPage.goto('https://www.browserling.com/', { waitUntil: 'networkidle' });
    await browserlingPage.waitForTimeout(2000);

    // Paste the QR URL into the input
    console.log(":memo: Pasting QR URL into Browserling...");
    const urlInput = browserlingPage.locator('input[placeholder="http://"]');
    await urlInput.fill(qrUrl);

    // Select Android 11 from dropdown
    console.log(":iphone: Selecting Android 11...");
    const osDropdown = browserlingPage.locator('.dropdown-selected').first();
    await osDropdown.click();
    await browserlingPage.waitForTimeout(1000);
    await browserlingPage.getByText('Android 11', { exact: true }).click();
    await browserlingPage.waitForTimeout(1000);

    // Click Test Now
    console.log(":rocket: Clicking Test Now...");
    await browserlingPage.getByRole('button', { name: 'Test now!' }).click();

    // ─── NEW: Wait for the virtual device canvas to load ───────────────────────

    console.log(":hourglass_flowing_sand: Waiting for Android device canvas to appear...");

    // Browserling renders the device in a canvas — wait for it
    const canvas = browserlingPage.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 60000 });

    // Give it extra time to fully boot the Android screen
    await browserlingPage.waitForTimeout(8000);
    console.log(":iphone: Android device loaded!");

    // Get canvas bounding box so we can calculate tap positions
    const canvasBox = await canvas.boundingBox();
    console.log(`:triangular_ruler: Canvas: x=${canvasBox.x}, y=${canvasBox.y}, w=${canvasBox.width}, h=${canvasBox.height}`);

    // Helper: tap at a percentage position within the canvas
    // e.g. tapOnCanvas(0.5, 0.5) taps the dead center of the device screen
    const tapOnCanvas = async (xPercent, yPercent, label = '') => {
        const tapX = canvasBox.x + canvasBox.width * xPercent;
        const tapY = canvasBox.y + canvasBox.height * yPercent;
        console.log(`:point_up_2: Tapping ${label} at (${tapX.toFixed(0)}, ${tapY.toFixed(0)})`);
        await browserlingPage.mouse.click(tapX, tapY);
        await browserlingPage.waitForTimeout(1500);
    };

    // ─── STEP: The QR link opens in Android browser ─────────────────────────────
    // Google Authenticator setup flow typically shows:
    //   1. A dialog or button asking to "Send SMS" or "Use SMS"
    //   2. A confirm/allow button

    // Tap center of screen first to dismiss any loading overlay
    await tapOnCanvas(0.5, 0.5, 'center - dismiss overlay');
    await browserlingPage.waitForTimeout(2000);

    // "Send SMS" button is usually in the lower-center area of the screen
    // Adjust these percentages based on where the button visually appears
    await tapOnCanvas(0.5, 0.75, '"Send SMS" button area');
    await browserlingPage.waitForTimeout(2000);

    // If there's a confirmation dialog ("Allow" / "OK")
    await tapOnCanvas(0.65, 0.72, '"Allow/OK" dialog button');
    await browserlingPage.waitForTimeout(2000);

    // ─── SCREENSHOT: Capture what happened ──────────────────────────────────────
    console.log(":camera_with_flash: Taking screenshot of Android result...");
    const resultPath = path.resolve('./screenshots/android-result.png');
    await browserlingPage.screenshot({ path: resultPath, fullPage: true });
    console.log(`:white_check_mark: Screenshot saved: ${resultPath}`);

    console.log(":white_check_mark: All steps complete!");}
    run().catch(console.error);
    