// Paisaje de Marte de película: dunas, rocas, cielo caramelo con polvo, sol de tarde y las dos lunas
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import './controlMision.js'; // panel con datos reales de Percy (tecla T)
import { iniciarCamaras } from './camaras.js'; // fotos reales de las cámaras de Percy

// --- Números "al azar" con semilla: el paisaje sale igual en cada recarga ---
function crearAzar(semilla) {
  return function () {
    semilla |= 0;
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = crearAzar(2026);
const ruido = new SimplexNoise({ random: azar });

// --- Renderizador con tono cinematográfico ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

// --- Escena con niebla de polvo color caramelo ---
const COLOR_CIELO = '#d4935a';
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(COLOR_CIELO, 0.0065);

// --- Dirección del sol de tarde: bajo sobre el horizonte, a la izquierda ---
const DIR_SOL = new THREE.Vector3(-0.45, 0.17, -1).normalize();

// =====================================================================
// TERRENO: colinas + dunas + ondulitas de arena
// =====================================================================
const VIENTO = new THREE.Vector2(1, 0.35).normalize(); // dirección en la que el viento empuja la arena

function alturaTerreno(x, z) {
  // Llanura casi plana con ondulaciones muy suaves
  let h = ruido.noise(x * 0.01, z * 0.01) * 1.2;

  // Dunas: crestas perpendiculares al viento, con la línea torcida por ruido
  const a = x * VIENTO.x + z * VIENTO.y;
  const torcido = a * 0.05 + ruido.noise(x * 0.015, z * 0.015) * 1.6;
  const f = torcido - Math.floor(torcido); // 0..1 dentro de cada duna
  // Cara larga y suave hacia el viento (80%) y cara empinada detrás de la cresta (20%)
  const perfil = f < 0.8 ? f / 0.8 : (1 - f) / 0.2;
  const suave = perfil * perfil * (3 - 2 * perfil);
  // Las dunas solo aparecen en algunos campos; el resto queda plano
  const campo = THREE.MathUtils.smoothstep(ruido.noise(x * 0.012 + 20, z * 0.012), 0.1, 0.6);
  h += suave * 3.5 * campo;

  // Montañas de arena: grandes y redondeadas, solo lejos de la cámara
  const lejos = THREE.MathUtils.smoothstep(Math.hypot(x, z - 45), 70, 150);
  const montana = Math.max(0, ruido.noise(x * 0.007 + 100, z * 0.007));
  h += montana * montana * 40 * lejos;

  // Ondulitas finas de arena (ripples)
  h += Math.sin(a * 1.6 + ruido.noise(x * 0.1, z * 0.1) * 2) * 0.06;
  return h;
}

// Malla fina (cada 0.8 m) para que las crestas no se vean angulosas
const geo = new THREE.PlaneGeometry(400, 400, 500, 500);
geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  pos.setY(i, alturaTerreno(pos.getX(i), pos.getZ(i)));
}
geo.computeVertexNormals();

// Color: valles oscuros óxido, crestas ocre claro, pendientes empinadas más rojizas
const normales = geo.attributes.normal;
const colores = new Float32Array(pos.count * 3);
const oxido = new THREE.Color('#8a3518');
const ocre = new THREE.Color('#d08a4e');
const rojizo = new THREE.Color('#a8461f');
const c = new THREE.Color();
for (let i = 0; i < pos.count; i++) {
  const t = THREE.MathUtils.clamp((pos.getY(i) + 3) / 12, 0, 1);
  c.copy(oxido).lerp(ocre, t);
  const pendiente = 1 - normales.getY(i); // 0 = plano, mayor = empinado
  c.lerp(rojizo, THREE.MathUtils.clamp(pendiente * 2.5, 0, 0.6));
  // Pequeña variación para que no se vea de plástico
  const v = 1 + ruido.noise(pos.getX(i) * 0.3, pos.getZ(i) * 0.3) * 0.05;
  colores.set([c.r * v, c.g * v, c.b * v], i * 3);
}
geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));

// Textura de grano de arena (ruido que se repite sin costuras) para que el suelo no se vea de plástico
function texturaArena(tam = 256) {
  const datos = new Uint8Array(tam * tam * 4);
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      // Se recorre un "toro" en 4D: así el borde izquierdo empata con el derecho
      const a = (x / tam) * Math.PI * 2, b = (y / tam) * Math.PI * 2;
      let n = 0;
      for (const [radio, peso] of [[1, 0.5], [3, 0.3], [8, 0.2]]) {
        n += ruido.noise4d(Math.cos(a) * radio, Math.sin(a) * radio, Math.cos(b) * radio, Math.sin(b) * radio) * peso;
      }
      const v = Math.round(THREE.MathUtils.clamp(0.5 + n * 0.5, 0, 1) * 255);
      datos.set([v, v, v, 255], (y * tam + x) * 4);
    }
  }
  const textura = new THREE.DataTexture(datos, tam, tam);
  textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(120, 120); // un mosaico cada ~3 m
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  textura.generateMipmaps = true;
  textura.anisotropy = renderer.capabilities.getMaxAnisotropy(); // nítida aunque se vea de lado
  textura.needsUpdate = true;
  return textura;
}
const arena = texturaArena();

