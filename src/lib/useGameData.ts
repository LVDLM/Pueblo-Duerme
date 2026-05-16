import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, collection, onSnapshot, query, orderBy, getDoc, where } from 'firebase/firestore';
import { Game, Player, Message, PlayerSecret } from '../types/game';
import { handleFirestoreError, OperationType } from './errorHandlers';

export function useGameData(gameId: string, userId: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mySecret, setMySecret] = useState<PlayerSecret | null>(null);
  const [allSecrets, setAllSecrets] = useState<Record<string, PlayerSecret>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;

    const gameSub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) {
        setGame({ id: snap.id, ...snap.data() } as Game);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `games/${gameId}`));

    const playersSub = onSnapshot(collection(db, `games/${gameId}/players`), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    }, (err) => handleFirestoreError(err, OperationType.GET, `games/${gameId}/players`));

    const secretSub = onSnapshot(doc(db, `games/${gameId}/players/${userId}/secret/data`), (snap) => {
      if (snap.exists()) {
        setMySecret(snap.data() as PlayerSecret);
      } else {
        setMySecret(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `games/${gameId}/players/${userId}/secret/data`));

    return () => {
      gameSub();
      playersSub();
      secretSub();
    };
  }, [gameId, userId]);

  useEffect(() => {
    // Only fetch all secrets if we are the moderator and game is loaded
    if (!gameId || !game || game.moderatorId !== userId || players.length === 0) {
      setAllSecrets({});
      return;
    }

    const unsubs = players.map(p => 
      onSnapshot(doc(db, `games/${gameId}/players/${p.uid}/secret/data`), (snap) => {
        if (snap.exists()) {
          setAllSecrets(prev => ({ ...prev, [p.uid]: snap.data() as PlayerSecret }));
        } else {
          setAllSecrets(prev => {
            const next = { ...prev };
            delete next[p.uid];
            return next;
          });
        }
      }, (err) => {
        // Log error but don't show full permission error to user as it might be expected during transitions
        console.warn(`Could not watch secret for ${p.uid}:`, err.message);
      })
    );

    return () => unsubs.forEach(u => u());
  }, [gameId, game?.moderatorId, players, userId]);

  useEffect(() => {
    if (!gameId) return;

    const isLobo = mySecret?.role === 'werewolf';
    const isMod = game?.moderatorId === userId;

    // Use a filtered query by default to respect security rules ("rules are not filters")
    // If not a wolf or mod, we can only request public messages.
    // Also filter by lastStartTime to support "clearing" chat between games
    let q = collection(db, `games/${gameId}/messages`);
    const startTime = game?.lastStartTime || 0;

    let messagesQuery;
    if (isLobo || isMod) {
      messagesQuery = query(q, where('timestamp', '>', startTime));
    } else {
      messagesQuery = query(q, where('type', '==', 'public'), where('timestamp', '>', startTime));
    }

    const messagesSub = onSnapshot(
      messagesQuery,
      (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
        // Sort in memory to avoid needing composite indexes for type + timestamp + startTime
        setMessages(msgs.sort((a,b) => a.timestamp - b.timestamp));
      },
      (err) => handleFirestoreError(err, OperationType.GET, `games/${gameId}/messages`)
    );

    return () => messagesSub();
  }, [gameId, userId, mySecret?.role, game?.moderatorId, game?.lastStartTime]);

  useEffect(() => {
    if (game && players.length > 0) {
      setLoading(false);
    }
  }, [game, players]);

  return { game, players, messages, mySecret, allSecrets, loading };
}
