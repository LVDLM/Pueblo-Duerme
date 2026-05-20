/**
 * cupidAgent.js
 * Rol Cupido: En la primera noche elige a dos enamorados.
 */

import { BaseAgent } from './baseAgent';

export class CupidAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.hasActed = false;
  }

  nightAction(gameState) {
    if (this.hasActed || gameState.round > 1) return null;

    const targets = this.allPlayerIds.filter(id => !gameState.deadPlayers?.includes(id));
    if (targets.length < 2) return null;

    // Elegir dos al azar
    const shuffled = [...targets].sort(() => 0.5 - Math.random());
    const lover1Id = shuffled[0];
    const lover2Id = shuffled[1];

    this.hasActed = true;
    return { type: 'CUPID_CHOOSE', lover1Id, lover2Id };
  }
}
