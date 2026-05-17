/**
 * suspicionEngine.js
 * Gestiona el mapa de sospecha de cada agente IA.
 * La sospecha es un valor entre 0 y 100 que representa cuánto
 * sospecha un agente de otro jugador.
 */

// Constantes de ajuste de sospecha
export const SUSPICION = {
  // Aumentos
  VOTED_AGAINST_ALLY: 25,      // Votó contra alguien que yo defiendo
  ACCUSED_INNOCENT: 20,        // Acusó a alguien que resultó inocente
  DEFENDED_A_WOLF: 30,         // Defendió a un lobo revelado
  SUSPICIOUS_BEHAVIOR: 10,     // Comportamiento genérico sospechoso
  VOTED_AGAINST_ME: 15,        // Votó contra mí (ego defensivo)

  // Reducciones
  VOTED_WITH_ME: -8,           // Votamos igual (afinidad)
  ACCUSED_A_WOLF: -20,         // Acusó a alguien que resultó ser lobo
  SAVED_ALLY: -15,             // (Bruja) salvó a un aliado mío

  // Límites
  MIN: 0,
  MAX: 100,
};

/**
 * Crea un mapa de sospecha inicial para un agente.
 * @param {string[]} playerIds - IDs de todos los jugadores excepto el propio agente
 * @param {number} baseValue - Valor inicial de sospecha (por defecto 20)
 * @returns {Object} mapa { playerId: número }
 */
export function createSuspicionMap(playerIds, baseValue = 20) {
  return playerIds.reduce((map, id) => {
    map[id] = baseValue + Math.floor(Math.random() * 10) - 5; // algo de varianza inicial
    return map;
  }, {});
}

/**
 * Ajusta la sospecha sobre un jugador concreto.
 * @param {Object} suspicionMap - Mapa actual del agente
 * @param {string} targetId - ID del jugador sobre el que se ajusta
 * @param {number} delta - Cantidad a sumar (puede ser negativa)
 * @returns {Object} Nuevo mapa (inmutable)
 */
export function adjustSuspicion(suspicionMap, targetId, delta) {
  if (!(targetId in suspicionMap)) return suspicionMap;
  const current = suspicionMap[targetId];
  const next = Math.min(SUSPICION.MAX, Math.max(SUSPICION.MIN, current + delta));
  return { ...suspicionMap, [targetId]: next };
}

/**
 * Devuelve el jugador con mayor sospecha del mapa,
 * excluyendo los IDs indicados (por ejemplo, aliados lobos).
 * @param {Object} suspicionMap
 * @param {string[]} excludeIds
 * @returns {string|null} ID del jugador más sospechoso
 */
export function getMostSuspected(suspicionMap, excludeIds = []) {
  const candidates = Object.entries(suspicionMap)
    .filter(([id]) => !excludeIds.includes(id))
    .sort(([, a], [, b]) => b - a);

  return candidates.length > 0 ? candidates[0][0] : null;
}

/**
 * Devuelve el jugador con menor sospecha (más "de fiar").
 * @param {Object} suspicionMap
 * @param {string[]} excludeIds
 * @returns {string|null}
 */
export function getLeastSuspected(suspicionMap, excludeIds = []) {
  const candidates = Object.entries(suspicionMap)
    .filter(([id]) => !excludeIds.includes(id))
    .sort(([, a], [, b]) => a - b);

  return candidates.length > 0 ? candidates[0][0] : null;
}

/**
 * Actualiza el mapa de sospecha de un agente tras un evento de juego.
 * @param {Object} suspicionMap - Mapa actual
 * @param {Object} event - { type, subjectId, objectId }
 * @returns {Object} Mapa actualizado
 */
export function processEvent(suspicionMap, event) {
  switch (event.type) {
    case 'VOTED_AGAINST':
      // subjectId votó contra objectId
      return adjustSuspicion(suspicionMap, event.subjectId, SUSPICION.VOTED_AGAINST_ALLY);

    case 'VOTED_WITH':
      return adjustSuspicion(suspicionMap, event.subjectId, SUSPICION.VOTED_WITH_ME);

    case 'WOLF_REVEALED':
      // objectId era lobo; quien lo defendía sube sospecha
      return event.defenderId
        ? adjustSuspicion(suspicionMap, event.defenderId, SUSPICION.DEFENDED_A_WOLF)
        : suspicionMap;

    case 'INNOCENT_KILLED':
      // Quien acusó a un inocente que fue ejecutado sube sospecha
      return event.accuserId
        ? adjustSuspicion(suspicionMap, event.accuserId, SUSPICION.ACCUSED_INNOCENT)
        : suspicionMap;

    default:
      return suspicionMap;
  }
}
