/**
 * villagerAgent.js
 * Rol Aldeano: No tiene acción nocturna.
 */

import { BaseAgent } from './baseAgent';

export class VillagerAgent extends BaseAgent {
  constructor(config) {
    super(config);
  }

  nightAction(gameState) {
    // Los aldeanos duermen plácidamente
    return null;
  }
}
