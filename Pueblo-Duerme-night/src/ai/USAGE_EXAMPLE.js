/**
 * EJEMPLO DE USO — No es un componente real, es pseudocódigo comentado
 * para mostrar cómo integrar el sistema de IA en tu lógica de juego existente.
 *
 * Estructura de gameState esperada por el sistema:
 * {
 *   players: [{ id, name, role, isHuman }],
 *   deadPlayers: [id, ...],
 *   phase: 'night' | 'day' | 'vote',
 *   round: number,
 *   currentNightVictimId: string | null,   // quién atacaron los lobos esta noche
 *   loversIds: [id, id] | [],              // pareja de cupido
 *   currentVotes: { [playerId]: number },  // votos acumulados en la fase diurna
 * }
 */

import { useAIAgents } from './hooks/useAIAgents.js';

// ─── Inicialización ───────────────────────────────────────────────────────────

// Separar jugadores humanos de IA al crear la partida
const humanPlayers = players.filter((p) => p.isHuman);
const aiPlayers = players.filter((p) => !p.isHuman);
// aiPlayers ya deben tener { id, name, role } asignados por tu lógica de juego

const {
  resolveNight,
  generateAccusations,
  resolveVotes,
  broadcastEvent,
  killAgent,
  reset,
} = useAIAgents(aiPlayers);

// ─── FASE NOCTURNA ────────────────────────────────────────────────────────────

function handleNightPhase(gameState) {
  // 1. Ejecutar acciones de los agentes IA
  const actions = resolveNight(gameState);

  // 2. Procesar cada acción en tu motor de juego
  actions.forEach((action) => {
    switch (action.type) {
      case 'CUPID_CHOOSE':
        // Guardar enamorados en gameState
        setGameState((s) => ({ ...s, loversIds: [action.lover1Id, action.lover2Id] }));
        break;

      case 'WOLF_ATTACK':
        // Guardar víctima nocturna (la bruja la verá después)
        setGameState((s) => ({ ...s, currentNightVictimId: action.targetId }));
        break;

      case 'WITCH_ACTION':
        if (action.heal && action.healTargetId) {
          // Cancelar la muerte del atacado
          setGameState((s) => ({ ...s, currentNightVictimId: null }));
        }
        if (action.poison && action.poisonTargetId) {
          // Matar al objetivo envenenado
          killPlayer(action.poisonTargetId);
        }
        break;
    }
  });

  // 3. Aplicar la muerte del ataque lobo si nadie la curó
  if (gameState.currentNightVictimId) {
    killPlayer(gameState.currentNightVictimId);
    broadcastEvent({
      type: 'WOLF_ATTACK_RESOLVED',
      objectId: gameState.currentNightVictimId,
      round: gameState.round,
    });
  }
}

// ─── FASE DIURNA: DEBATE ──────────────────────────────────────────────────────

function handleDebatePhase(gameState) {
  // Los agentes IA generan sus acusaciones
  const accusations = generateAccusations(gameState);

  // Mostrar las acusaciones en tu UI como mensajes de chat
  accusations.forEach(({ agentId, targetId, message }) => {
    addChatMessage({ authorId: agentId, text: message });

    // Propagar el evento para actualizar sospechas
    broadcastEvent({
      type: 'VOTED_AGAINST',
      subjectId: agentId,
      objectId: targetId,
      round: gameState.round,
    });
  });
}

// ─── FASE DE VOTACIÓN ─────────────────────────────────────────────────────────

function handleVotePhase(gameState) {
  // 1. Recoger votos de jugadores humanos (tu lógica existente)
  const humanVotes = collectHumanVotes();

  // 2. Recoger votos de agentes IA
  //    Pasar currentVotes para que los "followers" los tengan en cuenta
  const currentVotes = tallyVotes(humanVotes);
  const aiVotes = resolveVotes({ ...gameState, currentVotes });

  // 3. Combinar y contar
  const allVotes = [...humanVotes, ...aiVotes];
  const finalTally = tallyVotes(allVotes);

  // 4. Eliminar al más votado
  const eliminated = getTopVoted(finalTally);
  killPlayer(eliminated);

  // 5. Revelar carta y propagar evento
  const eliminatedPlayer = gameState.players.find((p) => p.id === eliminated);
  if (eliminatedPlayer) {
    broadcastEvent({
      type: eliminatedPlayer.role === 'wolf' ? 'WOLF_REVEALED' : 'INNOCENT_KILLED',
      objectId: eliminated,
      round: gameState.round,
    });
  }

  // 6. Notificar al manager
  killAgent(eliminated);
}

// ─── UTILS (stubs de tu lógica existente) ────────────────────────────────────

function killPlayer(id) {
  setGameState((s) => ({ ...s, deadPlayers: [...s.deadPlayers, id] }));
  killAgent(id); // también al agente IA si aplica
}

function tallyVotes(votes) {
  return votes.reduce((acc, { votedFor }) => {
    acc[votedFor] = (acc[votedFor] ?? 0) + 1;
    return acc;
  }, {});
}

function getTopVoted(tally) {
  return Object.entries(tally).sort(([, a], [, b]) => b - a)[0]?.[0];
}
