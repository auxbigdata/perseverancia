// =====================================================================
// CÁMARAS DE PERCY: puntos que brillan sobre las cámaras del modelo.
// Clic = obturador + flash, y la foto real de Marte se revela poco a poco.
//   Clic en la foto: ampliar · Esc: volver al juego · ← →: más fotos de esa cámara
// Las fotos son de la NASA (API de imágenes crudas de Mars 2020), escogidas a mano
// y guardadas en public/fotos/ con su índice fotos.json.
// =====================================================================
import * as THREE from 'three';
import { minutosLuz } from './efemerides.js';

// Las 4 cámaras: pieza del modelo, nombre y un pequeño corrimiento en pantalla
// para que los puntos de la cabeza (Mastcam-Z y Navcam) no se encimen
const CAMARAS = [
  { pieza: 'Mastcam_Z_cams', nombre: 'Mastcam-Z', queHace: 'Sus "ojos" a color, con zoom', corrimiento: [-14, -8] },
  { pieza: 'NavCams', nombre: 'Navcam', queHace: 'Mira el camino para manejar', corrimiento: [14, 6] },
  { pieza: 'hazcams_front', nombre: 'Hazcam delantera', queHace: 'Vigila obstáculos junto a las ruedas', corrimiento: [0, 0] },
  { pieza: 'WATSON', nombre: 'WATSON', queHace: 'Lupa en la punta del brazo', corrimiento: [0, 0] },
];

const SOL_MS = 88775244;
const DIA_MS = 86400000;

// Estado visible desde la consola (lo revisa npm run check)
const estado = { abierto: false, camara: null, indice: 0, fotoCargada: false, fotos: null };
window.visorFotos = estado;

// --- Índice de fotos (se carga una vez) ---
let indice = null;
const cargarIndice = () =>
  (indice ??= fetch('/fotos/fotos.json').then((r) => {
    if (!r.ok) throw new Error(`No se pudo leer /fotos/fotos.json (${r.status})`);
    return r.json();
  }));

// =====================================================================
// Puntos sobre el modelo
// =====================================================================
const capaPuntos = document.createElement('div');
capaPuntos.id = 'puntos-camara';
document.body.appendChild(capaPuntos);

const puntos = [];
const centro = new THREE.Vector3();

export function iniciarCamaras(modelo, camara3d) {
  for (const cam of CAMARAS) {
    const pieza = modelo.getObjectByName(cam.pieza);
    if (!pieza) {
      console.warn(`No encontré la pieza ${cam.pieza}`);
      continue;
    }
    const boton = document.createElement('button');
    boton.className = 'punto-camara';
    boton.dataset.camara = cam.pieza;
    boton.setAttribute('aria-label', `Tomar foto con ${cam.nombre}`);
    boton.innerHTML = `<span class="brillo"></span><span class="etiqueta"><b>${cam.nombre}</b>${cam.queHace}</span>`;
    boton.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirCamara(cam);
    });
    capaPuntos.appendChild(boton);
    puntos.push({ cam, pieza, boton });
  }

  // Cada cuadro: llevar cada punto a donde se ve su pieza en la pantalla
  const caja = new THREE.Box3();
  function seguir() {
    for (const { cam, pieza, boton } of puntos) {
      caja.setFromObject(pieza).getCenter(centro);
      centro.project(camara3d);
      const detras = centro.z > 1;
      const x = (centro.x * 0.5 + 0.5) * innerWidth + cam.corrimiento[0];
      const y = (-centro.y * 0.5 + 0.5) * innerHeight + cam.corrimiento[1];
      boton.style.transform = `translate(${x}px, ${y}px)`;
      boton.hidden = detras || estado.abierto;
    }
    requestAnimationFrame(seguir);
  }
  seguir();
  window.camarasListas = true;
}

// =====================================================================
// Visor de fotos
// =====================================================================
const visor = document.createElement('div');
visor.id = 'visor-fotos';
visor.hidden = true;
visor.innerHTML = `
  <div class="obturador"><i></i><i></i></div>
  <div class="flash"></div>
  <figure>
    <div class="marco"><img alt="" /></div>
    <figcaption>
      <div class="linea1"><b class="cam"></b><span class="sol"></span><span class="hace"></span></div>
      <div class="titulo"></div>
      <div class="recibiendo"></div>
    </figcaption>
  </figure>
  <div class="ayuda-visor">Clic en la foto para ampliar · <kbd>←</kbd> <kbd>→</kbd> más fotos <span class="cuenta"></span> · <kbd>Esc</kbd> volver al juego</div>`;
