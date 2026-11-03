// =====================================================================
// CONTROL DE MISIÓN: datos reales de Percy, con el mismo patrón que Open MCT
//   - Cada dato tiene una FICHA: nombre, unidad y qué proveedor lo entrega
//     (en Open MCT: los metadatos, GeneratorMetadataProvider.js:10-15)
//   - Cada PROVEEDOR dice qué datos atiende y sabe dar la historia (pedir)
//     y los valores nuevos en vivo (suscribir)
//     (en Open MCT: addProvider, request y subscribe, TelemetryAPI.js:167, :470, :529)
// La tecla T muestra u oculta el panel.
// =====================================================================
import { minutosLuz, distanciaTierraMarte } from './efemerides.js';

// --- Calendario marciano: Percy aterrizó el 18 de febrero de 2021 (sol 0) ---
const ATERRIZAJE = Date.UTC(2021, 1, 18, 20, 55); // hora de la Tierra (UTC)
const SOL_MS = 88775244; // un día marciano dura 24 h 39 min 35 s
const solDe = (ms) => (ms - ATERRIZAJE) / SOL_MS;

// =====================================================================
// 1) Mini API de telemetría (como openmct.telemetry, pero en pocas líneas)
// =====================================================================
const proveedores = [];
const telemetria = {
  // El último proveedor registrado tiene prioridad (igual que Open MCT, con unshift)
  agregarProveedor(proveedor) {
    proveedores.unshift(proveedor);
  },
  proveedorDe(dato) {
    return proveedores.find((p) => p.atiende(dato));
  },
  // Historia de toda la misión: lista de puntos { sol, valor }
  pedir(dato) {
    return this.proveedorDe(dato).pedir(dato);
  },
  // Valores nuevos: llama a "avisar" con cada punto y devuelve cómo cancelar
  suscribir(dato, avisar) {
    return this.proveedorDe(dato).suscribir(dato, avisar);
  },
};

// =====================================================================
// 2) Fichas de los 4 datos (metadatos)
// =====================================================================
const DATOS = [
  {
    clave: 'distancia',
    nombre: 'Distancia recorrida',
    unidad: 'km',
    decimales: 2,
    proveedor: 'nasa-manejos',
    campo: 'dist_total_m',
    convertir: (m) => m / 1000,
  },
  {
    clave: 'altura',
    nombre: 'Altura del terreno',
    unidad: 'm',
    decimales: 0,
    proveedor: 'nasa-manejos',
    campo: 'elev_geoid',
    convertir: (m) => m,
  },
  {
    clave: 'inclinacion',
    nombre: 'Inclinación',
    unidad: '°',
    decimales: 1,
    proveedor: 'nasa-manejos',
    campo: 'tilt',
    convertir: (g) => g,
  },
  {
    clave: 'luz',
    nombre: 'Tiempo de luz Tierra–Marte',
    unidad: 'min',
    decimales: 2,
    proveedor: 'efemerides',
  },
];

// =====================================================================
// 3) Proveedores
// =====================================================================

// Proveedor A: historial de manejos de la NASA (copia de M20_waypoints.json en public/data/).
// El archivo no cambia mientras jugamos, así que "en vivo" entrega el último manejo.
const ARCHIVO_NASA = '/data/M20_waypoints.json';
let manejos = null; // se descarga una sola vez y lo comparten los 3 datos
function cargarManejos() {
  manejos ??= fetch(ARCHIVO_NASA)
    .then((r) => {
      if (!r.ok) throw new Error(`No se pudo leer ${ARCHIVO_NASA} (${r.status})`);
      return r.json();
    })
    .then((geo) => geo.features.map((f) => f.properties))
    // Solo el final de cada manejo ("y"). Los puntos "m" son paradas a mitad de camino
    // y la NASA los deja con distancia 0, lo que haría caer la gráfica.
    .then((lista) => lista.filter((m) => m.final === 'y'));
  return manejos;
}

