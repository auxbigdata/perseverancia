// Revisión automática: abre la página en Chrome invisible, guarda una captura y lista los errores
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Si el servidor no está prendido, lo arrancamos nosotros
let servidor = null;
try {
  await fetch(URL);
} catch {
  const { createServer } = await import('vite');
  servidor = await createServer({ server: { port: 5173 } });
  await servidor.listen();
}

// Chrome invisible con WebGL por software (funciona sin tarjeta gráfica)
const navegador = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 } });

// Juntamos todos los errores: consola, excepciones, red y archivos que faltan
const errores = [];
pagina.on('console', (m) => { if (m.type() === 'error') errores.push(`[consola] ${m.text()}`); });
pagina.on('pageerror', (e) => errores.push(`[página] ${e.message}`));
pagina.on('requestfailed', (r) => errores.push(`[red] ${r.url()} ${r.failure()?.errorText}`));
pagina.on('response', (r) => { if (r.status() >= 400) errores.push(`[${r.status()}] ${r.url()}`); });

await pagina.goto(URL, { waitUntil: 'load' });
await pagina.waitForTimeout(4000);

mkdirSync('screenshots', { recursive: true });
await pagina.screenshot({ path: 'screenshots/check.png' });
await navegador.close();
if (servidor) await servidor.close();

console.log('Captura guardada en screenshots/check.png');
if (errores.length) {
  console.log(`\n${errores.length} error(es):`);
  errores.forEach((e) => console.log(' - ' + e));
  process.exit(1);
}
console.log('0 errores');
