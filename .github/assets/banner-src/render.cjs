const puppeteer = require(process.env.PUPPETEER);
const [file, out, hash, w, h] = process.argv.slice(2);
(async () => {
  const browser = await puppeteer.launch({ headless: "new", executablePath: process.env.CHROME, args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const page = await browser.newPage();
  await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 2 });
  await page.goto(`file://${file}${hash}`, { waitUntil: "networkidle0" });
  await page.evaluate(() => { if (location.hash === "#dark") document.body.classList.add("dark"); });
  await page.evaluate(async () => { await document.fonts.ready; });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: out });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