const suelo = new THREE.Mesh(
  geo,
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    bumpMap: arena, // relieve fino del grano
    bumpScale: 0.6,
    metalness: 0,
    envMapIntensity: 0.2,
  })
);
suelo.receiveShadow = true;
suelo.castShadow = true; // las dunas se hacen sombra entre sí
scene.add(suelo);

// Normal del terreno (hacia dónde "apunta" el suelo) para inclinar el rover y las huellas
function normalTerreno(x, z, d = 1.2) {
  return new THREE.Vector3(
    alturaTerreno(x - d, z) - alturaTerreno(x + d, z),
    2 * d,
    alturaTerreno(x, z - d) - alturaTerreno(x, z + d)
  ).normalize();
}

// =====================================================================
// CÁMARA: baja, detrás del rover, mirando hacia el sol y las lunas
// =====================================================================
const INICIO_ROVER = new THREE.Vector3(0, 0, 36);
INICIO_ROVER.y = alturaTerreno(INICIO_ROVER.x, INICIO_ROVER.z);
const DIST_CAMARA = 8; // metros detrás del rover
const ALTO_CAMARA = 2.4; // metros sobre el suelo
const ALTO_MIRADA = 2.6; // a qué altura sobre el rover mira la cámara (más alto = se ve más cielo)

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
const altoCamara = alturaTerreno(0, INICIO_ROVER.z + DIST_CAMARA) + ALTO_CAMARA;
camera.position.set(0, altoCamara, INICIO_ROVER.z + DIST_CAMARA);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(INICIO_ROVER).add(new THREE.Vector3(0, ALTO_MIRADA, 0));
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.52; // que no se meta bajo el suelo

// =====================================================================
// LUZ: sol de tarde cálido con sombras suaves + luz del cielo polvoriento
// =====================================================================
const sol = new THREE.DirectionalLight('#ffbf80', 3.2);
sol.position.copy(DIR_SOL).multiplyScalar(150);
sol.castShadow = true;
sol.shadow.mapSize.set(4096, 4096); // sombras más nítidas
// La zona de sombras sigue al rover (ver ANIMACIÓN), así puede ser más chica y nítida
sol.shadow.camera.left = -80;
sol.shadow.camera.right = 80;
sol.shadow.camera.top = 80;
sol.shadow.camera.bottom = -80;
sol.shadow.camera.far = 400;
sol.shadow.bias = -0.0002;
sol.shadow.normalBias = 0.4; // evita el granulado ("acné") de sombra sobre la arena
sol.shadow.radius = 4; // bordes de sombra más suaves
scene.add(sol, sol.target);
scene.add(new THREE.HemisphereLight('#f3c08e', '#6a3018', 1.3));