telemetria.agregarProveedor({
  atiende: (dato) => dato.proveedor === 'nasa-manejos',
  async pedir(dato) {
    const lista = await cargarManejos();
    return lista.map((m) => ({ sol: m.sol, valor: dato.convertir(m[dato.campo]) }));
  },
  suscribir(dato, avisar) {
    this.pedir(dato).then((puntos) => avisar(puntos[puntos.length - 1]));
    return () => {};
  },
});

// Proveedor B: tiempo de luz calculado con las órbitas de la Tierra y Marte (src/efemerides.js).
telemetria.agregarProveedor({
  atiende: (dato) => dato.proveedor === 'efemerides',
  async pedir() {
    // Un punto cada 2 soles, desde el aterrizaje hasta hoy
    const puntos = [];
    const hoy = solDe(Date.now());
    for (let sol = 0; sol <= hoy; sol += 2) {
      puntos.push({ sol, valor: minutosLuz(new Date(ATERRIZAJE + sol * SOL_MS)) });
    }
    return puntos;
  },
  suscribir(dato, avisar) {
    const medir = () => {
      const ahora = Date.now();
      avisar({ sol: solDe(ahora), valor: minutosLuz(new Date(ahora)) });
    };
    medir();
    const reloj = setInterval(medir, 1000);
    return () => clearInterval(reloj);
  },
});

// =====================================================================
// 4) Frase simple de qué significa cada dato (se arma con los números reales)
// =====================================================================
function frase(dato, puntos, actual) {
  const fmt = (v, d = 0) => v.toLocaleString('es', { maximumFractionDigits: d, minimumFractionDigits: d });
  if (dato.clave === 'distancia') {
    return `Todo lo que Percy ha manejado desde que aterrizó, en ${puntos.length} manejos. Equivale a ${fmt(actual.valor / 42.195, 1)} maratones.`;
  }
  if (dato.clave === 'altura') {
    const subida = actual.valor - puntos[0].valor;
    return `Está ${fmt(Math.abs(actual.valor))} m bajo el "nivel del mar" de Marte. Desde que aterrizó ya subió ${fmt(subida)} m, saliendo del cráter Jezero.`;
  }
  if (dato.clave === 'inclinacion') {
    const max = Math.max(...puntos.map((p) => p.valor));
    return `Qué tan torcido quedó al terminar su último manejo. Lo más empinado que ha pisado: ${fmt(max, 1)}°.`;
  }
  const min = Math.floor(actual.valor), seg = Math.round((actual.valor - min) * 60);
  const km = distanciaTierraMarte(new Date()) / 1e6;
  return `Una orden enviada hoy desde la Tierra tarda ${min} min ${seg} s en llegar (${fmt(km)} millones de km). Por eso Percy no se maneja con joystick.`;
}

// =====================================================================
// 5) Panel en pantalla
// =====================================================================
const panel = document.createElement('aside');
panel.id = 'control-mision';
panel.innerHTML = `
  <header>
    <span class="enlace"><i></i> Enlace con Percy</span>
    <span class="sol" id="cm-sol">Sol —</span>
  </header>
  <h2>Control de misión</h2>
  <div class="tarjetas"></div>
  <footer>Datos: historial de manejos de la NASA · tiempo de luz calculado en vivo · <kbd>T</kbd> oculta</footer>`;
document.body.appendChild(panel);
const contenedor = panel.querySelector('.tarjetas');

// Estado visible desde la consola (lo revisa npm run check)
const estado = { visible: true, datos: {} };
window.controlMision = estado;

