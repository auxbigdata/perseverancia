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
const mensajes = [];
pagina.on('console', (m) => {
  if (m.type() === 'error') errores.push(`[consola] ${m.text()}`);
  else if (m.type() === 'log') mensajes.push(m.text());
});
pagina.on('pageerror', (e) => errores.push(`[página] ${e.message}`));
pagina.on('requestfailed', (r) => errores.push(`[red] ${r.url()} ${r.failure()?.errorText}`));
pagina.on('response', (r) => { if (r.status() >= 400) errores.push(`[${r.status()}] ${r.url()}`); });

await pagina.goto(URL, { waitUntil: 'load' });

// Esperar a que cargue el rover (si no carga, se anota como error)
try {
  await pagina.waitForFunction(() => window.roverListo, null, { timeout: 60000 });
} catch {
  errores.push('[rover] el modelo no terminó de cargar en 60 s');
}

// Prueba de manejo: avanzar con W hasta recorrer 15 m para que deje huellas
// (en Chrome invisible se dibuja lento, por eso se espera por distancia y no por tiempo)
await pagina.keyboard.down('KeyW');
try {
  await pagina.waitForFunction(() => window.recorridoTotal > 15, null, { timeout: 90000 });
} catch {
  errores.push('[manejo] el rover no avanzó 15 m con la tecla W');
}
await pagina.keyboard.up('KeyW');
await pagina.waitForTimeout(1500);

// Control de misión: los 4 datos deben tener un número real
const DATOS_MISION = ['distancia', 'altura', 'inclinacion', 'luz'];
let datosMision = {};
try {
  await pagina.waitForFunction(
    (claves) => claves.every((c) => Number.isFinite(window.controlMision?.datos[c]?.valor)),
    DATOS_MISION,
    { timeout: 30000 }
  );
} catch {
  // se informa abajo cuál faltó
}
datosMision = await pagina.evaluate(() => window.controlMision?.datos ?? {});
for (const clave of DATOS_MISION) {
  const d = datosMision[clave];
  if (!d || !Number.isFinite(d.valor)) errores.push(`[control de misión] el dato "${clave}" no cargó`);
}

mkdirSync('screenshots', { recursive: true });
await pagina.screenshot({ path: 'screenshots/check.png', timeout: 120000 }); // sin GPU cada cuadro tarda

// La tecla T oculta el panel y lo vuelve a mostrar
const panelVisible = () => pagina.evaluate(() => {
  const p = document.getElementById('control-mision');
  return !!p && getComputedStyle(p).display !== 'none';
});
const visibleAntes = await panelVisible();
await pagina.keyboard.press('KeyT');
const visibleTrasT = await panelVisible();
await pagina.keyboard.press('KeyT');
const visibleTras2T = await panelVisible();
if (!visibleAntes) errores.push('[control de misión] el panel no se ve al empezar');
if (visibleTrasT) errores.push('[control de misión] la tecla T no ocultó el panel');
if (!visibleTras2T) errores.push('[control de misión] la tecla T no volvió a mostrar el panel');

// Cámaras: clic en cada punto, esperar a que llegue la foto real, y Esc para volver
const CAMARAS = ['Mastcam_Z_cams', 'NavCams', 'hazcams_front', 'WATSON'];
const fotosAbiertas = [];
try {
  await pagina.waitForFunction(() => window.camarasListas, null, { timeout: 30000 });
} catch {
  errores.push('[cámaras] los puntos de las cámaras no aparecieron');
}
for (const cam of CAMARAS) {
  try {
    const punto = pagina.locator(`.punto-camara[data-camara="${cam}"]`);
    await punto.waitFor({ state: 'visible', timeout: 30000 });
    await punto.click({ force: true, timeout: 30000 });
    await pagina.waitForFunction(
      (c) => {
        const img = document.querySelector('#visor-fotos img');
        return window.visorFotos.camara === c && window.visorFotos.fotoCargada && img.naturalWidth > 0;
      },
      cam,
      { timeout: 30000 }
    );
    const info = await pagina.evaluate(() => ({
      texto: document.querySelector('#visor-fotos .linea1').innerText.replace(/\s+/g, ' '),
      ancho: document.querySelector('#visor-fotos img').naturalWidth,
      alto: document.querySelector('#visor-fotos img').naturalHeight,
    }));
    fotosAbiertas.push(`${cam}: ${info.texto} (${info.ancho}×${info.alto})`);
    // La última cámara se deja abierta para la captura, con la foto ya revelada
    if (cam === CAMARAS[CAMARAS.length - 1]) break;
    await pagina.keyboard.press('Escape');
    await pagina.waitForFunction(() => !window.visorFotos.abierto, null, { timeout: 10000 });
  } catch {
    errores.push(`[cámaras] la cámara ${cam} no abrió una foto`);
  }
}
// Probar las flechas: la siguiente foto de la misma cámara
const indiceAntes = await pagina.evaluate(() => window.visorFotos.indice);
await pagina.keyboard.press('ArrowRight');
const indiceDespues = await pagina.evaluate(() => window.visorFotos.indice);
if (indiceDespues === indiceAntes) errores.push('[cámaras] la flecha → no pasó a la siguiente foto');
await pagina.waitForFunction(() => window.visorFotos.fotoCargada, null, { timeout: 30000 }).catch(() => {});
await pagina.waitForTimeout(4500); // que termine de revelarse
await pagina.screenshot({ path: 'screenshots/foto.png', timeout: 120000 });
await navegador.close();
if (servidor) await servidor.close();

console.log('Captura guardada en screenshots/check.png');
if (mensajes.length) {
  console.log('\nMensajes de la consola:');
  mensajes.forEach((m) => console.log(' · ' + m));
}
console.log('\nControl de misión:');
for (const [clave, d] of Object.entries(datosMision)) {
  const valor = Number.isFinite(d.valor) ? d.valor.toFixed(2) : 'sin valor';
  console.log(` · ${d.nombre}: ${valor} ${d.unidad} (${d.puntos} puntos de historia, sol ${Math.floor(d.sol ?? 0)})`);
}
console.log(` · Tecla T: ${visibleAntes && !visibleTrasT && visibleTras2T ? 'oculta y vuelve a mostrar el panel' : 'FALLA'}`);
console.log('\nCámaras (foto real abierta):');
fotosAbiertas.forEach((f) => console.log(' · ' + f));
console.log(' · Captura con la foto abierta en screenshots/foto.png');

if (errores.length) {
  console.log(`\n${errores.length} error(es):`);
  errores.forEach((e) => console.log(' - ' + e));
  process.exit(1);
}
console.log('0 errores');
