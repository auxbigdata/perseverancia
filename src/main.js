// Paisaje de Marte de película: dunas, rocas, cielo caramelo con polvo, sol de tarde y las dos lunas
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

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

const geo = new THREE.PlaneGeometry(400, 400, 320, 320);
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

const suelo = new THREE.Mesh(
  geo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
);
suelo.receiveShadow = true;
suelo.castShadow = true; // las dunas se hacen sombra entre sí
scene.add(suelo);

// =====================================================================
// CÁMARA: baja, mirando hacia el sol y las lunas sobre las dunas
// =====================================================================
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
const altoCamara = alturaTerreno(0, 45) + 4;
camera.position.set(0, altoCamara, 45);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, altoCamara + 1.5, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.52; // que no se meta bajo el suelo

// =====================================================================
// LUZ: sol de tarde cálido con sombras suaves + luz del cielo polvoriento
// =====================================================================
const sol = new THREE.DirectionalLight('#ffbf80', 3.2);
sol.position.copy(DIR_SOL).multiplyScalar(150);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
sol.shadow.camera.left = -120;
sol.shadow.camera.right = 120;
sol.shadow.camera.top = 120;
sol.shadow.camera.bottom = -120;
sol.shadow.camera.far = 400;
sol.shadow.bias = -0.0002;
sol.shadow.normalBias = 0.4; // evita el granulado ("acné") de sombra sobre la arena
sol.shadow.radius = 4; // bordes de sombra más suaves
scene.add(sol);
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

// =====================================================================
// ROCAS: piedras irregulares repartidas sobre la arena
// =====================================================================
function crearGeometriaRoca(semillaForma, rugosidad = 0.35) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = ruido.noise3d(v.x * 1.3 + semillaForma, v.y * 1.3, v.z * 1.3);
    v.multiplyScalar(1 + n * rugosidad);
    v.y *= 0.65 + (0.35 - rugosidad); // rocas más achatadas, lunas más redondas
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const materialRoca = new THREE.MeshStandardMaterial({ color: '#8a4a2e', roughness: 0.9, flatShading: true });
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
    // No poner rocas pegadas a la cámara
    if (Math.hypot(x, z - 45) < 14) x += 30;
    // Algunas rocas grandes, la mayoría pequeñas
    const tam = azar() < 0.1 ? 1.5 + azar() * 2 : 0.2 + azar() * 0.7;
    posRoca.set(x, alturaTerreno(x, z) - tam * 0.2, z);
    cuaternion.setFromEuler(new THREE.Euler(azar() * 0.4, azar() * Math.PI * 2, azar() * 0.4));
    escala.set(tam * (0.8 + azar() * 0.5), tam, tam * (0.8 + azar() * 0.5));
    rocas.setMatrixAt(i, matriz.compose(posRoca, cuaternion, escala));
  }
  scene.add(rocas);
}

// Unas cuantas rocas grandes en primer plano para dar profundidad
const rocaGrande = new THREE.Mesh(crearGeometriaRoca(99), materialRoca);
[[-6, 32, 0.9], [5, 29, 0.6], [-1, 24, 0.4], [9, 34, 0.5]].forEach(([x, z, tam]) => {
  const r = rocaGrande.clone();
  r.position.set(x, alturaTerreno(x, z) - tam * 0.15, z);
  r.scale.set(tam * 1.3, tam, tam);
  r.rotation.y = x;
  r.castShadow = r.receiveShadow = true;
  scene.add(r);
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

// --- Ajustar al cambiar el tamaño de la ventana ---
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// =====================================================================
// ANIMACIÓN
// =====================================================================
const reloj = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(reloj.getDelta(), 0.1);
  const t = reloj.elapsedTime;

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
  polvo.position.set(camera.position.x, 0, camera.position.z);

  // Las lunas giran despacio sobre sí mismas y Fobos avanza por el cielo
  fobos.rotation.y = t * 0.05;
  deimos.rotation.y = t * 0.03;
  fobos.position.copy(DIR_FOBOS).applyAxisAngle(new THREE.Vector3(0, 1, 0), -t * 0.002).multiplyScalar(700);

  // El cielo y las lunas siguen a la cámara (están "en el infinito")
  cielo.position.copy(camera.position);

  controls.update();
  renderer.render(scene, camera);
});