// Mini gráfica de toda la misión: línea con relleno, rejilla suave y el punto de hoy resaltado
function dibujarGrafica(lienzo, puntos, actual) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const ancho = lienzo.clientWidth, alto = lienzo.clientHeight;
  lienzo.width = ancho * dpr;
  lienzo.height = alto * dpr;
  const ctx = lienzo.getContext('2d');
  ctx.scale(dpr, dpr);
  const estilo = getComputedStyle(panel);
  const colorLinea = estilo.getPropertyValue('--cm-acento').trim();
  const colorRejilla = estilo.getPropertyValue('--cm-rejilla').trim();

  const todos = actual ? [...puntos, actual] : puntos;
  const solMax = Math.max(...todos.map((p) => p.sol));
  let vMin = Math.min(...todos.map((p) => p.valor));
  let vMax = Math.max(...todos.map((p) => p.valor));
  if (vMax - vMin < 1e-9) vMax = vMin + 1;
  const margen = 4;
  const x = (sol) => margen + (sol / solMax) * (ancho - margen * 2);
  const y = (v) => alto - margen - ((v - vMin) / (vMax - vMin)) * (alto - margen * 2);

  // Rejilla: 3 líneas horizontales
  ctx.strokeStyle = colorRejilla;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const yy = margen + (i / 2) * (alto - margen * 2);
    ctx.beginPath(); ctx.moveTo(margen, yy); ctx.lineTo(ancho - margen, yy); ctx.stroke();
  }

  // Relleno bajo la curva
  ctx.beginPath();
  ctx.moveTo(x(todos[0].sol), alto - margen);
  todos.forEach((p) => ctx.lineTo(x(p.sol), y(p.valor)));
  ctx.lineTo(x(todos[todos.length - 1].sol), alto - margen);
  ctx.closePath();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = colorLinea;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Línea
  ctx.beginPath();
  todos.forEach((p, i) => (i ? ctx.lineTo(x(p.sol), y(p.valor)) : ctx.moveTo(x(p.sol), y(p.valor))));
  ctx.strokeStyle = colorLinea;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Punto de hoy
  const ult = todos[todos.length - 1];
  ctx.beginPath();
  ctx.arc(x(ult.sol), y(ult.valor), 3, 0, Math.PI * 2);
  ctx.fillStyle = colorLinea;
  ctx.fill();
}

// Crear una tarjeta por dato y conectarla con su proveedor
async function montarDato(dato) {
  const tarjeta = document.createElement('section');
  tarjeta.className = 'tarjeta';
  tarjeta.dataset.dato = dato.clave;
  tarjeta.innerHTML = `
    <div class="fila"><h3>${dato.nombre}</h3><span class="fuente">${dato.proveedor}</span></div>
    <div class="valor"><b>—</b><span>${dato.unidad}</span></div>
    <canvas aria-label="Gráfica de ${dato.nombre} en toda la misión"></canvas>
    <div class="ejes"><span>Sol 0</span><span class="hasta"></span></div>
    <p class="frase">Cargando…</p>`;
  contenedor.appendChild(tarjeta);
  const valorEl = tarjeta.querySelector('.valor b');
  const lienzo = tarjeta.querySelector('canvas');

  try {
    const puntos = await telemetria.pedir(dato);
    estado.datos[dato.clave] = { nombre: dato.nombre, unidad: dato.unidad, puntos: puntos.length, valor: null };
    telemetria.suscribir(dato, (actual) => {
      valorEl.textContent = actual.valor.toLocaleString('es', {
        minimumFractionDigits: dato.decimales,
        maximumFractionDigits: dato.decimales,
      });
      tarjeta.querySelector('.hasta').textContent = `Sol ${Math.floor(actual.sol)}`;
      tarjeta.querySelector('.frase').textContent = frase(dato, puntos, actual);
      estado.datos[dato.clave].valor = actual.valor;
      estado.datos[dato.clave].sol = actual.sol;
      // El tiempo de luz va sumando su punto de hoy; los manejos ya traen su último punto
      dibujarGrafica(lienzo, puntos, dato.proveedor === 'efemerides' ? actual : null);
    });
  } catch (error) {
    tarjeta.querySelector('.frase').textContent = 'No llegaron los datos.';
    console.error(`Control de misión: ${dato.nombre}:`, error);
  }
}

DATOS.forEach(montarDato);

// Sol actual de la misión, en vivo
const solEl = panel.querySelector('#cm-sol');
const marcarSol = () => (solEl.textContent = `Sol ${Math.floor(solDe(Date.now()))} · Jezero`);
marcarSol();
setInterval(marcarSol, 10000);

// Tecla T: mostrar u ocultar el panel
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyT' || e.repeat) return;
  estado.visible = !estado.visible;
  panel.hidden = !estado.visible;
});
