/**
 * knowledgeFilter.js
 * Filtra el gameState según el rol del agente.
 * Un aldeano no sabe quién es lobo; un lobo sí conoce a sus compañeros.
 */

/**
 * Devuelve una "vista" del gameState adaptada al rol del agente.
 *
 * @param {Object} gameState - Estado global del juego
 * @param {Object} agent     - El agente que solicita la vista { id, role, knownAllies }
 * @returns {Object}         - Vista filtrada del estado
 */
export function filterGameState(gameState, agent) {
  const { players, phase, round, deadPlayers = [], loversIds = [] } = gameState;

  // Jugadores vivos visibles para todos
  const alivePlayers = players.filter((p) => !deadPlayers.includes(p.id));

  // Información base que cualquier jugador conoce
  const baseView = {
    phase,
    round,
    alivePlayers: alivePlayers.map((p) => ({
      id: p.id,
      name: p.name,
      isHuman: p.isHuman,
      // El rol solo se revela si el jugador está muerto (carta boca arriba)
      role: deadPlayers.includes(p.id) ? p.role : null,
    })),
    deadPlayers: deadPlayers.map((id) => {
      const p = players.find((pl) => pl.id === id);
      return p ? { id: p.id, name: p.name, role: p.role } : { id };
    }),
    agentId: agent.id,
  };

  // Conocimiento extra según rol
  switch (agent.role) {
    case 'wolf': {
      // Los lobos se conocen entre sí
      const wolfAllies = alivePlayers
        .filter((p) => p.role === 'wolf' && p.id !== agent.id)
        .map((p) => p.id);

      return {
        ...baseView,
        knownWolves: wolfAllies,
        // Los lobos ven los roles de sus aliados
        alivePlayers: baseView.alivePlayers.map((p) =>
          wolfAllies.includes(p.id) ? { ...p, role: 'wolf' } : p
        ),
      };
    }

    case 'witch': {
      // La bruja conoce su propio inventario de pociones
      const healUsed = gameState.witchHealUsed || (agent.potions && !agent.potions.heal);
      const poisonUsed = gameState.witchPoisonUsed || (agent.potions && !agent.potions.poison);
      
      return {
        ...baseView,
        potions: { 
          heal: !healUsed, 
          poison: !poisonUsed 
        },
        // La bruja sabe quién fue atacado esta noche (se lo dice el narrador)
        nightVictimId: gameState.currentNightVictimId ?? null,
      };
    }

    case 'cupid': {
      // Cupido conoce a los enamorados si ya los eligió
      return {
        ...baseView,
        loversIds,
      };
    }

    case 'villager':
    default:
      // Aldeano: solo información pública
      return baseView;
  }
}
