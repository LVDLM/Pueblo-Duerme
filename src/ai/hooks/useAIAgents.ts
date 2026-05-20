/**
 * useAIAgents.js
 * Hook de React para integrar fácilmente el AgentManager.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { AgentManager } from '../agentManager';

/**
 * @param {Object[]} aiPlayers - Lista de jugadores IA inicial
 */
export function useAIAgents(aiPlayers = []) {
  const [manager, setManager] = useState(null);
  
  // Usamos ref para que el manager persista pero podamos forzar actualizaciones si es necesario
  const managerRef = useRef(null);

  // Inicializar el manager una sola vez
  useEffect(() => {
    if (!managerRef.current && aiPlayers.length > 0) {
      const newManager = new AgentManager(aiPlayers);
      managerRef.current = newManager;
      setManager(newManager);
    }
  }, [aiPlayers]);

  const resolveNight = useCallback((gameState) => {
    return managerRef.current?.resolveNightActions(gameState) || [];
  }, []);

  const generateAccusations = useCallback((gameState) => {
    return managerRef.current?.generateAccusations(gameState) || [];
  }, []);

  const resolveVotes = useCallback((gameState) => {
    return managerRef.current?.resolveVotes(gameState) || [];
  }, []);

  const broadcastEvent = useCallback((event) => {
    managerRef.current?.broadcastEvent(event);
  }, []);

  const killAgent = useCallback((playerId) => {
    managerRef.current?.killAgent(playerId);
  }, []);

  const reset = useCallback(() => {
    managerRef.current = null;
    setManager(null);
  }, []);

  const debugSnapshot = useCallback(() => {
    return managerRef.current?.debugSnapshot() || [];
  }, []);

  return {
    resolveNight,
    generateAccusations,
    resolveVotes,
    broadcastEvent,
    killAgent,
    reset,
    debugSnapshot
  };
}
