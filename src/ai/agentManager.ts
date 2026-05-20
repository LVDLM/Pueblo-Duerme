/**
 * agentManager.js
 * Punto de entrada principal del sistema de IA.
 * Crea, inicializa y orquesta todos los agentes según la fase del juego.
 */

import { VillagerAgent } from './roles/villagerAgent';
import { WolfAgent } from './roles/wolfAgent';
import { WitchAgent } from './roles/witchAgent';
import { CupidAgent } from './roles/cupidAgent';
import { filterGameState } from './utils/knowledgeFilter';

// ─── Factoría de agentes ──────────────────────────────────────────────────────

const ROLE_MAP = {
  villager: VillagerAgent,
  wolf: WolfAgent,
  witch: WitchAgent,
  cupid: CupidAgent,
};

/**
 * Crea un agente del tipo correcto según el rol.
 * @param {Object} playerConfig - { id, name, role, personality? }
 * @returns {BaseAgent}
 */
function createAgent(playerConfig) {
  const AgentClass = ROLE_MAP[playerConfig.role] ?? VillagerAgent;
  return new AgentClass(playerConfig);
}

// ─── AgentManager ─────────────────────────────────────────────────────────────

export class AgentManager {
  /**
   * @param {Object[]} aiPlayers - Lista de jugadores IA con { id, name, role, personality? }
   */
  constructor(aiPlayers) {
    this.agents = {};
    aiPlayers.forEach((p) => {
      this.agents[p.id] = createAgent(p);
    });

    const allIds = aiPlayers.map((p) => p.id);
    Object.values(this.agents).forEach((agent) => agent.init(allIds));
  }

  // ─── Fase nocturna ────────────────────────────────────────────────────

  /**
   * Ejecuta las acciones nocturnas de todos los agentes IA activos.
   * Las acciones se devuelven ordenadas por prioridad de rol:
   * cupid → wolves → witch
   *
   * @param {Object} gameState - Estado global del juego
   * @returns {Object[]} Array de acciones { agentId, ...action }
   */
  resolveNightActions(gameState) {
    const priority = ['cupid', 'wolf', 'witch', 'villager'];
    const actions = [];

    const sortedAgents = Object.values(this.agents)
      .filter((a) => a.isAlive)
      .sort((a, b) => priority.indexOf(a.role) - priority.indexOf(b.role));

    for (const agent of sortedAgents) {
      const filteredState = filterGameState(gameState, agent);
      const action = agent.nightAction(filteredState);
      if (action) {
        actions.push({ agentId: agent.id, ...action });
      }
    }

    return actions;
  }

  // ─── Fase diurna: debate y votación ──────────────────────────────────

  /**
   * Cada agente IA genera una acusación para el debate.
   * @param {Object} gameState
   * @returns {Object[]} Array de { agentId, targetId, message }
   */
  generateAccusations(gameState) {
    return Object.values(this.agents)
      .filter((a) => a.isAlive)
      .map((agent) => {
        const filteredState = filterGameState(gameState, agent);
        const accusation = agent.generateAccusation(filteredState);
        return accusation ? { agentId: agent.id, ...accusation } : null;
      })
      .filter(Boolean);
  }

  /**
   * Cada agente IA emite su voto final.
   * @param {Object} gameState - Debe incluir currentVotes para que los followers funcionen
   * @returns {Object[]} Array de { agentId, votedFor }
   */
  resolveVotes(gameState) {
    return Object.values(this.agents)
      .filter((a) => a.isAlive)
      .map((agent) => {
        const filteredState = filterGameState(gameState, agent);
        const votedFor = agent.castVote(filteredState);
        return votedFor ? { agentId: agent.id, votedFor } : null;
      })
      .filter(Boolean);
  }

  // ─── Gestión de estado ────────────────────────────────────────────────

  /**
   * Marca un agente como muerto (no participa en más fases).
   * @param {string} playerId
   */
  killAgent(playerId) {
    if (this.agents[playerId]) {
      this.agents[playerId].isAlive = false;
    }
  }

  /**
   * Propaga un evento de juego a todos los agentes vivos para que
   * actualicen sus mapas de sospecha.
   * @param {Object} event - { type, subjectId?, objectId?, round }
   */
  broadcastEvent(event) {
    Object.values(this.agents)
      .filter((a) => a.isAlive)
      .forEach((agent) => agent.onEvent(event));
  }

  /**
   * Devuelve el agente con el ID dado (útil para inspección/debug).
   * @param {string} id
   * @returns {BaseAgent|undefined}
   */
  getAgent(id) {
    return this.agents[id];
  }

  /**
   * Devuelve un resumen del estado de todos los agentes (útil para debug en dev).
   */
  debugSnapshot() {
    return Object.values(this.agents).map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      personality: a.personality,
      isAlive: a.isAlive,
      suspicionMap: a.suspicionMap,
    }));
  }
}
