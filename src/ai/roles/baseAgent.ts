/**
 * baseAgent.js
 * Clase base para todos los agentes de IA.
 * Gestiona personalidad, memorización de eventos y mapas de sospecha.
 */

import { processEvent, adjustSuspicion } from '../utils/suspicionEngine.js';
import { weightedRandom } from '../utils/weightedRandom.js';

export class BaseAgent {
  constructor({ id, name, role, personality }) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.allPlayerIds = [];
    this.personality = personality || this.getRandomPersonality();
    this.isAlive = true;
    this.suspicionMap = {}; // { playerId: 0-100 }
  }

  getRandomPersonality() {
    const options = [
      { id: 'cautious', weight: 30 },
      { id: 'aggressive', weight: 30 },
      { id: 'follower', weight: 20 },
      { id: 'random', weight: 20 },
    ];
    return weightedRandom(options, (opt) => opt.weight).id;
  }

  /**
   * Inicializa el agente con todos los IDs de jugadores.
   */
  init(allPlayerIds) {
    this.allPlayerIds = allPlayerIds;
    allPlayerIds.forEach((id) => {
      if (id !== this.id) {
        this.suspicionMap[id] = 10 + Math.random() * 20; // Sospecha inicial base
      }
    });
  }

  /**
   * Escucha eventos globales y actualiza sospecha según personalidad.
   */
  onEvent(event) {
    if (!this.isAlive) return;

    // Actualizar mapa usando el motor estándar
    const newMap = processEvent(this.suspicionMap, event);
    
    // Si la personalidad es agresiva y alguien votó contra mí, subirle más la sospecha
    if (this.personality === 'aggressive' && event.type === 'VOTED_AGAINST' && event.objectId === this.id) {
       this.suspicionMap = adjustSuspicion(newMap, event.subjectId, 10);
    } else {
       this.suspicionMap = newMap;
    }
  }

  updateSuspicion(playerId, delta) {
    if (playerId === this.id) return;
    this.suspicionMap = adjustSuspicion(this.suspicionMap, playerId, delta);
  }

  /**
   * Decide a quién votar basándose en sospecha y roles.
   */
  castVote(gameState) {
    if (this.personality === 'follower' && gameState.currentVotes) {
      const topVoted = Object.entries(gameState.currentVotes).sort(([, a], [, b]) => b - a)[0];
      if (topVoted && topVoted[1] > 1) return topVoted[0];
    }

    // Filtrar vivos y no uno mismo
    const targets = this.allPlayerIds.filter(id => id !== this.id && !gameState.deadPlayers?.includes(id));
    if (targets.length === 0) return null;

    // Votar al de mayor sospecha con un poco de aleatoriedad
    const sorted = targets.sort((a, b) => (this.suspicionMap[b] || 0) - (this.suspicionMap[a] || 0));
    return sorted[0];
  }

  /**
   * Genera una acusación para el chat.
   */
  generateAccusation(gameState) {
    const targetId = this.castVote(gameState);
    if (!targetId) return null;

    const targetName = gameState.players?.find(p => p.id === targetId)?.name || 'alguien';
    const messages = {
      cautious: [`Me parece que ${targetName} está actuando raro...`, `No confío mucho en ${targetName} por ahora.`],
      aggressive: [`¡Es ${targetName}, estoy seguro!`, `Tenemos que eliminar a ${targetName} ya.`],
      follower: [`Estoy de acuerdo con votar a ${targetName}.`, `Sí, ${targetName} parece sospechoso.`],
      random: [`Voto a ${targetName} por intuición.`, `${targetName} tiene cara de lobo.`],
    };

    const personalityMsgs = messages[this.personality] || messages.random;
    const message = personalityMsgs[Math.floor(Math.random() * personalityMsgs.length)];

    return { targetId, message };
  }

  /**
   * Acción por defecto (sobreescribir en subclases).
   */
  nightAction(gameState) {
    return null;
  }
}
