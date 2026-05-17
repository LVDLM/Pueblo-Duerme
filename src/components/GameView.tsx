import { useGameData } from '../lib/useGameData';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { doc, updateDoc, setDoc, collection, writeBatch, addDoc, getDoc, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { CARD_URLS, getRoleCard } from '../constants/cards';
import { GamePhase, Role } from '../types/game';
import { Users, LogOut, MessageSquare, Shield, Moon, Sun, Heart, Skull, Zap, Send, Bot } from 'lucide-react';
import { useState, FormEvent, useEffect, useRef, useMemo } from 'react';
// @ts-ignore
import { useAIAgents } from '../ai/hooks/useAIAgents';

interface GameViewProps {
  gameId: string;
  user: User;
  onLeave: () => void;
}

const ROLE_INTRO_TITLES: Record<Role, string> = {
  cupid: "Cupido dispara sus flechas",
  werewolf: "Los lobos se preparan para cazar",
  witch: "La bruja prepara sus pociones",
  villager: "El pueblo duerme plácidamente"
};

export default function GameView({ gameId, user, onLeave }: GameViewProps) {
  const { game, players, messages, mySecret, allSecrets, loading } = useGameData(gameId, user.uid);
  const [chatMsg, setChatMsg] = useState('');
  const [showRole, setShowRole] = useState(false);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [devPeekSecrets, setDevPeekSecrets] = useState(false);
  const [isDevNarratorMode, setIsDevNarratorMode] = useState(true);
  const [impersonateId, setImpersonateId] = useState<string | null>(null);
  const [isUpdatingPhase, setIsUpdatingPhase] = useState(false);
  const [isAITalking, setIsAITalking] = useState(false);
  const [showRoleIntro, setShowRoleIntro] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const activeSecret = (game?.lobbyCode === 'DEV1' && impersonateId) ? allSecrets[impersonateId] : mySecret;
  const isImpersonating = !!(game?.lobbyCode === 'DEV1' && impersonateId);

  const isMod = game?.moderatorId === user.uid;
  const me = players.find(p => p.uid === user.uid);
  const hasAutoReset = useRef(false);
  const lastAIPhaseRun = useRef<string>('');
  const isMyTurn = (game?.phase === 'cupid_turn' && activeSecret?.role === 'cupid') ||
                   (game?.phase === 'werewolves_turn' && activeSecret?.role === 'werewolf') ||
                   (game?.phase === 'witch_turn' && activeSecret?.role === 'witch');

  const isWitchAlive = useMemo(() => {
    return players.some(p => p.isAlive && (p.revealedRole === 'witch' || allSecrets[p.uid]?.role === 'witch'));
  }, [players, allSecrets]);

  const isCupidAlive = useMemo(() => {
    return players.some(p => p.isAlive && (p.revealedRole === 'cupid' || allSecrets[p.uid]?.role === 'cupid'));
  }, [players, allSecrets]);

  const areWolvesAlive = useMemo(() => {
    return players.some(p => p.isAlive && (p.revealedRole === 'werewolf' || allSecrets[p.uid]?.role === 'werewolf'));
  }, [players, allSecrets]);

  // AI Integration
  const aiBotsConfig = useMemo(() => players.filter(p => p.isBot).map(p => ({
    id: p.uid,
    name: p.displayName,
    role: allSecrets[p.uid]?.role || 'villager'
  })), [players, allSecrets]);

  const { resolveNight, resolveVotes, generateAccusations, broadcastEvent, killAgent, reset } = useAIAgents(aiBotsConfig);

  // AI Auto-Turns (Moderator Logic)
  useEffect(() => {
    if (!isMod || game?.status !== 'playing' || isUpdatingPhase || !game) return;
    if (lastAIPhaseRun.current === game.phase) return;

    const gameDataAsState = {
       players: players.map(p => ({ id: p.uid, name: p.displayName, role: allSecrets[p.uid]?.role || 'villager' })),
       deadPlayers: players.filter(p => !p.isAlive).map(p => p.uid),
       phase: game.phase,
       round: 1, // simplified
       currentNightVictimId: game.nightTargets?.werewolfTarget || null,
       loversIds: game.nightTargets?.cupidCouples || [],
       currentVotes: players.reduce((acc, p) => { if(p.vote) acc[p.vote] = (acc[p.vote] || 0) + 1; return acc; }, {} as any),
       witchHealUsed: game.witchHealUsed,
       witchPoisonUsed: game.witchPoisonUsed
    };

    const runAI = async () => {
      // 1. Accusations in day_vote (appearing after narrator message)
      if (game.phase === 'day_vote') {
        // Delay to allow narrator message to appear first
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setIsAITalking(true);
        const accusations = generateAccusations(gameDataAsState);
        for (const acc of accusations) {
           await addDoc(collection(db, `games/${gameId}/messages`), {
              senderId: acc.agentId,
              senderName: players.find(p => p.uid === acc.agentId)?.displayName || 'Bot',
              text: acc.message,
              timestamp: Date.now(),
              type: 'public',
              phase: 'day_vote'
           });
           broadcastEvent({ type: 'VOTED_AGAINST', subjectId: acc.agentId, objectId: acc.targetId });
           // Small delay between each bot message for realism
           await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setIsAITalking(false);
      }

      // 2. Votes in day_vote
      if (game.phase === 'day_vote') {
        const aiVotes = resolveVotes(gameDataAsState);
        const batch = writeBatch(db);
        let hasChanges = false;
        
        // Delay votes to let players read accusations
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        aiVotes.forEach((v: any) => {
           const p = players.find(pl => pl.uid === v.agentId);
           if (p && !p.vote) {
              batch.update(doc(db, `games/${gameId}/players`, v.agentId), { vote: v.votedFor });
              broadcastEvent({ type: 'VOTED_AGAINST', subjectId: v.agentId, objectId: v.votedFor });
              hasChanges = true;
           }
        });
        if (hasChanges) await batch.commit();
      }

      // 3. Night Actions
      if (game.phase === 'cupid_turn') {
         const cupid = players.find(p => p.isAlive && allSecrets[p.uid]?.role === 'cupid');
         if (cupid?.isBot && !game.nightTargets?.cupidCouples?.length) {
            const actions = resolveNight(gameDataAsState);
            const cupidAction = actions.find((a: any) => a.type === 'CUPID_CHOOSE');
            if (cupidAction) {
               await updateDoc(doc(db, 'games', gameId), {
                  'nightTargets.cupidCouples': [cupidAction.lover1Id, cupidAction.lover2Id],
                  updatedAt: Date.now()
               });
            }
         }
      }

      if (game.phase === 'werewolves_turn') {
         const aliveWolves = players.filter(p => p.isAlive && allSecrets[p.uid]?.role === 'werewolf');
         if (aliveWolves.every(w => w.isBot) && !game.nightTargets?.werewolfTarget) {
            const actions = resolveNight(gameDataAsState);
            const wolfAction = actions.find((a: any) => a.type === 'WOLF_ATTACK');
            if (wolfAction) {
               await updateDoc(doc(db, 'games', gameId), {
                  'nightTargets.werewolfTarget': wolfAction.targetId,
                  updatedAt: Date.now()
               });
            }
         }
      }

      if (game.phase === 'witch_turn') {
         const witch = players.find(p => p.isAlive && allSecrets[p.uid]?.role === 'witch');
         if (witch?.isBot && !game.nightTargets?.witchKill && !game.nightTargets?.witchHeal) {
            const actions = resolveNight(gameDataAsState);
            const witchAction = actions.find((a: any) => a.type === 'WITCH_ACTION');
            if (witchAction) {
               await updateDoc(doc(db, 'games', gameId), {
                  'nightTargets.witchHeal': witchAction.heal,
                  'nightTargets.witchKill': witchAction.poisonTargetId || '',
                  updatedAt: Date.now()
               });
            }
         }
      }
    };

    lastAIPhaseRun.current = game.phase;
    runAI();
  }, [game?.phase, isMod, players, allSecrets]);

  useEffect(() => {
    // Auto-reset when entering DEV mode if moderator
    if (game?.lobbyCode === 'DEV1' && isMod && !hasAutoReset.current) {
      hasAutoReset.current = true;
      handleRestartGame();
    }
  }, [gameId, isMod, game?.lobbyCode]);

  useEffect(() => {
    if (isMyTurn && game?.status === 'playing') {
      setShowRoleIntro(true);
    } else {
      setShowRoleIntro(false);
    }
  }, [game?.phase, isMyTurn, game?.status]);

  async function sendMsg(e?: FormEvent, customText?: string, phaseOverride?: GamePhase) {
    if (e) e.preventDefault();
    const textToSubmit = customText || chatMsg;
    if (!textToSubmit.trim() || !me) return;
    
    const senderId = impersonateId || user.uid;
    let senderName = me?.displayName || 'Desconocido';
    if (customText) {
      senderName = '📢 NARRADOR';
    } else if (isMod && isDevNarratorMode) {
      senderName = '📢 NARRADOR';
    } else if (impersonateId) {
      const p = players.find(p => p.uid === impersonateId);
      senderName = p ? p.displayName : 'Jugador';
    }

    const type = (activeSecret?.role === 'werewolf' && (game?.phase.includes('night') || game?.phase.includes('turn')) && !customText) ? 'werewolf' : 'public';
    
    await addDoc(collection(db, `games/${gameId}/messages`), {
      senderId,
      senderName,
      text: textToSubmit,
      timestamp: Date.now(),
      type,
      phase: phaseOverride || game?.phase
    });
    if (!customText) setChatMsg('');
  }

  if (loading || !game) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  async function startLevel() {
    if (!isMod || isUpdatingPhase) return;
    setIsUpdatingPhase(true);
    
    // Purge chat for DEV lobby
    if (game.lobbyCode === 'DEV1') {
      try {
        const msgsSnap = await getDocs(collection(db, `games/${gameId}/messages`));
        const batchMessages = writeBatch(db);
        msgsSnap.forEach(m => {
          batchMessages.delete(m.ref);
        });
        await batchMessages.commit();
      } catch (err) {
        console.warn("Could not purge chat fully", err);
      }
    }

    // Assign roles randomly
    const roles: Role[] = [];
    const numPlayers = players.length;
    let numLobos = 1;
    if (numPlayers >= 7) numLobos = 2;
    if (numPlayers >= 12) numLobos = 3;

    for (let i = 0; i < numLobos; i++) roles.push('werewolf');
    roles.push('witch');
    roles.push('cupid');
    while (roles.length < numPlayers) roles.push('villager');

    // Shuffle
    roles.sort(() => Math.random() - 0.5);

    const now = Date.now();
    const batch = writeBatch(db);
    const roleCounts: Record<Role, number> = { werewolf: 0, witch: 0, cupid: 0, villager: 0 };
    
    players.forEach((p, index) => {
      const role = roles[index];
      roleCounts[role]++;
      
      let displayName = p.displayName;
      if (game.lobbyCode === 'DEV1') {
        const roleNameMap: Record<Role, string> = {
          werewolf: 'Lobo',
          witch: 'Bruja',
          cupid: 'Cupido',
          villager: 'Aldeano'
        };
        const total = roles.filter(r => r === role).length;
        const count = roleCounts[role];
        const showNumber = total > 1 || role === 'werewolf' || role === 'villager';
        displayName = `${roleNameMap[role]}${showNumber ? count : ''}`;
      }

      batch.set(doc(db, `games/${gameId}/players/${p.uid}/secret/data`), {
        role: role,
        cardUrl: getRoleCard(role, gameId + p.uid + now),
        isEnamorado: false
      });

      batch.update(doc(db, `games/${gameId}/players`, p.uid), { 
        isAlive: true,
        vote: null,
        revealedRole: null,
        revealedCardUrl: null,
        displayName 
      });
    });

    // Reset AI manager with new roles
    const newAiBots = players.filter(p => p.isBot).map((p, idx) => ({
      id: p.uid,
      name: p.displayName,
      role: roles[idx] // This assumes players and roles are in the same order
    }));
    reset(newAiBots);

    batch.update(doc(db, 'games', gameId), {
      status: 'playing',
      phase: 'night_start',
      narration: '¡El pueblo duerme! Todos cierren los ojos...',
      lastStartTime: now,
      nightTargets: {
        werewolfTarget: '',
        witchHeal: false,
        witchKill: '',
        cupidCouples: []
      },
      witchHealUsed: false,
      witchPoisonUsed: false,
      updatedAt: now
    });

    await batch.commit();
    setIsUpdatingPhase(false);
  }

  async function updatePhase(newPhase: GamePhase, narration: string) {
    if (!isMod || isUpdatingPhase) return;
    setIsUpdatingPhase(true);
    try {
      // Logic when moving to day_reveal: Process deaths
      if (newPhase === 'night_start') {
        const batch = writeBatch(db);
        players.forEach(p => {
          batch.update(doc(db, `games/${gameId}/players`, p.uid), { vote: null });
        });
        batch.update(doc(db, 'games', gameId), {
          phase: newPhase,
          narration,
          'nightTargets.werewolfTarget': '',
          'nightTargets.witchHeal': false,
          'nightTargets.witchKill': '',
          'nightTargets.cupidCouples': [],
          lastSleepTime: Date.now(),
          updatedAt: Date.now()
        });
        await batch.commit();
        await sendMsg(undefined, narration);
        setIsUpdatingPhase(false);
        return;
      }

      if (newPhase === 'day_reveal') {
         // Fetch fresh game state to ensure we have latest nightTargets (Witch/Werewolf actions)
         const gameSnap = await getDoc(doc(db, 'games', gameId));
         if (!gameSnap.exists()) return;
         const freshGame = gameSnap.data();
         const targets = freshGame.nightTargets;
         const werewolfKilled = targets?.werewolfTarget;
         const witchHealed = targets?.witchHeal;
         const witchKilled = targets?.witchKill;
         
         const batch = writeBatch(db);
         
         let deadIds: string[] = [];
         
         if (werewolfKilled && !witchHealed) {
           deadIds.push(werewolfKilled);
         }
         if (witchKilled) {
           deadIds.push(witchKilled);
         }

         // Handle Cupid's lovers
         const lovers = targets?.cupidCouples || [];
         const deceasedLovers = lovers.filter(l => deadIds.includes(l));
         if (deceasedLovers.length > 0) {
           // If one dies, both die
           lovers.forEach(l => deadIds.push(l));
         }

         // Unique dead
         deadIds = Array.from(new Set(deadIds));

         // Track those who will die
         deadIds.forEach(id => {
           const player = players.find(p => p.uid === id);
           const secret = allSecrets[id];
           batch.update(doc(db, `games/${gameId}/players`, id), { 
             isAlive: false,
             revealedRole: secret?.role || 'villager',
             revealedCardUrl: secret?.cardUrl || CARD_URLS.back
           });
           broadcastEvent({ type: 'INNOCENT_KILLED', objectId: id });
         });

         const finalNarration = deadIds.length > 0 ? `¡Tragedia! Han muerto ${deadIds.length} habitante(s).` : '¡Milagro! Nadie ha muerto esta noche.';

         const gameUpdate: any = {
           phase: newPhase,
           narration: finalNarration,
           lastWakeUpTime: Date.now(),
           updatedAt: Date.now()
         };

         if (witchHealed) gameUpdate.witchHealUsed = true;
         if (witchKilled) gameUpdate.witchPoisonUsed = true;

         batch.update(doc(db, 'games', gameId), gameUpdate);

         await batch.commit();
         await sendMsg(undefined, finalNarration, 'day_reveal');
         
         // Automatic win check after processing deaths
         await checkWin();
         
         setIsUpdatingPhase(false);
         return;
      }

    if (newPhase === 'lobby') {
       // Reset game
       const batch = writeBatch(db);
       
       if (game.lobbyCode === 'DEV1') {
         try {
           const msgsSnap = await getDocs(collection(db, `games/${gameId}/messages`));
           msgsSnap.forEach(m => {
             batch.delete(m.ref);
           });
         } catch (err) {
           console.warn("Could not delete some messages", err);
         }
       }

       batch.update(doc(db, 'games', gameId), { 
         status: 'waiting', 
         phase: 'lobby', 
         winner: null,
         lastStartTime: Date.now()
       });

       players.forEach((p, i) => {
         batch.update(doc(db, `games/${gameId}/players`, p.uid), {
           isAlive: true,
           revealedRole: null,
           revealedCardUrl: null,
           vote: null,
           displayName: game.lobbyCode === 'DEV1' ? `Jugador ${i + 1}` : p.displayName
         });
         batch.delete(doc(db, `games/${gameId}/players/${p.uid}/secret/data`));
       });

       await batch.commit();
       setIsUpdatingPhase(false);
       return;
    }

      if (newPhase === 'werewolves_turn' && game.phase === 'cupid_turn') {
         const couples = game.nightTargets?.cupidCouples || [];
         if (couples.length === 2) {
           const batch = writeBatch(db);
           batch.update(doc(db, `games/${gameId}/players/${couples[0]}/secret/data`), {
             isEnamorado: true,
             loverId: couples[1]
           });
           batch.update(doc(db, `games/${gameId}/players/${couples[1]}/secret/data`), {
             isEnamorado: true,
             loverId: couples[0]
           });
           await batch.commit();
         }
      }

      await updateDoc(doc(db, 'games', gameId), {
        phase: newPhase,
        narration,
        updatedAt: Date.now()
      });

      // Send automated message to town (since we haven't returned yet, it's not reveal or lobby)
      await sendMsg(undefined, narration);
    } catch (err) {
      console.error("Error updating phase:", err);
    } finally {
      setIsUpdatingPhase(false);
    }
  }

  const handleWitchAction = async (type: 'heal' | 'kill' | 'pass', targetId?: string) => {
    if (activeSecret?.role !== 'witch') return;
    const update: any = { updatedAt: Date.now() };
    if (type === 'heal') {
       if (game.witchHealUsed && !game.nightTargets?.witchHeal) return; // Cannot start healing if already used
       // Toggle healing
       update['nightTargets.witchHeal'] = !game.nightTargets?.witchHeal;
    }
    if (type === 'kill') {
       if (game.witchPoisonUsed && game.nightTargets?.witchKill !== targetId) return; // Cannot start killing if already used
       // Toggle killing the same person
       update['nightTargets.witchKill'] = game.nightTargets?.witchKill === targetId ? '' : targetId;
    }
    
    await updateDoc(doc(db, 'games', gameId), update);
  };

  const handleCupidAction = async (p1: string, p2: string) => {
    if (activeSecret?.role !== 'cupid') return;
    await updateDoc(doc(db, 'games', gameId), {
        'nightTargets.cupidCouples': [p1, p2],
        updatedAt: Date.now()
    });
  };

  // Check win conditions
  const checkWin = async () => {
    if (!isMod) return;
    
    let aliveLobos = 0;
    let aliveOthers = 0;

    const alivePlayers = players.filter(p => p.isAlive);
    
    for (const p of alivePlayers) {
      // Use local state if available for performance, but sync with allSecrets
      const role = allSecrets[p.uid]?.role || 'villager';
      if (role === 'werewolf') aliveLobos++;
      else aliveOthers++;
    }

    let winner: 'aldeanos' | 'lobos' | null = null;
    
    // Condition 1: When all werewolves are dead. Village wins.
    if (aliveLobos === 0) {
      winner = 'aldeanos';
    } 
    // Condition 2: When two players remain and one is the werewolf. Lobo wins.
    else if (alivePlayers.length === 2 && aliveLobos >= 1) {
      winner = 'lobos';
    }

    if (winner) {
      await updateDoc(doc(db, 'games', gameId), {
        status: 'ended',
        winner,
        narration: winner === 'lobos' 
          ? '¡LOS LOBOS HAN GANADO! Solo quedan dos supervivientes y la bestia ha reclamado su premio.' 
          : '¡EL PUEBLO HA GANADO! Todos los lobos han sido exterminados.',
        updatedAt: Date.now()
      });
    }
  };

  async function handleRestartGame() {
    if (!isMod || isUpdatingPhase) return;
    setIsUpdatingPhase(true);
    const batch = writeBatch(db);
    const now = Date.now();
    
    // Reset game state
    batch.update(doc(db, 'games', gameId), {
      status: 'waiting',
      phase: 'lobby',
      narration: '¡Partida reiniciada! Esperando al narrador...',
      winner: null,
      lastStartTime: now,
      nightTargets: {
        werewolfTarget: '',
        witchHeal: false,
        witchKill: '',
        cupidCouples: []
      },
      updatedAt: now
    });

    // Reset players
    players.forEach((p, i) => {
      batch.update(doc(db, `games/${gameId}/players`, p.uid), {
        isAlive: true,
        revealedRole: null,
        revealedCardUrl: null,
        vote: null,
        displayName: game.lobbyCode === 'DEV1' ? `Jugador ${i + 1}` : p.displayName
      });
      // Delete their secrets
      batch.delete(doc(db, `games/${gameId}/players/${p.uid}/secret/data`));
    });

    // Clear messages for ALL games or specifically DEV1? 
    // The requirement says "El chat se vacía al salir de la partida"
    // For DEV1 we definitely want to delete. For others, lastStartTime helps filters.
    // If we want to be safe, we delete for DEV1 to keep database clean.
    if (game.lobbyCode === 'DEV1') {
      try {
        const msgsSnap = await getDocs(collection(db, `games/${gameId}/messages`));
        msgsSnap.docs.forEach(m => {
          batch.delete(m.ref);
        });
      } catch (err) {
        console.warn("Could not delete some messages", err);
      }
    }

    await batch.commit();
    setImpersonateId(null);
    setDevPeekSecrets(false);
    setIsDevNarratorMode(true);
    setIsUpdatingPhase(false);
    alert('Juego reiniciado exitosamente.');
  }

  const handleAddBot = async () => {
    if (!isMod || isAddingBot || game.status !== 'waiting') return;
    setIsAddingBot(true);
    try {
      const botNames = ['🤖 Bot Alfa', '🤖 Bot Beta', '🤖 Bot Gamma', '🤖 Bot Delta', '🤖 Bot Epsilon', '🤖 Bot Zeta'];
      const existingBots = players.filter(p => p.isBot).length;
      const botId = `bot_${Date.now()}_${existingBots}`;
      const name = botNames[existingBots % botNames.length] + ' ' + (Math.floor(existingBots / botNames.length) + 1);
      
      await setDoc(doc(db, `games/${gameId}/players`, botId), {
        uid: botId,
        displayName: name,
        isAlive: true,
        isModerator: false,
        isBot: true,
        joinedAt: Date.now()
      });
    } catch (error) {
      console.error("Error adding bot:", error);
    } finally {
      setIsAddingBot(false);
    }
  };

  const handleVerifyAccused = async () => {
    if (!isMod) return;
    
    // Find player with most votes
    const voteCounts: Record<string, number> = {};
    players.forEach(p => {
      if (p.vote) {
        voteCounts[p.vote] = (voteCounts[p.vote] || 0) + 1;
      }
    });

    let maxVotes = 0;
    let victimId = '';
    Object.entries(voteCounts).forEach(([uid, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        victimId = uid;
      }
    });

    if (!victimId) {
      alert('Nadie ha sido votado.');
      return;
    }

    const victim = players.find(p => p.uid === victimId);
    if (!victim) return;

    // Get victim's role
    const secretSnap = await getDoc(doc(db, `games/${gameId}/players/${victimId}/secret/data`));
    const role = secretSnap.exists() ? secretSnap.data().role : 'villager';
    const roleName = role === 'werewolf' ? 'LOBO' : role === 'witch' ? 'BRUJA' : role === 'cupid' ? 'CUPIDO' : 'ALDEANO';

    const batch = writeBatch(db);
    batch.update(doc(db, `games/${gameId}/players`, victimId), { 
      isAlive: false,
      revealedRole: role,
      revealedCardUrl: secretSnap.exists() ? secretSnap.data().cardUrl : CARD_URLS.back
    });
    
    broadcastEvent({ 
      type: role === 'werewolf' ? 'WOLF_REVEALED' : 'INNOCENT_KILLED', 
      objectId: victimId 
    });

    if (role === 'werewolf') {
      const remainingLobos = players.filter(p => p.uid !== victimId && p.isAlive).filter(p => allSecrets[p.uid]?.role === 'werewolf');
      const isLastLobo = remainingLobos.length === 0;

      if (isLastLobo) {
        await updateDoc(doc(db, 'games', gameId), {
          status: 'ended',
          winner: 'aldeanos',
          narration: `¡Justicia! El pueblo ha ejecutado a ${victim.displayName}, el último lobo. ¡EL PUEBLO HA ELIMINADO LA AMENAZA!`,
          updatedAt: Date.now()
        });
      } else {
        await updateDoc(doc(db, 'games', gameId), {
          phase: 'day_reveal',
          narration: `¡Justicia! El pueblo ha ejecutado a ${victim.displayName}, que era un ${roleName}. ¡Pero aún quedan otros lobos! Siguiente ronda.`,
          updatedAt: Date.now()
        });
      }
    } else {
      await updateDoc(doc(db, 'games', gameId), {
        phase: 'day_reveal',
        narration: `El pueblo ha ejecutado a ${victim.displayName}, pero era un inocente ${roleName}. Siguiente ronda.`,
        updatedAt: Date.now()
      });
    }

    await batch.commit();
    await sendMsg(undefined, `El pueblo ha matado a ${victim.displayName} (${roleName})`);
    
    // Automatic win check after execution
    await checkWin();
  };

  const handleAction = async (targetId: string) => {
    const actingPlayer = impersonateId ? players.find(p => p.uid === impersonateId) : me;
    if (!actingPlayer?.isAlive) return;

    if (game.phase === 'werewolves_turn' && activeSecret?.role === 'werewolf') {
      await updateDoc(doc(db, 'games', gameId), {
        'nightTargets.werewolfTarget': targetId,
        updatedAt: Date.now()
      });
    }

    if (game.phase === 'witch_turn' && activeSecret?.role === 'witch') {
       // Handled via buttons but could allow clicking cards too
       await handleWitchAction('kill', targetId);
    }

    if (game.phase === 'cupid_turn' && activeSecret?.role === 'cupid') {
       const existingLovers = game.nightTargets?.cupidCouples || [];
       if (existingLovers.includes(targetId)) {
         // Toggle off
         const newLovers = existingLovers.filter(id => id !== targetId);
         await updateDoc(doc(db, 'games', gameId), {
           'nightTargets.cupidCouples': newLovers,
           updatedAt: Date.now()
         });
       } else if (existingLovers.length < 2) {
         const newLovers = [...existingLovers, targetId];
         await updateDoc(doc(db, 'games', gameId), {
           'nightTargets.cupidCouples': newLovers,
           updatedAt: Date.now()
         });
       }
    }

    if (game.phase === 'day_vote') {
      await updateDoc(doc(db, `games/${gameId}/players`, actingPlayer.uid), {
        vote: targetId
      });
      broadcastEvent({ type: 'VOTED_AGAINST', subjectId: actingPlayer.uid, objectId: targetId });
    }
  };

  // AI Auto-Turns (Moderator Logic) - Moved to top to avoid Rules of Hooks violations

  return (
    <div className="bg-slate-950 h-screen flex flex-col p-6 text-slate-200 font-sans overflow-hidden">
      {/* Header Section */}
      <header className="flex justify-between items-center mb-6 h-20 bg-slate-900 border border-slate-800 rounded-3xl px-8 shadow-2xl shrink-0">
        <div className="flex items-center gap-4">
          <div className={`h-3 w-3 rounded-full animate-pulse ${game.status === 'playing' ? 'bg-red-600' : 'bg-emerald-500'}`}></div>
          <h1 className="text-xl font-display font-bold tracking-widest text-white uppercase italic text-center sm:text-left">Pueblo <span className="text-indigo-400">Duerme</span></h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 hidden sm:block">
            <span className="text-[10px] uppercase text-slate-500 block font-black leading-none mb-1">Código de Partida</span>
            <span className="text-lg font-mono font-bold text-amber-400 tracking-widest leading-none uppercase">{game.lobbyCode}</span>
          </div>
          <div className="bg-indigo-600 px-6 py-2 rounded-xl text-white font-black shadow-lg shadow-indigo-900/20 text-xs sm:text-sm uppercase tracking-tighter">
            Fase: {game.phase.replace('_', ' ')}
          </div>
          <button 
            onClick={onLeave}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all text-slate-400 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 grid grid-cols-12 gap-4 overflow-hidden min-h-0">
         {/* Table Area (Left) */}
         <section className="col-span-12 lg:col-span-8 bg-slate-900/50 p-6 rounded-[2rem] border border-slate-800/50 flex flex-col items-center overflow-y-auto min-h-0">
            {/* Phase / Narration */}
            <div className="mb-8 w-full text-center shrink-0">
               <AnimatePresence mode="wait">
                  <motion.div
                    key={game.phase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl mx-auto"
                  >
                    {isMyTurn && (
                       <div className="mb-2 inline-block bg-indigo-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-bounce">
                          ¡Tu turno ha comenzado!
                       </div>
                    )}
                    <h3 className="text-2xl md:text-3xl font-display font-black text-white mb-2 leading-tight">
                       {game.narration}
                    </h3>
                  </motion.div>
               </AnimatePresence>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
               {players.sort((a,b) => b.joinedAt - a.joinedAt).map((p) => {
                 const isMe = p.uid === user.uid;
                 const isActing = p.uid === (impersonateId || user.uid);
                 const canBeTarget = game.status === 'playing' && p.isAlive && !isActing;
                 
                 return (
                   <div 
                     key={p.uid} 
                     onClick={() => canBeTarget && handleAction(p.uid)}
                     className={`relative bg-slate-800/80 border-2 rounded-2xl p-4 flex flex-col items-center justify-center transition-all shadow-xl group ${canBeTarget ? 'hover:border-indigo-500 cursor-pointer' : 'border-slate-800'} ${isActing ? 'border-indigo-500' : ''} ${!p.isAlive ? 'opacity-50 grayscale' : ''}`}
                   >
                     {/* Labels */}
                     <div className="absolute top-2 left-2 right-2 flex justify-between items-center px-1">
                        {isMe && <span className="bg-indigo-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-white uppercase">TÚ</span>}
                        {p.uid === impersonateId && <span className="bg-amber-500 text-[8px] font-black px-1.5 py-0.5 rounded-full text-black uppercase">SUPLANTADO</span>}
                        {p.isModerator && <span className="bg-amber-500/10 text-[8px] font-black px-1.5 py-0.5 rounded-full text-amber-500 border border-amber-500/20 uppercase">MOD</span>}
                        <div className="flex items-center gap-1">
                               {( (isMod && game.nightTargets?.cupidCouples?.includes(p.uid)) || 
                                  (activeSecret?.loverId === p.uid) || 
                                  (activeSecret?.role === 'cupid' && game.nightTargets?.cupidCouples?.includes(p.uid))
                               ) && <Heart className="w-3.5 h-3.5 text-pink-500 fill-current shadow-[0_0_8px_rgba(236,72,153,0.5)]" />}
                               {isMod && game.nightTargets?.werewolfTarget === p.uid && <Skull className="w-3.5 h-3.5 text-red-500 fill-current animate-pulse mr-1" />}
                            </div>
                        
                     </div>

                     {/* Voting Indicator */}
                     {game.phase === 'day_vote' && players.filter(v => v.vote === p.uid).length > 0 && (
                       <div className="absolute -top-2 -right-2 z-10 bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg border border-indigo-400">
                          {players.filter(v => v.vote === p.uid).length}
                       </div>
                     )}

                     {/* Target Marker */}
                     {((activeSecret?.role === 'witch' && game.phase === 'witch_turn') || isMod) && game.nightTargets?.werewolfTarget === p.uid && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full border border-red-400 whitespace-nowrap">
                           VÍCTIMA LOBOS (NARRADOR)
                        </div>
                     )}

                     {/* Card Graphic */}
                     <div className={`
                        relative w-24 h-32 md:w-28 md:h-36 rounded-xl border-2 transition-all duration-500 preserve-3d mb-3
                        ${(showRole && isActing) || !p.isAlive ? 'rotate-y-180' : ''}
                        ${p.isAlive ? 'border-slate-700 bg-indigo-950' : 'border-red-900/50 bg-red-950/20'}
                     `}>
                        {/* Back */}
                        <div className="absolute inset-0 backface-hidden flex items-center justify-center rounded-xl overflow-hidden">
                           <img src={CARD_URLS.back} className="w-full h-full object-cover" />
                           {!p.isAlive && (
                              <div className="absolute inset-0 bg-red-950/60 flex items-center justify-center">
                                 <Skull className="w-8 h-8 text-red-500/80" />
                              </div>
                           )}
                        </div>
                        
                        {/* Front (Acting or Peek or Dead) */}
                        {(isActing || (devPeekSecrets && allSecrets[p.uid]) || !p.isAlive) && (
                           <div className={`absolute inset-0 backface-hidden rounded-xl overflow-hidden ${(isActing || !p.isAlive) ? 'rotate-y-180' : ''}`}>
                              <img 
                                 src={p.revealedCardUrl || allSecrets[p.uid]?.cardUrl || (isActing ? (activeSecret?.cardUrl || getRoleCard(activeSecret?.role || 'villager', p.uid)) : CARD_URLS.back)} 
                                 className="w-full h-full object-cover" 
                                 referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-end p-2 text-center">
                                 <span className="text-[8px] font-black text-white/70 uppercase leading-none mb-1">
                                    {!p.isAlive ? 'Revelación' : isActing ? 'TU ROL' : 'SOPLO'}
                                 </span>
                                 <span className="text-sm font-black text-white uppercase leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                    {(p.revealedRole || allSecrets[p.uid]?.role || activeSecret?.role) === 'werewolf' ? 'LOBO' : 
                                     (p.revealedRole || allSecrets[p.uid]?.role || activeSecret?.role) === 'witch' ? 'BRUJA' : 
                                     (p.revealedRole || allSecrets[p.uid]?.role || activeSecret?.role) === 'cupid' ? 'CUPIDO' : 'ALDEANO'}
                                 </span>
                              </div>
                           </div>
                        )}
                     </div>

                     <span className={`text-xs font-bold truncate w-full text-center ${!p.isAlive ? 'text-red-400' : 'text-slate-300'}`}>{p.displayName}</span>
                     {!p.isAlive && <span className="text-[10px] font-black uppercase text-red-500 mt-1">ELIMINADO</span>}
                     {game.lobbyCode === 'DEV1' && isMod && p.uid !== user.uid && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setImpersonateId(impersonateId === p.uid ? null : p.uid); }}
                          className={`mt-2 text-[8px] font-black uppercase px-2 py-1 rounded-lg transition-all ${impersonateId === p.uid ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                        >
                           {impersonateId === p.uid ? 'SOLTAR' : 'SUPLANTAR'}
                        </button>
                     )}
                   </div>
                 );
               })}
            </div>
         </section>

         {/* Sidebar (Right) */}
         <aside className="col-span-12 lg:col-span-4 flex flex-col gap-4 min-h-0">
            {/* Narrative / Chat Box */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-[3rem] p-6 flex flex-col shadow-inner overflow-hidden min-h-0">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> REGISTRO DEL PUEBLO
              </h3>
              
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 scrollbar-hide pr-2">
                 {messages.filter(m => {
                    if (isMod) return true;
                    
                    // Wolf chat: only wolves see it
                    if (m.type === 'werewolf') return activeSecret?.role === 'werewolf';
                    
                    // Public messages
                    const isNightPhase = m.phase === 'night_start' || (m.phase?.includes('_turn') && !m.phase.includes('day'));
                    
                    if (isNightPhase) {
                      // Only see messages from your own active turns
                      const myActivePhase = activeSecret?.role === 'werewolf' ? 'werewolves_turn' : 
                                            activeSecret?.role === 'witch' ? 'witch_turn' :
                                            activeSecret?.role === 'cupid' ? 'cupid_turn' :
                                            activeSecret?.role === 'police' ? 'police_turn' : 'none';
                      
                      return m.phase === myActivePhase;
                    }
                    
                    return true;
                 }).map(m => {
                    const isNarrator = m.senderName === '📢 NARRADOR';
                    return (
                      <div 
                        key={m.id} 
                        className={`p-3 rounded-2xl border transition-all ${
                          isNarrator 
                            ? 'bg-indigo-600/10 border-indigo-500/50 shadow-[0_0_15px_rgba(79,70,229,0.1)] scale-[1.02]' 
                            : m.type === 'werewolf' 
                              ? 'bg-red-950/20 border-red-900/30' 
                              : 'bg-slate-950/40 border-slate-800'
                        }`}
                      >
                         <span className={`text-[10px] font-black uppercase mb-1 block ${
                           isNarrator 
                             ? 'text-indigo-300' 
                             : m.type === 'werewolf' 
                               ? 'text-red-400' 
                               : 'text-indigo-400'
                         }`}>
                            {m.senderName} {m.type === 'werewolf' && '🌑'}
                         </span>
                         <p className={`text-sm font-chat break-words leading-relaxed ${isNarrator ? 'text-white font-medium italic' : 'text-slate-300'}`}>
                            {m.text}
                         </p>
                      </div>
                    );
                 })}
                 <div ref={chatEndRef} />
                 {messages.length === 0 && (
                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 italic text-slate-500 text-xs border-l-4 border-l-amber-500 font-chat">
                       "El silencio nocturno es absoluto. Solo el viento murmura entre las casas..."
                    </div>
                 )}
              </div>

              {(activeSecret?.role === 'werewolf' || game.phase === 'day_vote' || game.phase === 'day_reveal' || game.phase === 'lobby' || isMod) && (
                <form onSubmit={sendMsg} className="relative group shrink-0">
                   <input 
                     value={chatMsg}
                     onChange={(e) => setChatMsg(e.target.value)}
                     placeholder={isDevNarratorMode ? "Habla como Narrador..." : "Susurra algo..."}
                     className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm font-chat text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/50 transition-all shadow-xl"
                   />
                   <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 p-2 rounded-xl text-white hover:bg-indigo-500 transition-all shadow-lg active:scale-90">
                      <Send className="w-4 h-4" />
                   </button>
                </form>
              )}
            </div>
         </aside>
      </main>

      {/* Footer Controls */}
      <footer className="mt-6 flex flex-col lg:flex-row gap-4 h-auto lg:h-24 shrink-0">
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl flex flex-wrap items-center px-6 py-4 gap-6 min-w-0 shadow-2xl relative overflow-hidden">
           {/* Actions / Powers */}
           {((me?.isAlive && activeSecret) || isMod) && (
             <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide w-full">
                <div className="flex flex-col min-w-[140px]">
                   <span className="text-[10px] text-indigo-500 uppercase font-black tracking-[0.1em] mb-2 leading-none">Poder de {activeSecret?.role === 'werewolf' ? 'LOBO' : activeSecret?.role === 'witch' ? 'BRUJA' : activeSecret?.role?.toUpperCase() || 'MOD'}</span>
                   <div className="flex gap-2">
                     {activeSecret?.role === 'witch' && (
                       <div className="flex items-center gap-2">
                         <button 
                           onClick={() => handleWitchAction('heal')}
                           disabled={!isMyTurn || !game.nightTargets?.werewolfTarget || game.witchHealUsed}
                           className={`text-[10px] px-3 py-1.5 rounded-xl border font-black uppercase transition-all disabled:opacity-30 ${game.nightTargets?.witchHeal ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : game.witchHealUsed ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50 hover:bg-emerald-800/30'}`}
                         >
                            {game.witchHealUsed ? 'POCIÓN CURACIÓN AGOTADA' : game.nightTargets?.witchHeal ? 'POCIÓN CURACIÓN USADA' : 'USAR POCIÓN CURACIÓN'}
                         </button>
                         {isMyTurn && (
                            <button 
                              onClick={() => {
                                sendMsg(undefined, "La bruja ya ha terminado su turno");
                                if (isMod) updatePhase('day_reveal', '¡Pueblo despierta! La luz del sol se asoma...');
                              }}
                              className="bg-purple-600 text-white text-[10px] px-3 py-1.5 rounded-xl font-black uppercase hover:bg-purple-500 flex items-center gap-2"
                            >
                              <Zap className="w-3 h-3" /> Terminar turno
                            </button>
                         )}
                       </div>
                     )}
                     {activeSecret?.role === 'cupid' && (
                       <div className="flex items-center gap-3">
                         <span className="text-[10px] text-pink-400 font-black uppercase animate-pulse">
                           {game.nightTargets?.cupidCouples?.length === 2 ? 'Flechas lanzadas' : `Eligiendo amantes: ${game.nightTargets?.cupidCouples?.length || 0}/2`}
                         </span>
                         {game.nightTargets?.cupidCouples?.length === 2 && isMyTurn && (
                            <button 
                              onClick={() => {
                                 const c = game.nightTargets?.cupidCouples || [];
                                 handleCupidAction(c[0], c[1]);
                                 sendMsg(undefined, "Cupido ya ha disparado sus flechas");
                                 if (isMod) updatePhase('werewolves_turn', 'Los lobos despiertan hambrientos...');
                              }}
                              className="bg-pink-600 text-white text-[10px] px-3 py-1 rounded-lg font-black uppercase hover:bg-pink-500 flex items-center gap-2"
                            >
                              <Zap className="w-3 h-3" /> Terminar turno
                            </button>
                         )}
                       </div>
                     )}
                     {activeSecret?.role === 'werewolf' && (
                       <div className="flex items-center gap-3">
                          <span className="text-[10px] text-red-500 font-black uppercase flex items-center gap-1">
                            <Skull className="w-3 h-3" /> {game.nightTargets?.werewolfTarget ? 'Víctima marcada' : 'Elige una presa'}
                          </span>
                          {game.nightTargets?.werewolfTarget && isMyTurn && (
                            <button 
                              onClick={() => {
                                sendMsg(undefined, "Los lobos ya han terminado su cacería");
                                if (isMod) updatePhase('witch_turn', 'La bruja despierta con sus pociones...');
                              }}
                              className="bg-red-600 text-white text-[10px] px-3 py-1 rounded-lg font-black uppercase hover:bg-red-500 flex items-center gap-2"
                            >
                              <Zap className="w-3 h-3" /> Terminar turno
                            </button>
                          )}
                       </div>
                     )}
                     {activeSecret?.role === 'witch' && isMyTurn && (
                       null 
                     )}
                     {activeSecret?.role === 'villager' && (
                       <span className="text-[10px] text-slate-500 font-black uppercase italic">"Solo un humilde aldeano..."</span>
                     )}
                     {isMod && !activeSecret && (
                        <span className="text-[10px] text-indigo-500 font-black uppercase italic animate-pulse">Panel de Control</span>
                     )}
                   </div>
                </div>

                <div className="h-10 w-[1px] bg-slate-800 shrink-0"></div>

                <div className="flex items-center gap-3">
                   <button 
                     onClick={() => setShowRole(!showRole)}
                     className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all ${showRole ? 'bg-amber-600 text-white shadow-amber-900/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'}`}
                   >
                     {showRole ? 'Ocultar carta' : 'Ver carta'}
                   </button>
                     {isMod && (
                       <div className="flex gap-2">
                        {(isDevNarratorMode || game.lobbyCode !== 'DEV1') && (
                          <>
                            {game.status === 'waiting' ? (
                              <div className="flex gap-2">
                                 <button 
                                   onClick={handleAddBot} 
                                   disabled={isAddingBot || players.length >= 12} 
                                   className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-[10px] font-black uppercase disabled:opacity-50 transition-all font-mono border border-slate-700 flex items-center gap-2"
                                 >
                                   <Bot className="w-4 h-4" />
                                   {isAddingBot ? 'Añadiendo...' : 'Añadir IA'}
                                 </button>
                                 <button onClick={startLevel} disabled={players.length < 4} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase disabled:opacity-50 transition-all font-mono">EMPEZAR</button>
                               </div>
                            ) : game.status === 'playing' ? (
                              <div className={`bg-slate-800 p-2 rounded-2xl flex gap-2 border border-slate-700 transition-all ${isUpdatingPhase ? 'opacity-50 pointer-events-none' : ''}`}>
                                <button 
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); updatePhase('night_start', '¡El pueblo duerme! Todos cierren los ojos...'); }} 
                                  className={`p-3 rounded-xl transition-all shadow-sm ${game.phase === 'night_start' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`} 
                                  title="Noche"
                                >
                                  <Moon className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    if (isCupidAlive) {
                                      updatePhase('cupid_turn', 'Cupido despierta y lanza sus flechas...'); 
                                    } else {
                                      sendMsg(undefined, "⚠️ Cupido ha sido eliminado. El amor tendrá que esperar...");
                                      updatePhase('werewolves_turn', 'Los lobos despiertan hambrientos...');
                                    }
                                  }} 
                                  disabled={!isCupidAlive && game.phase !== 'cupid_turn'}
                                  className={`p-3 rounded-xl transition-all shadow-sm ${game.phase === 'cupid_turn' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-400'} ${!isCupidAlive ? 'opacity-30' : ''}`} 
                                  title="Cupido"
                                >
                                  <Heart className="w-5 h-6" />
                                </button>

                                <button 
                                  onClick={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    if (areWolvesAlive) {
                                      updatePhase('werewolves_turn', 'Los lobos despiertan hambrientos...'); 
                                    } else {
                                      sendMsg(undefined, "⚠️ No quedan lobos en el pueblo. Las ovejas duermen tranquilas...");
                                      updatePhase('day_reveal', '¡Pueblo despierta! La luz del sol se asoma...');
                                    }
                                  }} 
                                  disabled={!areWolvesAlive && game.phase !== 'werewolves_turn'}
                                  className={`p-3 rounded-xl transition-all shadow-sm ${game.phase === 'werewolves_turn' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-400'} ${!areWolvesAlive ? 'opacity-30' : ''}`} 
                                  title="Lobos"
                                >
                                  <Skull className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    if (isWitchAlive) {
                                      updatePhase('witch_turn', 'La bruja despierta con sus pociones...'); 
                                    } else {
                                      sendMsg(undefined, "⚠️ La bruja ha sido eliminada. El pueblo sigue durmiendo...");
                                      updatePhase('day_reveal', '¡Pueblo despierta! La luz del sol se asoma...');
                                    }
                                  }} 
                                  disabled={!isWitchAlive && game.phase !== 'witch_turn'}
                                  className={`p-3 rounded-xl transition-all shadow-sm ${game.phase === 'witch_turn' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-400'} ${!isWitchAlive ? 'opacity-30' : ''}`} 
                                  title="Bruja"
                                >
                                  <Zap className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); updatePhase('day_reveal', '¡Pueblo despierta! La luz del sol se asoma...'); }} 
                                  className={`p-3 rounded-xl transition-all shadow-sm ${game.phase === 'day_reveal' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`} 
                                  title="Pueblo Despierta"
                                >
                                  <Sun className="w-6 h-6" />
                                </button>
                                <button 
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); updatePhase('day_vote', 'Es hora de decidir: ¿quién es el lobo?'); }} 
                                  className={`p-3 rounded-xl transition-all shadow-sm ${game.phase === 'day_vote' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`} 
                                  title="Votación"
                                >
                                  <Users className="w-6 h-6" />
                                </button>
                                 <button 
                                   onClick={(e) => { e.preventDefault(); e.stopPropagation(); game.phase === 'day_vote' ? handleVerifyAccused() : checkWin(); }} 
                                   disabled={isAITalking && game.phase === 'day_vote'}
                                   className={`p-3 rounded-xl transition-all border border-transparent ${isAITalking && game.phase === 'day_vote' ? 'opacity-30 cursor-not-allowed text-slate-500' : 'hover:bg-red-900/20 text-red-500 hover:border-red-900/30'}`} 
                                   title={game.phase === 'day_vote' ? (isAITalking ? "Bots hablando..." : "Verificar Acusado") : "Verificar Ganador"}
                                 >
                                  <Zap className="w-6 h-6" />
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                   )}
                </div>
             </div>
           )}
        </div>

        <div className="w-full lg:w-64 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center gap-4 py-4 px-6 shadow-2xl shrink-0">
          <div className="flex -space-x-2">
            {players.slice(0, 3).map((p, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase shadow-lg">
                {p.displayName[0]}
              </div>
            ))}
            {players.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-slate-950 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-slate-400">
                +{players.length - 3}
              </div>
            )}
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{players.length} EN LÍNEA</span>
        </div>
      </footer>
      {/* Night Overlay (Screen goes black) */}
      <AnimatePresence>
        {((game.phase === 'night_start' || (game.phase.includes('turn') && !isMyTurn)) && 
          game.status !== 'ended' && 
          (!isMod || (game.lobbyCode === 'DEV1' && !isDevNarratorMode && !isMyTurn))) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white p-6 text-center"
          >
             <Moon className="w-24 h-24 mb-8 text-indigo-500 animate-pulse" />
             <h1 className="text-4xl md:text-6xl font-display font-black italic mb-4 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] uppercase">EL PUEBLO DUERME</h1>
             <p className="text-slate-400 font-bold max-w-md">{game.narration}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Intro Overlay */}
      <AnimatePresence>
        {showRoleIntro && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            onClick={() => setShowRoleIntro(false)}
            className="fixed inset-0 z-[100] bg-indigo-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center cursor-pointer"
          >
             <div className="relative mb-12">
                <motion.div 
                   animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                   transition={{ duration: 4, repeat: Infinity }}
                   className="w-48 h-64 rounded-3xl border-4 border-indigo-400 overflow-hidden shadow-[0_0_50px_rgba(129,140,248,0.5)] bg-slate-900"
                >
                   <img 
                      src={activeSecret?.cardUrl || CARD_URLS.back} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                   />
                </motion.div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-6 py-2 rounded-full font-black uppercase text-xs shadow-xl min-w-[100px]">
                   {activeSecret?.role === 'werewolf' ? 'LOBO' : activeSecret?.role === 'witch' ? 'BRUJA' : 'CUPIDO'}
                </div>
             </div>
             <h1 className="text-4xl md:text-6xl font-display font-black italic mb-4 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] uppercase">
                {activeSecret?.role && (ROLE_INTRO_TITLES[activeSecret.role] || "¡Es tu turno!")}
             </h1>
             <p className="text-indigo-200 font-bold max-w-md text-lg mb-8 uppercase tracking-widest animate-pulse">Toca para actuar</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dev Master Panel (Always on top for DEV lobby) */}
      {game.lobbyCode === 'DEV1' && isMod && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex gap-2 items-center scale-90 sm:scale-100">
           <div className="bg-slate-900/95 backdrop-blur-md border-2 border-indigo-500/50 px-2 py-1.5 rounded-3xl flex gap-3 shadow-[0_0_50px_rgba(79,70,229,0.5)] items-center">
              <div className="flex flex-col px-2">
                 <span className="text-[7px] text-indigo-400 font-black uppercase tracking-widest leading-none mb-1">Modo Maestro</span>
                 <select 
                   value={impersonateId || 'narrator'}
                   onChange={(e) => {
                     const val = e.target.value;
                     if (val === 'narrator') {
                       setImpersonateId(null);
                       setIsDevNarratorMode(true);
                     } else {
                       setImpersonateId(val);
                       setIsDevNarratorMode(false);
                     }
                   }}
                   className="bg-transparent text-white text-[10px] font-bold focus:outline-none cursor-pointer uppercase appearance-none"
                 >
                   <option value="narrator" className="bg-slate-900 text-indigo-400 font-bold">📢 NARRADOR</option>
                   <optgroup label="JUGADORES" className="bg-slate-900 text-slate-500">
                      {players.map(p => {
                        const role = allSecrets[p.uid]?.role;
                        const roleLabel = role ? ` (${role === 'werewolf' ? 'LOBO' : role === 'witch' ? 'BRUJA' : role === 'cupid' ? 'CUPIDO' : 'ALDEANO'})` : '';
                        return (
                          <option key={p.uid} value={p.uid} className="bg-slate-900 text-slate-200">
                            🎭 {p.displayName.split(' ')[0]}{devPeekSecrets ? roleLabel : ''}
                          </option>
                        );
                      })}
                   </optgroup>
                 </select>
              </div>

              <div className="h-6 w-[1px] bg-slate-800"></div>
              
              <button 
                onClick={() => setDevPeekSecrets(!devPeekSecrets)}
                className={`px-4 py-2 rounded-full text-white text-[10px] font-black uppercase transition-all flex items-center gap-2 ${devPeekSecrets ? 'bg-amber-600 shadow-lg shadow-amber-900/50' : 'bg-slate-800 hover:bg-slate-700'}`}
                title="Quitar venda de los ojos"
              >
                {devPeekSecrets ? 'Peek ON' : 'Blind ON'}
              </button>

              <button 
                onClick={handleRestartGame}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full text-[10px] font-black uppercase transition-all shadow-lg"
              >
                REINICIAR
              </button>
           </div>
        </div>
      )}

      {/* Game Over Overlay */}
      <AnimatePresence>
        {game.status === 'ended' && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
            className="fixed inset-0 z-[60] bg-slate-950/80 flex flex-col items-center justify-center p-6 text-center"
          >
             <motion.div
               initial={{ scale: 0.8, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               className="bg-slate-900 border border-slate-800 p-12 rounded-[3rem] shadow-[0_0_100px_rgba(79,70,229,0.2)] max-w-lg"
             >
                <div className={`mb-6 inline-flex p-4 rounded-3xl ${game.winner === 'lobos' ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                   {game.winner === 'lobos' ? <Skull className="w-16 h-16" /> : <Sun className="w-16 h-16" />}
                </div>
                <h1 className="text-5xl font-display font-black italic text-white mb-4 tracking-tighter uppercase leading-none">
                  ¡PARTIDA <span className={game.winner === 'lobos' ? 'text-red-500' : 'text-emerald-500'}>FINALIZADA</span>!
                </h1>
                <p className="text-xl text-slate-300 font-bold mb-8">{game.narration}</p>
                
                {isMod && (
                  <button 
                    onClick={() => updatePhase('lobby', '¡Prepárense para la revancha!')}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all"
                  >
                    NUEVA PARTIDA
                  </button>
                )}
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
