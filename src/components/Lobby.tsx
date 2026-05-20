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

  const handleCreate = async () => {
    if (!name || isCreating) return;
    
    let currentUser = user;
    if (!currentUser) {
      try {
        currentUser = await loginAnonymously();
      } catch (e) {
        alert("Para crear una partida es necesario estar autenticado.");
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
        nightTargets: {
          werewolfTarget: '',
          witchHeal: false,
          witchKill: '',
          cupidCouples: []
        },
        witchHealUsed: false,
        witchPoisonUsed: false,
        cupidUsed: false,
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
        alert("Para unirte es necesario estar autenticado.");
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

  const handleDevMode = async () => {
    let currentUser = user;
    if (!currentUser) {
      try {
        currentUser = await loginAnonymously();
      } catch (e) {
        return;
      }
    }
    if (!currentUser) return;

    setIsCreating(true);
    try {
      const devCode = `DEV-${currentUser.uid.substring(0, 5).toUpperCase()}`; 
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
          narration: '¡MODO DEV ACTIVADO!',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastStartTime: Date.now(),
          nightTargets: { werewolfTarget: '', witchHeal: false, witchKill: '', cupidCouples: [] },
          witchHealUsed: false,
          witchPoisonUsed: false,
          cupidUsed: false,
        });
      } else {
        gameId = snap.docs[0].id;
      }

      await setDoc(doc(db, `games/${gameId}/players`, currentUser.uid), {
        uid: currentUser.uid,
        displayName: name || "Dev Player",
        isAlive: true,
        isModerator: true,
        joinedAt: Date.now(),
      });

      const botNames = ['🐺 Lobo', '🧙‍♀️ Bruja', '💘 Cupido', '👮‍♂️ Comisario', '👨‍🌾 Aldeano'];
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
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-4xl"
      >
        <div className="bg-white/80 backdrop-blur-md p-8 md:p-12 rounded-[2.5rem] border-4 border-[#4a3728]/10 shadow-[0_20px_50px_rgba(74,55,40,0.1)] flex flex-col md:flex-row gap-12">
          <div className="flex-1 space-y-8">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-orange-100 rounded-3xl">
                <Shield className="w-10 h-10 text-orange-600" />
              </div>
              <div>
                <h1 className="text-5xl font-black tracking-tight text-[#4a3728] font-display uppercase leading-tight">
                  Pueblo <span className="text-orange-600 italic">Duerme</span>
                </h1>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4a3728]/40">Misterio en el Tablero</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-[#4a3728]/60">Tu Nombre de Jugador</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: LoboSolitario"
                  className="w-full bg-[#fdfbf7] border-2 border-[#4a3728]/10 rounded-2xl px-6 py-4 text-[#2c3e50] font-bold text-lg focus:outline-none focus:border-orange-600/50 focus:ring-4 focus:ring-orange-600/5 transition-all shadow-sm"
                />
              </div>

              <div className="pt-4 flex flex-col gap-4">
                <button
                  onClick={handleCreate}
                  disabled={!name || isCreating}
                  className="group relative w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed py-5 rounded-2xl transition-all active:scale-[0.98] shadow-[0_10px_20px_rgba(234,88,12,0.2)]"
                >
                  <div className="flex items-center justify-center gap-3">
                    <Play className="w-6 h-6 text-white fill-current transition-transform group-hover:scale-110" />
                    <span className="text-white font-black uppercase tracking-widest text-sm">Crear Partida</span>
                  </div>
                </button>
                
                <button
                  onClick={() => loginWithGoogle()}
                  className="w-full flex items-center justify-center gap-2 text-[10px] text-[#4a3728]/50 hover:text-orange-600 transition-colors font-black uppercase"
                >
                  <LogIn className="w-4 h-4" /> O conéctate con Google
                </button>
              </div>
            </div>
          </div>

          <div className="w-px hidden md:block self-stretch bg-[#4a3728]/10"></div>

          <div className="flex-1 space-y-8 flex flex-col justify-center">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-[#4a3728]/60">Unirse con Código</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  className="w-full text-center tracking-[0.6em] bg-[#fdfbf7] border-2 border-[#4a3728]/10 rounded-2xl px-6 py-5 text-[#2c3e50] font-mono text-3xl focus:outline-none focus:border-orange-600/50 transition-all font-black uppercase"
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={!name || !code || isJoining}
                className="w-full bg-[#4a3728] hover:bg-[#2c1810] disabled:opacity-50 disabled:cursor-not-allowed py-5 rounded-2xl transition-all shadow-[0_10px_20px_rgba(74,55,40,0.1)] active:scale-[0.98]"
              >
                <div className="flex items-center justify-center gap-3">
                  <UserPlus className="w-6 h-6 text-white" />
                  <span className="text-white font-black uppercase tracking-widest text-sm">Entrar al Pueblo</span>
                </div>
              </button>
            </div>

            <div className="pt-6 border-t border-[#4a3728]/10">
              <button
                onClick={handleDevMode}
                className="w-full flex items-center justify-center gap-3 bg-[#fdfbf7] hover:bg-orange-50 text-orange-700/60 hover:text-orange-700 border-2 border-orange-600/10 py-3 rounded-2xl transition-all text-xs font-black uppercase tracking-widest"
              >
                <Terminal className="w-4 h-4" />
                Modo Desarrollador
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center gap-8">
          <div className="h-0.5 flex-1 bg-[#4a3728]/5" />
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-[#4a3728]/30">
            Divertido • Amigable • Multijugador
          </p>
          <div className="h-0.5 flex-1 bg-[#4a3728]/5" />
        </div>
      </motion.div>
    </div>
  );
}
