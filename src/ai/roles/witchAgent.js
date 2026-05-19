/**
 * witchAgent.js
 * Rol Bruja: Puede curar o envenenar una vez por partida.
 */

import { BaseAgent } from './baseAgent.js';

export class WitchAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.hasHeal = true;
    this.hasPoison = true;
  }

  nightAction(gameState) {
    const action = { type: 'WITCH_ACTION', heal: false, poison: false };

    // Decidir si curar
    if (this.hasHeal && gameState.currentNightVictimId) {
      const victimId = gameState.currentNightVictimId;
      const victim = gameState.players.find(p => p.id === victimId);
      
      // Curar si es ella misma o alguien con poca sospecha
      const shouldHeal = victimId === this.id || (this.suspicionMap[victimId] || 0) < 40;
      
      if (shouldHeal) {
        action.heal = true;
        action.healTargetId = victimId;
        this.hasHeal = false;
      }
    }

    // Decidir si envenenar (solo si no curó, para no ser tan agresiva en un turno)
    if (this.hasPoison && !action.heal) {
      const targets = this.allPlayerIds.filter(id => 
        id !== this.id && 
        !gameState.deadPlayers?.includes(id) &&
        (this.suspicionMap[id] || 0) > 80 // Solo envenenar si está muy segura
      );

      if (targets.length > 0) {
        action.poison = true;
        action.poisonTargetId = targets[0];
        this.hasPoison = false;
      }
    }

    return (action.heal || action.poison) ? action : null;
  }
}
