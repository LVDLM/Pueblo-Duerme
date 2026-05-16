import { useState } from 'react';
import { User } from 'firebase/auth';
import { db, loginWithGoogle, loginAnonymously } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { motion } from 'motion/react';
import { Play, UserPlus, Shield, LogIn, Terminal } from 'lucide-react';

interface LobbyProps {
  onJoin: (id: string) => void;
  user: User | null;
}

export default function Lobby({ onJoin, user }: LobbyProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const generateCode = () => Math.random().toString(36).substring(2, 7).toUpperCase();

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      alert("Error al iniciar sesión con Google. Intentando modo invitado...");
      await loginAnonymously();
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDevMode = async () => {
    let currentUser = user;
    if (!currentUser) {
      try {
        currentUser = await loginAnonymously();
      } catch (e) {
        console.error("Anonymous login failed", e);
        alert("El modo invitado (Anonymous) no está activado en Firebase. Por favor, actívalo o usa Google Login.");
        return;
      }
    }
    
    if (!currentUser) return;

    setIsCreating(true);
    try {
      const devCode = "DEV1"; // Constant for dev mode
      const q = query(collection(db, 'games'), where('lobbyCode', '==', devCode));
      const snap = await getDocs(q);
      
      let gameId: string;
      if (snap.empty) {
        const gameRef = doc(collection(db, 'games'));
        gameId = gameRef.id;
        await setDoc(gameRef, {
          lobbyCode: devCode,
          status: 'waiting',
          phase: 'lobby',
          moderatorId: currentUser.uid,
          narration: '¡MODO DEV ACTIVADO! Añadiendo jugadores de prueba...',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastStartTime: Date.now(),
        });
      } else {
        gameId = snap.docs[0].id;
      }

      // Add Current User
      await setDoc(doc(db, `games/${gameId}/players`, currentUser.uid), {
        uid: currentUser.uid,
        displayName: name || "Dev Player " + currentUser.uid.substring(0,4),
        isAlive: true,
        isModerator: true,
        joinedAt: Date.now(),
      });

      // Add Bots
      const botNames = ['🐺 Lobo Feroz', '🧙‍♀️ Bruja Piruja', '💘 Cupido Ciego', '👮‍♂️ Comisario Gil', '👨‍🌾 Aldeano Pepe'];
      for (let i = 0; i < botNames.length; i++) {
        const botId = `bot_${i}`;
        await setDoc(doc(db, `games/${gameId}/players`, botId), {
          uid: botId,
          displayName: botNames[i],
          isAlive: true,
          isModerator: false,
          joinedAt: Date.now() + i + 1,
        });
      }

      onJoin(gameId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'dev_game');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreate = async () => {
    if (!name || isCreating) return;
    
    let currentUser = user;
    if (!currentUser) {
      try {
        currentUser = await loginAnonymously();
      } catch (e) {
        alert("Para crear una partida es necesario estar autenticado. Por favor, usa Google Login o activa el acceso anónimo en Firebase.");
        return;
      }
    }
    
    if (!currentUser) return;

    setIsCreating(true);
    try {
      const lobbyCode = generateCode();
      const gameRef = doc(collection(db, 'games'));
      const gameId = gameRef.id;

      await setDoc(gameRef, {
        lobbyCode,
        status: 'waiting',
        phase: 'lobby',
        moderatorId: currentUser.uid,
        narration: '¡Bienvenidos al pueblo! Esperando a que todos se unan...',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastStartTime: Date.now(),
      });

      const playerRef = doc(db, `games/${gameId}/players`, currentUser.uid);
      await setDoc(playerRef, {
        uid: currentUser.uid,
        displayName: name,
        isAlive: true,
        isModerator: true,
        joinedAt: Date.now(),
      });

      onJoin(gameId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'games');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!code || !name || isJoining) return;
    
    let currentUser = user;
    if (!currentUser) {
      try {
        currentUser = await loginAnonymously();
      } catch (e) {
        alert("Para unirte es necesario estar autenticado. Por favor, usa Google Login.");
        return;
      }
    }

    if (!currentUser) return;

    setIsJoining(true);
    try {
      const q = query(collection(db, 'games'), where('lobbyCode', '==', code.toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        alert('Código de partida no encontrado');
        return;
      }

      const gameDoc = snap.docs[0];
      const gameId = gameDoc.id;

      const playerRef = doc(db, `games/${gameId}/players`, currentUser.uid);
      await setDoc(playerRef, {
        uid: currentUser.uid,
        displayName: name,
        isAlive: true,
        isModerator: false,
        joinedAt: Date.now(),
      });

      onJoin(gameId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'players');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 p-8 sm:p-12 rounded-[2.5rem] shadow-[0_0_80px_rgba(79,70,229,0.15)] flex flex-col md:flex-row gap-12"
      >
        <div className="flex-1 space-y-8">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/30 shadow-inner">
              <Shield className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none">
                PUEBLO <span className="text-indigo-500">DUERME</span>
              </h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Multiplayer Mystery Game</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tu Identidad</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de jugador..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/50 transition-all font-bold shadow-inner"
              />
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={handleCreate}
                disabled={!name || isCreating}
                className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] active:scale-[0.98] uppercase tracking-widest text-sm"
              >
                <Play className="w-5 h-5 fill-current" />
                {isCreating ? 'Iniciando...' : 'CREAR NUEVO PUEBLO'}
              </button>
              
              {!user?.email && (
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2 text-[10px] text-slate-500 hover:text-white transition-colors font-black uppercase"
                >
                  <LogIn className="w-3 h-3" /> O CONÉCTATE CON GOOGLE PARA GUARDAR PERFIL
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="w-[1px] bg-slate-800 hidden md:block self-stretch"></div>

        <div className="flex-1 space-y-8 flex flex-col justify-center">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Unirse a la partida</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CÓDIGO"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white placeholder:text-slate-700 text-center tracking-[0.6em] font-mono text-2xl focus:outline-none focus:ring-2 focus:ring-slate-700 transition-all shadow-inner"
              />
            </div>
            
            <button
              onClick={handleJoin}
              disabled={!name || !code || isJoining}
              className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-sm border border-slate-700"
            >
              <UserPlus className="w-5 h-5" />
              {isJoining ? 'Buscando...' : 'UNIRSE AL PUEBLO'}
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800/50">
            <button
              onClick={handleDevMode}
              className="w-full flex items-center justify-center gap-3 bg-slate-950 hover:bg-indigo-950 text-indigo-500 font-bold py-3 rounded-xl transition-all border border-indigo-500/20 text-[10px] uppercase tracking-widest"
            >
              <Terminal className="w-4 h-4" />
              Dev Quick Start
            </button>
          </div>
        </div>
      </motion.div>

      <div className="mt-12 flex items-center gap-4 text-slate-600">
         <div className="h-[1px] w-12 bg-slate-800"></div>
         <p className="text-[10px] font-black uppercase tracking-[0.3em] inline-block animate-pulse">Online Multiplayer • Anonymous Support Enabled</p>
         <div className="h-[1px] w-12 bg-slate-800"></div>
      </div>
    </div>
  );
}