document.body.appendChild(visor);
const img = visor.querySelector('img');
const marco = visor.querySelector('.marco');

// Sonido de obturador: un "clic" corto hecho con ruido (no necesita archivos)
let audio = null;
function sonarObturador() {
  try {
    audio ??= new AudioContext();
    const dur = 0.08;
    const buffer = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / datos.length, 3);
    const fuente = audio.createBufferSource();
    const volumen = audio.createGain();
    volumen.gain.value = 0.35;
    fuente.buffer = buffer;
    fuente.connect(volumen).connect(audio.destination);
    fuente.start();
  } catch {
    // sin sonido no pasa nada
  }
}

function haceCuanto(fechaUtc) {
  const dias = Math.floor((Date.now() - Date.parse(fechaUtc)) / DIA_MS);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  return `hace ${dias} días`;
}

function mostrarFoto(conEfecto) {
  const datosCam = estado.fotos;
  const foto = datosCam.fotos[estado.indice];
  estado.fotoCargada = false;

  visor.querySelector('.cam').textContent = datosCam.nombre;
  visor.querySelector('.sol').textContent = `Sol ${foto.sol}`;
  visor.querySelector('.hace').textContent = haceCuanto(foto.fecha_utc);
  visor.querySelector('.titulo').textContent = foto.descripcion;
  visor.querySelector('.cuenta').textContent = `(${estado.indice + 1} de ${datosCam.fotos.length})`;
  const luz = minutosLuz(new Date(foto.fecha_utc));
  visor.querySelector('.recibiendo').textContent =
    `Recibiendo desde Marte… la señal viajó ${Math.floor(luz)} min ${Math.round((luz % 1) * 60)} s`;

  if (conEfecto) {
    // Obturador y flash
    sonarObturador();
    visor.classList.remove('disparo');
    void visor.offsetWidth; // reinicia la animación
    visor.classList.add('disparo');
  }
  // La foto se revela poco a poco al terminar de llegar
  marco.classList.remove('revelada', 'revelando');
  img.onload = () => {
    estado.fotoCargada = true;
    void marco.offsetWidth;
    marco.classList.add('revelando');
    setTimeout(() => marco.classList.add('revelada'), 3200);
  };
  img.onerror = () => console.error(`No se pudo cargar la foto ${foto.archivo}`);
  img.alt = `${datosCam.nombre}, sol ${foto.sol}: ${foto.descripcion}`;
  img.src = `/fotos/${foto.archivo}`;
}

async function abrirCamara(cam) {
  const datos = await cargarIndice();
  const datosCam = datos.camaras[cam.pieza];
  if (!datosCam?.fotos?.length) return console.error(`No hay fotos para ${cam.nombre}`);
  estado.abierto = true;
  estado.camara = cam.pieza;
  estado.fotos = datosCam;
  estado.indice = 0;
  visor.hidden = false;
  visor.classList.remove('ampliada');
  mostrarFoto(true);
}

function cerrar() {
  estado.abierto = false;
  estado.camara = null;
  visor.hidden = true;
  visor.classList.remove('ampliada', 'disparo');
  // Los puntos vuelven en el acto (sin esperar al siguiente cuadro)
  for (const { boton } of puntos) boton.hidden = false;
}

// Clic en la foto: ampliar / volver al tamaño normal
marco.addEventListener('click', () => visor.classList.toggle('ampliada'));
// Clic fuera de la foto también vuelve al juego
visor.addEventListener('click', (e) => {
  if (e.target === visor) cerrar();
});

addEventListener(
  'keydown',
  (e) => {
    if (!estado.abierto) return;
    // Mientras el visor está abierto, las flechas son para las fotos, no para manejar
    if (['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    if (e.code === 'Escape') cerrar();
    const total = estado.fotos.fotos.length;
    if (e.code === 'ArrowRight') { estado.indice = (estado.indice + 1) % total; mostrarFoto(true); }
    if (e.code === 'ArrowLeft') { estado.indice = (estado.indice - 1 + total) % total; mostrarFoto(true); }
  },
  { capture: true } // se entera antes que los controles del rover
);
