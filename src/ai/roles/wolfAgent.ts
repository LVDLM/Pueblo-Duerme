/**
 * wolfAgent.js
 * Rol Lobo: Elige víctima nocturna.
 */

import { BaseAgent } from './baseAgent';

export class WolfAgent extends BaseAgent {
  constructor(config) {
    super(config);
  }

  nightAction(gameState) {
    // Si ya hay una víctima elegida por otros lobos (coordinación)
    if (gameState.currentNightVictimId) {
      return { type: 'WOLF_ATTACK', targetId: gameState.currentNightVictimId };
    }

    // Los lobos no se atacan entre ellos
    const allies = gameState.players
      .filter(p => p.role === 'wolf')
      .map(p => p.id);
    
    const targets = this.allPlayerIds.filter(id => 
      !allies.includes(id) && 
      !gameState.deadPlayers?.includes(id)
    );

    if (targets.length === 0) return null;

    // Atacar al que menos sospeche de nosotros o al más sospechoso según el pueblo
    // Para simplificar: atacar al azar entre los que no son lobos
    const targetId = targets[Math.floor(Math.random() * targets.length)];

    return { type: 'WOLF_ATTACK', targetId };
  }

  // Sobrescribir voto para no votar a aliados lobos
  castVote(gameState) {
    const allies = gameState.players
      .filter(p => p.role === 'wolf')
      .map(p => p.id);

    const targets = this.allPlayerIds.filter(id => 
      !allies.includes(id) && 
      !gameState.deadPlayers?.includes(id) &&
      id !== this.id
    );

    if (targets.length === 0) return null;

    const sorted = targets.sort((a, b) => (this.suspicionMap[b] || 0) - (this.suspicionMap[a] || 0));
    return sorted[0];
  }
}