// =====================================================================
// CIELO: degradado caramelo + disco del sol con resplandor y halo azulado
// (en Marte, alrededor del sol de tarde el cielo se ve azul)
// =====================================================================
const cielo = new THREE.Mesh(
  new THREE.SphereGeometry(900, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      colorArriba: { value: new THREE.Color('#b8743f') },
      colorHorizonte: { value: new THREE.Color(COLOR_CIELO) },
      dirSol: { value: DIR_SOL },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 colorArriba;
      uniform vec3 colorHorizonte;
      uniform vec3 dirSol;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float t = pow(clamp(dir.y, 0.0, 1.0), 0.6);
        vec3 color = mix(colorHorizonte, colorArriba, t);

        float cerca = max(dot(dir, dirSol), 0.0);
        // Halo azulado pegado al sol
        color = mix(color, vec3(0.55, 0.66, 0.76), pow(cerca, 90.0) * 0.6);
        // Resplandor cálido amplio
        color += vec3(1.0, 0.6, 0.3) * pow(cerca, 14.0) * 0.18;
        // Disco del sol (en Marte se ve más pequeño que en la Tierra)
        color += vec3(1.0, 0.95, 0.85) * smoothstep(0.99975, 0.99990, cerca) * 3.0;
        color += vec3(1.0, 0.9, 0.75) * pow(cerca, 900.0) * 1.5;

        gl_FragColor = vec4(color, 1.0);
        // Mismo tono de película y espacio de color que el resto de la escena
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
);
scene.add(cielo);

// Entorno para los reflejos: sin esto las piezas metálicas del rover se ven negras.
// Se "fotografía" el cielo una vez y se usa como luz reflejada.
const escenaCielo = new THREE.Scene();
escenaCielo.add(cielo.clone());
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(escenaCielo).texture;
scene.environmentIntensity = 0.8;

// =====================================================================
// ROCAS: piedras irregulares repartidas sobre la arena
// =====================================================================
function crearGeometriaRoca(semillaForma, rugosidad = 0.35, detalle = 5) {
  // Más subdivisiones = superficie suave, sin caras planas
  const g = new THREE.IcosahedronGeometry(1, detalle);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Forma general + bultos medianos + aspereza fina
    const n =
      ruido.noise3d(v.x * 1.3 + semillaForma, v.y * 1.3, v.z * 1.3) +
      ruido.noise3d(v.x * 3.5 + semillaForma, v.y * 3.5, v.z * 3.5) * 0.35 +
      ruido.noise3d(v.x * 9 + semillaForma, v.y * 9, v.z * 9) * 0.1;
    v.multiplyScalar(1 + n * rugosidad);
    v.y *= 0.65 + (0.35 - rugosidad); // rocas más achatadas, lunas más redondas
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const materialRoca = new THREE.MeshStandardMaterial({
  color: '#8a4a2e',
  roughness: 0.9,
  bumpMap: arena, // misma aspereza que la arena
  bumpScale: 2,
  envMapIntensity: 0.2,
});
const tonoRoca = new THREE.Color();
// Lista de rocas para los choques: centro, radio, altura del suelo y de la cima
const listaRocas = [];
function registrarRoca(x, z, radio, cima) {
  listaRocas.push({ x, z, radio, suelo: alturaTerreno(x, z), cima });
}
const matriz = new THREE.Matrix4();
const cuaternion = new THREE.Quaternion();
const escala = new THREE.Vector3();
const posRoca = new THREE.Vector3();

// Tres formas de roca distintas, cada una repetida muchas veces (InstancedMesh)
for (let forma = 0; forma < 3; forma++) {
  const cantidad = 140;
  const rocas = new THREE.InstancedMesh(crearGeometriaRoca(forma * 10), materialRoca, cantidad);
  rocas.castShadow = true;
  rocas.receiveShadow = true;
  for (let i = 0; i < cantidad; i++) {
    let x = (azar() - 0.5) * 220;
    let z = (azar() - 0.5) * 220 - 20;
    // No poner rocas en el camino inicial del rover ni pegadas a la cámara
    if (Math.abs(x) < 8 && z > 10 && z < 50) x += 30;
    // Algunas rocas grandes, la mayoría pequeñas
    const tam = azar() < 0.1 ? 1.5 + azar() * 2 : 0.2 + azar() * 0.7;
    posRoca.set(x, alturaTerreno(x, z) - tam * 0.2, z);
    cuaternion.setFromEuler(new THREE.Euler(azar() * 0.4, azar() * Math.PI * 2, azar() * 0.4));
    escala.set(tam * (0.8 + azar() * 0.5), tam, tam * (0.8 + azar() * 0.5));
    rocas.setMatrixAt(i, matriz.compose(posRoca, cuaternion, escala));
    registrarRoca(x, z, Math.max(escala.x, escala.z), posRoca.y + escala.y * 0.7);
    // Cada roca con un tono un poco distinto
    rocas.setColorAt(i, tonoRoca.setRGB(0.7 + azar() * 0.4, 0.7 + azar() * 0.35, 0.7 + azar() * 0.3));
  }
  scene.add(rocas);
}

// Unas cuantas rocas grandes en primer plano para dar profundidad
const rocaGrande = new THREE.Mesh(crearGeometriaRoca(99), materialRoca);
[[-6, 30, 0.9], [5, 27, 0.6], [-9, 22, 0.5], [9, 34, 0.5]].forEach(([x, z, tam]) => {
  const r = rocaGrande.clone();
  r.position.set(x, alturaTerreno(x, z) - tam * 0.15, z);
  r.scale.set(tam * 1.3, tam, tam);
  r.rotation.y = x;
  r.castShadow = r.receiveShadow = true;
  scene.add(r);
  registrarRoca(x, z, tam * 1.3, r.position.y + tam * 0.7);
});

// =====================================================================
// LUNAS: Fobos (más grande y cercana) y Deimos (pequeña)
// Ambas son rocas irregulares; se exagera su tamaño para que se vean
// =====================================================================
function crearLuna(tam, formaSemilla) {
  const luna = new THREE.Mesh(
    crearGeometriaRoca(formaSemilla, 0.2),
    new THREE.MeshStandardMaterial({
      color: '#d8c4ae',
      emissive: '#b49a80',
      emissiveIntensity: 0.9,
      roughness: 1,
      fog: false,
    })
  );
  luna.scale.set(tam * 1.3, tam, tam);
  return luna;
}
const fobos = crearLuna(12, 300);
const deimos = crearLuna(5.5, 400);
const DIR_FOBOS = new THREE.Vector3(0.38, 0.30, -1).normalize();
const DIR_DEIMOS = new THREE.Vector3(0.55, 0.40, -1).normalize();
fobos.position.copy(DIR_FOBOS).multiplyScalar(700);
deimos.position.copy(DIR_DEIMOS).multiplyScalar(750);
scene.add(fobos, deimos);

// =====================================================================
// POLVO: partículas flotando en el aire, empujadas por el viento
// =====================================================================
function texturaPunto() {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 32;
  const ctx = lienzo.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(lienzo);
}

const CANT_POLVO = 6000;
const ZONA = 120; // tamaño de la caja de polvo alrededor de la cámara
const posPolvo = new Float32Array(CANT_POLVO * 3);
for (let i = 0; i < CANT_POLVO; i++) {
  posPolvo[i * 3] = (azar() - 0.5) * ZONA;
  posPolvo[i * 3 + 1] = altoCamara - 6 + azar() * 9;
  posPolvo[i * 3 + 2] = (azar() - 0.5) * ZONA;
}
const geoPolvo = new THREE.BufferGeometry();
geoPolvo.setAttribute('position', new THREE.BufferAttribute(posPolvo, 3));
const polvo = new THREE.Points(
  geoPolvo,
  new THREE.PointsMaterial({
    color: '#e2a06a',
    size: 0.3,
    map: texturaPunto(),
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
);
scene.add(polvo);

// =====================================================================
// ROVER PERSEVERANCE: modelo 3D oficial de la NASA, a tamaño real
// (mide 3 m de largo, 2.7 m de ancho y 2.2 m de alto)
// =====================================================================
const LARGO_REAL = 3.0; // metros
const rover = new THREE.Group(); // el grupo es lo que se mueve; el modelo va adentro
rover.position.copy(INICIO_ROVER);
scene.add(rover);

// El modelo viene comprimido con Draco: el decodificador está en public/draco/
const draco = new DRACOLoader();
draco.setDecoderPath('/draco/');
const cargador = new GLTFLoader();
cargador.setDRACOLoader(draco);
cargador.load(
  '/models/perseverance.glb',
  (gltf) => {
    const modelo = gltf.scene;

    // Medir el modelo y escalarlo para que mida 3 m de largo (su frente mira hacia +z)
    const caja = new THREE.Box3().setFromObject(modelo);
    const tam = caja.getSize(new THREE.Vector3());
    modelo.scale.multiplyScalar(LARGO_REAL / tam.z);

    // Centrarlo y apoyar las ruedas en el suelo (y = 0 del grupo)
    caja.setFromObject(modelo);
    const centro = caja.getCenter(new THREE.Vector3());
    modelo.position.set(-centro.x, -caja.min.y, -centro.z);
    caja.setFromObject(modelo).getSize(tam);
    console.log(`Rover a tamaño real: ${tam.z.toFixed(2)} m de largo × ${tam.x.toFixed(2)} m de ancho × ${tam.y.toFixed(2)} m de alto`);

    modelo.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    rover.add(modelo);
    prepararRuedas(modelo);
    iniciarCamaras(modelo, camera);

    // Piezas que son cámaras (las usaremos al final)
    const camaras = [];
    modelo.traverse((o) => {
      if (/cam|camera|watson|lens/i.test(o.name) && !/cover|wiring|bracket/i.test(o.name)) camaras.push(o.name);
    });
    console.log('Cámaras del rover:', camaras.join(', '));
    window.camarasRover = camaras;
    window.roverListo = true;
  },
  undefined,
  (error) => console.error('No se pudo cargar el rover:', error)
);

// --- Teclado: WASD o flechas ---
const teclas = {};
addEventListener('keydown', (e) => (teclas[e.code] = true));
addEventListener('keyup', (e) => (teclas[e.code] = false));

const VEL_MAX = 2.5; // m/s (el real va a unos 0.04 m/s; aquí lo aceleramos para poder jugar)
const VEL_GIRO = 0.6; // radianes por segundo
const ALTO_OBSTACULO = 0.45; // rocas más altas que esto no se pueden pasar por encima
const LIMITE = 180; // borde del terreno
const ARRIBA = new THREE.Vector3(0, 1, 0);
let rumbo = Math.PI; // hacia dónde mira el rover (π = hacia el sol)
let velocidad = 0; // m/s hacia adelante
let velGiro = 0; // rad/s (positivo = a la izquierda)
let pendienteFrente = 0; // > 0 cuesta arriba
const adelante = new THREE.Vector3();
const izquierda = new THREE.Vector3(); // el lado +x del modelo es su izquierda
const qInclinacion = new THREE.Quaternion();
const qRumbo = new THREE.Quaternion();
const qObjetivo = new THREE.Quaternion();
const mOrientacion = new THREE.Matrix4();
const ejeFrente = new THREE.Vector3();
const ejeLado = new THREE.Vector3();
const ejeArriba = new THREE.Vector3();

// Las 6 ruedas: posición respecto al centro del rover (x = izquierda, z = adelante), en metros.
// Son valores aproximados hasta que carga el modelo y se miden las ruedas de verdad.
let ruedas = [
  [1.1, 1.1], [1.1, 0], [1.1, -1.1],
  [-1.1, 1.1], [-1.1, 0], [-1.1, -1.1],
].map(([x, z]) => ({ x, z, esquina: z !== 0 }));
let RADIO_RUEDA = 0.26; // el real mide 52.5 cm de diámetro

// --- Separar las 6 ruedas del modelo para que cada una pueda rodar y girar ---
// En el archivo de la NASA las 6 ruedas son una sola pieza ("Wheels_objs"),
// así que repartimos sus triángulos según dónde están: izquierda/derecha y adelante/medio/atrás.
function prepararRuedas(modelo) {
  const piezaRuedas = modelo.getObjectByName('Wheels_objs');
  if (!piezaRuedas) return console.warn('No encontré las ruedas en el modelo');
  const mallas = [];
  piezaRuedas.traverse((o) => o.isMesh && mallas.push(o));

  // 1) Centro de cada triángulo (en el espacio del padre de cada malla)
  const v = new THREE.Vector3();
  const triangulos = mallas.map((malla) => {
    const geo = malla.geometry.index ? malla.geometry.toNonIndexed() : malla.geometry;
    const p = geo.attributes.position;
    const centros = [];
    for (let i = 0; i < p.count; i += 3) {
      const c = new THREE.Vector3();
      for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(p, i + k).applyMatrix4(malla.matrix));
      centros.push(c.divideScalar(3));
    }
    return { malla, geo, centros };
  });
  const todos = triangulos.flatMap((t) => t.centros);

  // 2) Izquierda / derecha por el centro en x; adelante / medio / atrás con k-medias en z
  const caja = new THREE.Box3().setFromPoints(todos);
  const xMedio = (caja.min.x + caja.max.x) / 2;
  const filasZ = [caja.min.z, (caja.min.z + caja.max.z) / 2, caja.max.z];
  const filaDe = (z) => filasZ.reduce((mejor, fz, i) => (Math.abs(z - fz) < Math.abs(z - filasZ[mejor]) ? i : mejor), 0);
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const suma = [0, 0, 0], n = [0, 0, 0];
    for (const c of todos) { const f = filaDe(c.z); suma[f] += c.z; n[f]++; }
    for (let f = 0; f < 3; f++) if (n[f]) filasZ[f] = suma[f] / n[f];
  }
  const grupoDe = (c) => (c.x > xMedio ? 0 : 3) + filaDe(c.z);

  // 3) Centro de cada rueda
  const cajasRueda = Array.from({ length: 6 }, () => new THREE.Box3());
  for (const c of todos) cajasRueda[grupoDe(c)].expandByPoint(c);
  const padre = mallas[0].parent;
  const nuevas = cajasRueda.map((cajaRueda) => {
    const centro = cajaRueda.getCenter(new THREE.Vector3());
    const direccion = new THREE.Group(); // gira a los lados (dirigir)
    const rodar = new THREE.Group(); // gira sobre su eje (rodar)
    direccion.position.copy(centro);
    direccion.add(rodar);
    padre.add(direccion);
    return { centro, direccion, rodar };
  });

  // 4) Copiar los triángulos de cada malla a su rueda, centrados en el eje de la rueda
  for (const { malla, geo, centros } of triangulos) {
    for (let g = 0; g < 6; g++) {
      const indices = centros.map((c, i) => (grupoDe(c) === g ? i : -1)).filter((i) => i >= 0);
      if (!indices.length) continue;
      const parte = new THREE.BufferGeometry();
      for (const [nombre, attr] of Object.entries(geo.attributes)) {
        const datos = new Float32Array(indices.length * 3 * attr.itemSize);
        indices.forEach((t, j) => {
          for (let k = 0; k < 3; k++) {
            for (let e = 0; e < attr.itemSize; e++) {
              datos[(j * 3 + k) * attr.itemSize + e] = attr.getComponent(t * 3 + k, e);
            }
          }
        });
        parte.setAttribute(nombre, new THREE.BufferAttribute(datos, attr.itemSize, attr.normalized));
      }
      // Posiciones: al espacio del padre y luego relativas al centro de la rueda
      const p = parte.attributes.position;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(malla.matrix).sub(nuevas[g].centro);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      const trozo = new THREE.Mesh(parte, malla.material);
      trozo.castShadow = trozo.receiveShadow = true;
      nuevas[g].rodar.add(trozo);
    }
    malla.removeFromParent();
  }

  // 5) Medir dónde quedó cada rueda respecto al rover (en metros) y su radio
  rover.updateMatrixWorld(true);
  const tamRueda = new THREE.Box3().setFromObject(nuevas[1].rodar).getSize(new THREE.Vector3());
  RADIO_RUEDA = tamRueda.y / 2;
  ruedas = nuevas.map(({ direccion, rodar }) => {
    const enRover = rover.worldToLocal(direccion.getWorldPosition(new THREE.Vector3()));
    return { x: enRover.x, z: enRover.z, direccion, rodar, esquina: false };
  });
  // Las de adelante y atrás son las que se pueden dirigir (las del medio, no)
  const zMax = Math.max(...ruedas.map((r) => Math.abs(r.z)));
  ruedas.forEach((r) => (r.esquina = Math.abs(r.z) > zMax * 0.5));
  SEPARACION_RUEDAS = Math.abs(ruedas[1].x);
  console.log(
    `Ruedas separadas: ${ruedas.length}, radio ${RADIO_RUEDA.toFixed(2)} m, ` +
      `posiciones ${ruedas.map((r) => `(${r.x.toFixed(2)}, ${r.z.toFixed(2)})`).join(' ')}`
  );
}

// --- Rocas cercanas (se recalcula una vez por cuadro para no revisar las 400 cada vez) ---
let rocasCerca = [];
function buscarRocasCerca() {
  rocasCerca = listaRocas.filter((r) => Math.hypot(r.x - rover.position.x, r.z - rover.position.z) < r.radio + 6);
}
const esObstaculo = (r) => r.cima - r.suelo > ALTO_OBSTACULO;

// Altura donde apoya una rueda: la arena, o la roca pequeña que esté pisando
function alturaApoyo(x, z) {
  let h = alturaTerreno(x, z);
  for (const r of rocasCerca) {
    if (esObstaculo(r)) continue;
    const d = Math.hypot(x - r.x, z - r.z) / r.radio;
    if (d < 1) h = Math.max(h, r.suelo + (r.cima - r.suelo) * Math.sqrt(1 - d * d));
  }
  return h;
}

// Punto del rover (x = izquierda, z = adelante, en metros) llevado al mundo
const puntoMundo = (x, z, destino) =>
  destino.copy(rover.position).addScaledVector(izquierda, x).addScaledVector(adelante, z);

// Cuánto se mete el rover dentro de una roca grande (0 = nada)
const puntoChoque = new THREE.Vector3();
function penetracion() {
  let peor = 0;
  const puntos = [...ruedas.map((r) => [r.x, r.z]), [0, 1.6], [0, -1.6]]; // ruedas + frente + cola
  for (const [px, pz] of puntos) {
    puntoMundo(px, pz, puntoChoque);
    for (const r of rocasCerca) {
      if (!esObstaculo(r)) continue;
      const dentro = r.radio * 0.85 + RADIO_RUEDA - Math.hypot(puntoChoque.x - r.x, puntoChoque.z - r.z);
      peor = Math.max(peor, dentro);
    }
  }
  return peor;
}

function actualizarDirecciones() {
  adelante.set(Math.sin(rumbo), 0, Math.cos(rumbo));
  izquierda.set(Math.cos(rumbo), 0, -Math.sin(rumbo));
}

const apoyo = new THREE.Vector3();
const posAnterior = new THREE.Vector3();

function moverRover(dt) {
  // Mientras se mira una foto, el rover se queda quieto
  const mando = window.visorFotos?.abierto ? {} : teclas;
  const avance = (mando.KeyW || mando.ArrowUp ? 1 : 0) - (mando.KeyS || mando.ArrowDown ? 1 : 0);
  const giro = (mando.KeyA || mando.ArrowLeft ? 1 : 0) - (mando.KeyD || mando.ArrowRight ? 1 : 0);

  // Inercia: acelera despacio, frena un poco más rápido; cuesta arriba y en curva va más lento
  const freno = 1 - THREE.MathUtils.clamp(pendienteFrente * 2, -0.3, 0.6);
  const vObjetivo = avance * VEL_MAX * freno * (giro ? 0.7 : 1);
  velocidad = THREE.MathUtils.damp(velocidad, vObjetivo, avance ? 1.2 : 2.5, dt);
  velGiro = THREE.MathUtils.damp(velGiro, giro * VEL_GIRO, 3, dt);

  // Mover y girar; si se mete más en una roca grande, se deshace y rebota un poco
  const antes = penetracion();
  posAnterior.copy(rover.position);
  const rumboAnterior = rumbo;
  rumbo += velGiro * dt;
  actualizarDirecciones();
  rover.position.addScaledVector(adelante, velocidad * dt);
  rover.position.x = THREE.MathUtils.clamp(rover.position.x, -LIMITE, LIMITE);
  rover.position.z = THREE.MathUtils.clamp(rover.position.z, -LIMITE, LIMITE);
  const despues = penetracion();
  if (despues > 0.001 && despues > antes) {
    rover.position.copy(posAnterior);
    rumbo = rumboAnterior;
    actualizarDirecciones();
    velocidad *= -0.25;
    velGiro = 0;
  }

  // Suspensión tipo "balancín": la inclinación sale de dónde apoya cada rueda
  let hIzq = 0, hDer = 0, hFrente = 0, hAtras = 0, nFrente = 0, nAtras = 0, suma = 0;
  let zFrente = 0, zAtras = 0, xIzq = 0, xDer = 0;
  for (const r of ruedas) {
    puntoMundo(r.x, r.z, apoyo);
    const h = alturaApoyo(apoyo.x, apoyo.z);
    suma += h;
    if (r.x > 0) { hIzq += h; xIzq += r.x; } else { hDer += h; xDer += r.x; }
    if (r.z > 0.3) { hFrente += h; zFrente += r.z; nFrente++; }
    if (r.z < -0.3) { hAtras += h; zAtras += r.z; nAtras++; }
  }
  const largo = zFrente / nFrente - zAtras / nAtras;
  const ancho = (xIzq - xDer) / 3;
  pendienteFrente = (hFrente / nFrente - hAtras / nAtras) / largo;
  ejeFrente.copy(adelante).addScaledVector(ARRIBA, pendienteFrente).normalize();
  ejeLado.copy(izquierda).addScaledVector(ARRIBA, (hIzq - hDer) / 3 / ancho).normalize();
  ejeArriba.crossVectors(ejeFrente, ejeLado).normalize();
  ejeLado.crossVectors(ejeArriba, ejeFrente);
  qObjetivo.setFromRotationMatrix(mOrientacion.makeBasis(ejeLado, ejeArriba, ejeFrente));

  // La carrocería sigue a las ruedas con un poco de suavidad (amortiguación)
  rover.position.y = THREE.MathUtils.damp(rover.position.y, suma / ruedas.length, 12, dt);
  rover.quaternion.slerp(qObjetivo, 1 - Math.exp(-10 * dt));
  qRumbo.setFromAxisAngle(ARRIBA, rumbo);

  animarRuedas(dt);
}

// --- Herramientas de prueba (las usa la consola o npm run check) ---
window.estadoRover = () => ({
  x: rover.position.x,
  z: rover.position.z,
  velocidad,
  rodar: ruedas.map((r) => r.rodar?.rotation.x ?? 0),
  direccion: ruedas.map((r) => r.direccion?.rotation.y ?? 0),
});
window.colocarRover = (x, z, nuevoRumbo) => {
  rover.position.set(x, alturaTerreno(x, z), z);
  rumbo = nuevoRumbo;
  velocidad = velGiro = 0;
  actualizarDirecciones();
};
window.rocaGrandeCercana = () => {
  const grandes = listaRocas.filter(esObstaculo);
  grandes.sort((a, b) => Math.hypot(a.x, a.z - 30) - Math.hypot(b.x, b.z - 30));
  return grandes[0];
};

// --- Ruedas: dirigir (las 4 de las esquinas) y rodar (las 6) ---
function animarRuedas(dt) {
  const enSitio = Math.abs(velocidad) < 0.3 && Math.abs(velGiro) > 0.05;
  for (const r of ruedas) {
    if (!r.direccion) continue; // el modelo aún no carga
    let objetivo = 0;
    if (r.esquina) {
      // Girar sobre sí mismo: las ruedas forman un "diamante" alrededor del centro.
      // En curva: las de adelante apuntan hacia la curva y las de atrás al revés.
      objetivo = enSitio ? Math.atan(-r.z / r.x) : Math.sign(r.z) * (velGiro / VEL_GIRO) * 0.35;
    }
    r.direccion.rotation.y = THREE.MathUtils.damp(r.direccion.rotation.y, objetivo, 6, dt);

    // Velocidad del punto de apoyo de esta rueda = avance + giro del rover alrededor de su centro
    const vx = velGiro * r.z;
    const vz = velocidad - velGiro * r.x;
    const angulo = r.direccion.rotation.y;
    const rodando = vx * Math.sin(angulo) + vz * Math.cos(angulo);
    r.rodar.rotation.x += (rodando * dt) / RADIO_RUEDA;
  }
}

// =====================================================================
// HUELLAS: marcas de las ruedas que quedan en la arena
// =====================================================================
function texturaHuella() {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 64;
  const ctx = lienzo.getContext('2d');
  // Bandas del dibujo de la rueda, perpendiculares al avance
  ctx.fillStyle = 'rgba(70, 25, 10, 0.55)';
  ctx.fillRect(4, 0, 56, 64);
  ctx.fillStyle = 'rgba(45, 15, 5, 0.9)';
  for (let y = 0; y < 64; y += 16) ctx.fillRect(4, y, 56, 7);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

const MAX_HUELLAS = 4000;
let SEPARACION_RUEDAS = 1.1; // metros del centro a cada fila de ruedas (se mide al cargar el modelo)
const PASO_HUELLA = 0.3; // cada cuántos metros se marca
const geoHuella = new THREE.PlaneGeometry(0.42, PASO_HUELLA).rotateX(-Math.PI / 2);
const huellas = new THREE.InstancedMesh(
  geoHuella,
  new THREE.MeshStandardMaterial({
    map: texturaHuella(),
    transparent: true,
    depthWrite: false,
    roughness: 1,
    polygonOffset: true, // que no "parpadee" contra el suelo
    polygonOffsetFactor: -4,
  }),
  MAX_HUELLAS
);
huellas.count = 0;
huellas.frustumCulled = false;
huellas.receiveShadow = true;
scene.add(huellas);

let siguienteHuella = 0;
let recorrido = 0;
const posHuella = new THREE.Vector3();
const qHuella = new THREE.Quaternion();
const UNO = new THREE.Vector3(1, 1, 1);

window.recorridoTotal = 0; // metros manejados (lo usa npm run check)

function dejarHuellas(dt) {
  recorrido += Math.abs(velocidad * dt);
  window.recorridoTotal += Math.abs(velocidad * dt);
  if (recorrido < PASO_HUELLA) return;
  recorrido = 0;
  for (const lado of [-1, 1]) {
    posHuella.copy(rover.position).addScaledVector(izquierda, lado * SEPARACION_RUEDAS);
    posHuella.y = alturaTerreno(posHuella.x, posHuella.z) + 0.04;
    qInclinacion.setFromUnitVectors(ARRIBA, normalTerreno(posHuella.x, posHuella.z));
    qHuella.multiplyQuaternions(qInclinacion, qRumbo);
    huellas.setMatrixAt(siguienteHuella, matriz.compose(posHuella, qHuella, UNO));
    siguienteHuella = (siguienteHuella + 1) % MAX_HUELLAS; // las más viejas se reciclan
    huellas.count = Math.min(huellas.count + 1, MAX_HUELLAS);
  }
  huellas.instanceMatrix.needsUpdate = true;
}

// --- Cámara que sigue al rover (y se puede girar con el mouse) ---
const ultimaPosRover = rover.position.clone();
const detras = new THREE.Vector3();

function seguirRover(dt) {
  // La cámara se mueve lo mismo que el rover, así no se pierde el giro del mouse
  camera.position.add(detras.subVectors(rover.position, ultimaPosRover));
  ultimaPosRover.copy(rover.position);
  controls.target.copy(rover.position).y += ALTO_MIRADA;

  // Mientras maneja, la cámara se acomoda poco a poco detrás del rover
  if (Math.abs(velocidad) > 0.3) {
    detras.copy(rover.position).addScaledVector(adelante, -DIST_CAMARA);
    detras.y = rover.position.y + ALTO_CAMARA;
    camera.position.lerp(detras, 1 - Math.exp(-1.5 * dt));
  }
  // Nunca debajo de la arena
  const suelo = alturaTerreno(camera.position.x, camera.position.z) + 0.8;
  if (camera.position.y < suelo) camera.position.y = suelo;
}

// --- Ajustar al cambiar el tamaño de la ventana ---
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// =====================================================================
// ANIMACIÓN
// =====================================================================
const reloj = new THREE.Timer();
renderer.setAnimationLoop((tiempo) => {
  reloj.update(tiempo);
  // Tiempo real desde el cuadro anterior (máximo 1 s, por si la pestaña estuvo oculta)
  const dt = Math.min(reloj.getDelta(), 1);
  const t = reloj.getElapsed();

  // El polvo viaja con el viento y se recicla al salir de la caja
  const p = geoPolvo.attributes.position;
  for (let i = 0; i < CANT_POLVO; i++) {
    let x = p.getX(i) + VIENTO.x * dt * 2.5;
    let z = p.getZ(i) + VIENTO.y * dt * 2.5;
    const y = p.getY(i) + Math.sin(t + i) * dt * 0.15;
    if (x > ZONA / 2) x -= ZONA;
    if (z > ZONA / 2) z -= ZONA;
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;

  // Rover: manejar y dejar huellas en pasos pequeños (así funciona igual aunque el equipo dibuje lento)
  buscarRocasCerca();
  const pasos = Math.ceil(dt / (1 / 60));
  for (let i = 0; i < pasos; i++) {
    moverRover(dt / pasos);
    dejarHuellas(dt / pasos);
  }
  seguirRover(dt);

  // El polvo acompaña a la cámara
  polvo.position.set(camera.position.x, camera.position.y - altoCamara, camera.position.z);

  // El sol y su zona de sombras siguen al rover
  sol.target.position.copy(rover.position);
  sol.position.copy(rover.position).addScaledVector(DIR_SOL, 150);

  // Las lunas giran despacio sobre sí mismas y Fobos avanza por el cielo
  fobos.rotation.y = t * 0.05;
  deimos.rotation.y = t * 0.03;
  fobos.position.copy(DIR_FOBOS).applyAxisAngle(ARRIBA, -t * 0.002).multiplyScalar(700).add(camera.position);
  deimos.position.copy(DIR_DEIMOS).multiplyScalar(750).add(camera.position);

  // El cielo y las lunas siguen a la cámara (están "en el infinito")
  cielo.position.copy(camera.position);

  controls.update();
  renderer.render(scene, camera);
});
