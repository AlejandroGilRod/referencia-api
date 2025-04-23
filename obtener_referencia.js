import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

chromium.use(StealthPlugin());

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.2151.92'
];

function validarFecha(dd, mm, yyyy) {
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  const currentYear = new Date().getFullYear();

  if (isNaN(day) || day < 1 || day > 31) throw new Error(`Día inválido: ${dd}`);
  if (isNaN(month) || month < 1 || month > 12) throw new Error(`Mes inválido: ${mm}`);
  if (isNaN(year) || year < currentYear - 1 || year > currentYear + 10) throw new Error(`Año inválido: ${yyyy}`);

  const fechaInput = new Date(Date.UTC(year, month - 1, day));
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);

  if (fechaInput.getUTCFullYear() !== year || fechaInput.getUTCMonth() !== month - 1 || fechaInput.getUTCDate() !== day) {
    throw new Error(`Fecha inválida en el calendario: ${dd}-${mm}-${yyyy}`);
  }
  if (fechaInput <= hoy) {
    const hoyStr = `${String(hoy.getUTCDate()).padStart(2, '0')}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}-${hoy.getUTCFullYear()}`;
    throw new Error(`La fecha debe ser futura (posterior a ${hoyStr}).`);
  }
  return true;
}

async function humanMoveToElement(page, selector) {
  await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  const element = await page.$(selector);
  if (!element) throw new Error(`Elemento no encontrado: ${selector}`);
  let box = await element.boundingBox();

  if (!box) {
    await page.evaluate(sel => {
      document.querySelector(sel)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }, selector);
    await page.waitForTimeout(800 + Math.random() * 700);
    box = await element.boundingBox();
    if (!box) throw new Error(`No se pudo obtener boundingBox para: ${selector}`);
  }

  const viewport = page.viewportSize();
  const startX = Math.random() * viewport.width;
  const startY = Math.random() * viewport.height;
  const targetX = box.x + (box.width * (0.3 + Math.random() * 0.4));
  const targetY = box.y + (box.height * (0.3 + Math.random() * 0.4));
  const steps = 12 + Math.floor(Math.random() * 18);

  await page.mouse.move(startX, startY);
  await page.waitForTimeout(60 + Math.random() * 110);
  await page.mouse.move(targetX, targetY, { steps });
  await page.waitForTimeout(220 + Math.random() * 380);
}

async function humanTypeWithValidation(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 15000, state: 'visible' });
  const element = await page.$(selector);
  if (!element) throw new Error(`Elemento no encontrado para escribir: ${selector}`);

  await humanMoveToElement(page, selector);
  await element.click({ delay: 70 + Math.random() * 120 });
  await page.waitForTimeout(300 + Math.random() * 400);

  await element.click({ clickCount: 3, delay: 100 + Math.random() * 90 });
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(250 + Math.random() * 350);

  await element.type(text, { delay: 85 + Math.random() * 145 });
  await page.waitForTimeout(400 + Math.random() * 500);

  let enteredValue = await page.$eval(selector, el => el.value);
  if (enteredValue !== text) {
    await page.evaluate((sel, val) => {
      const input = document.querySelector(sel);
      if (input) input.value = val;
    }, selector, text);
    await page.waitForTimeout(350);
    enteredValue = await page.$eval(selector, el => el.value);
    if (enteredValue !== text) {
      throw new Error(`No se pudo corregir valor en ${selector}. Final: ${enteredValue}`);
    }
  }

  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }, selector);
  await page.waitForTimeout(400 + Math.random() * 400);
}

async function typeNativeDate(page, selector, dd, mm, yyyy) {
  const isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  console.log(`⌨️ Insertando fecha en formato ISO: ${isoDate}`);

  await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });
  await page.fill(selector, isoDate);

  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }, selector);

  console.log('✅ Fecha insertada correctamente.');
}


async function getReferencia(dni, fechaValidez, valorCasilla) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(fechaValidez)) {
    console.error('❌ Formato de fecha inválido. Usa DD-MM-YYYY');
    return null;
  }
  const [dd, mm, yyyy] = fechaValidez.split('-');
  try {
    validarFecha(dd, mm, yyyy);
  } catch (e) {
    console.error(`❌ Fecha inválida: ${e.message}`);
    return null;
  }

  const browser = await chromium.launch({
    headless: true,
   // slowMo: 100,
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    locale: 'es-ES',
    userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  try {
    const url = 'https://www2.agenciatributaria.gob.es/wlpl/BUCV-JDIT/AutenticaDniNieContrasteh?ref=%2Fwlpl%2FDABJ-REN0%2FObtenerReferenciaServlet%3Fref%3D%252Fwlpl%252FDFPA-D182%252FSvVisDF24Net';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await humanTypeWithValidation(page, 'input[name="NIF"]', dni);
    await typeNativeDate(page, '#FECHA', dd, mm, yyyy);
    await page.waitForTimeout(1000);

    await humanMoveToElement(page, 'button#botonContinuar');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
      page.click('button#botonContinuar')
    ]);

    await page.waitForSelector('input[name="casilla"]', { timeout: 30000 });
    await humanTypeWithValidation(page, 'input[name="casilla"]', valorCasilla);

    await humanMoveToElement(page, 'input#boton_Obtener');
    const [_, resultElement] = await Promise.all([
      page.click('input#boton_Obtener'),
      page.waitForSelector('span[style*="font-size: 1.5em"]', { timeout: 30000 }),
    ]);

    const referencia = await resultElement.textContent();
    console.log(`✅ Referencia obtenida: ${referencia}`);

    console.log('➡️ Haciendo clic en botón "Continuar"...');
    await page.click('input.AEAT_boton_main');
    await page.waitForURL('**/SvVisDF24Net', { timeout: 10000 });

    await page.pdf({ path: 'pagina_final.pdf', format: 'A4', printBackground: true, scale: 0.85 });
    console.log('✅ PDF guardado como pagina_final.pdf');

    return referencia;

  } catch (e) {
    console.error('❌ Error general:', e.message);
    return null;
  } finally {
    await browser.close();
    console.log('🧹 Navegador cerrado.');
  }
}

export { getReferencia };
