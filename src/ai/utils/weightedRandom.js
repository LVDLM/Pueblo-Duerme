/**
 * weightedRandom.js
 * Selecciona un elemento de un array según pesos numéricos.
 * Mayor peso = mayor probabilidad de ser elegido.
 */

/**
 * @param {Array} items - Array de elementos a elegir
 * @param {Function} weightFn - Función que recibe cada item y devuelve su peso (número >= 0)
 * @returns {*} El elemento seleccionado, o null si el array está vacío
 */
export function weightedRandom(items, weightFn) {
  if (!items || items.length === 0) return null;

  const weights = items.map((item) => Math.max(0, weightFn(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);

  // Si todos los pesos son 0, elegir uniformemente al azar
  if (total === 0) {
    return items[Math.floor(Math.random() * items.length)];
  }

  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }

  // Fallback por precisión flotante
  return items[items.length - 1];
}

/**
 * Devuelve un número entero aleatorio entre min y max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Devuelve true con probabilidad `p` (entre 0 y 1)
 */
export function chance(p) {
  return Math.random() < p;
}
