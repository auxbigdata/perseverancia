// Posición de la Tierra y de Marte alrededor del Sol, para calcular la distancia entre ambos.
// Usa los "elementos orbitales aproximados" de JPL/NASA (Standish), válidos de 1800 a 2050.
// Error típico: menos de 1 minuto de arco, más que suficiente para el tiempo de luz.

const GRADOS = Math.PI / 180;
const UA_KM = 149597870.7; // una unidad astronómica en km
const LUZ_KM_S = 299792.458; // velocidad de la luz

// [valor en J2000, cambio por siglo] para: a (UA), e, I, L, ϖ (longitud del perihelio), Ω (nodo), en grados
const ORBITAS = {
  tierra: {
    a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0],
  },
  marte: {
    a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343],
  },
};

// Posición (x, y, z) en UA de un planeta en una fecha
function posicion(planeta, fecha) {
  const T = (fecha.getTime() / 86400000 + 2440587.5 - 2451545) / 36525; // siglos desde el año 2000
  const el = {};
  for (const [k, [v0, dv]] of Object.entries(ORBITAS[planeta])) el[k] = v0 + dv * T;
  const I = el.I * GRADOS, O = el.O * GRADOS, w = (el.w - el.O) * GRADOS;
  // Anomalía media y ecuación de Kepler (se resuelve por aproximaciones)
  const M = ((((el.L - el.w) % 360) + 540) % 360 - 180) * GRADOS;
  let E = M + el.e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E));
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  // Girar del plano de la órbita al plano de la eclíptica
  return {
    x: (Math.cos(w) * Math.cos(O) - Math.sin(w) * Math.sin(O) * Math.cos(I)) * xp +
       (-Math.sin(w) * Math.cos(O) - Math.cos(w) * Math.sin(O) * Math.cos(I)) * yp,
    y: (Math.cos(w) * Math.sin(O) + Math.sin(w) * Math.cos(O) * Math.cos(I)) * xp +
       (-Math.sin(w) * Math.sin(O) + Math.cos(w) * Math.cos(O) * Math.cos(I)) * yp,
    z: Math.sin(w) * Math.sin(I) * xp + Math.cos(w) * Math.sin(I) * yp,
  };
}

// Distancia Tierra–Marte en km
export function distanciaTierraMarte(fecha) {
  const t = posicion('tierra', fecha), m = posicion('marte', fecha);
  return Math.hypot(m.x - t.x, m.y - t.y, m.z - t.z) * UA_KM;
}

// Minutos que tarda la luz (o una orden por radio) en ir de la Tierra a Marte
export function minutosLuz(fecha) {
  return distanciaTierraMarte(fecha) / LUZ_KM_S / 60;
}
