import { useState } from 'react';
import { User } from 'firebase/auth';
import { db, loginWithGoogle, loginAnonymously } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { motion } from 'motion/react';
import { Play, UserPlus, Shield, LogIn, Terminal } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { HandDrawn, SketchyFilters, TornEdge, NotebookCorner, PaperStain, PencilSketch, Scribble, NightDivider } from './ThemeManager';

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

  const { theme } = useTheme();

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
          narration: '¡MODO DEV ACTIVADO! Añadiendo jugadores de prueba...',
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

  // ─── NIGHT THEME ────────────────────────────────────────────────────────────
  if (theme === 'night') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden" style={{background:'transparent'}}>
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-4xl relative z-10"
        >
          {/* Main panel */}
          <div className="night-parchment rounded-2xl p-8 sm:p-12 flex flex-col md:flex-row gap-10"
            style={{border:'1px solid #3d2a14', background:'#130f09', boxShadow:'0 0 80px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.4)'}}>

            {/* ── Left column ── */}
            <div className="flex-1 space-y-7 relative">

              {/* Header */}
              <div className="flex items-center gap-4">
                <div style={{background:'rgba(155,32,32,0.15)', border:'1px solid #3d1005', padding:'10px', borderRadius:'12px'}}>
                  <Shield className="w-8 h-8" style={{color:'#d4860a'}} />
                </div>
                <div>
                  <h1 className="night-title" style={{fontSize:'2.4rem', lineHeight:1}}>
                    PUEBLO <span>DUERME</span>
                  </h1>
                  <p className="night-label" style={{marginTop:'4px'}}>Multiplayer Mystery Game</p>
                </div>
              </div>

              <NightDivider />

              {/* Name input */}
              <div className="space-y-2">
                <label className="night-label">Tu nombre en el pueblo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aldeano sin nombre..."
                  className="night-input w-full rounded-xl px-5 py-4"
                  style={{background:'rgba(0,0,0,0.45)', border:'1px solid #3d2a14', color:'#e8d5b0', fontFamily:'Crimson Text,Georgia,serif', fontSize:'1.15rem'}}
                />
              </div>

              {/* Create button */}
              <button
                onClick={handleCreate}
                disabled={!name || isCreating}
                className="night-btn-primary w-full flex items-center justify-center gap-3 py-4 rounded-xl transition-all active:scale-[0.98]"
              >
                <Play className="w-5 h-5" />
                {isCreating ? 'Convocando al pueblo...' : 'FUNDAR NUEVO PUEBLO'}
              </button>

              {!user?.email && (
                <button
                  onClick={loginWithGoogle}
                  className="w-full flex items-center justify-center gap-2 transition-colors"
                  style={{color:'#4a3520', fontSize:'0.65rem', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:'Cinzel,serif'}}
                >
                  <LogIn className="w-3 h-3" /> O conéctate con Google para guardar perfil
                </button>
              )}
            </div>

            {/* Divider vertical */}
            <div className="hidden md:block w-px self-stretch" style={{background:'linear-gradient(180deg, transparent, #3d2a14 20%, #3d2a14 80%, transparent)'}} />

            {/* ── Right column ── */}
            <div className="flex-1 space-y-7 flex flex-col justify-center">

              {/* Moon ornament */}
              <div className="flex justify-center opacity-30">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <defs>
                    <filter id="mf"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2" xChannelSelector="R" yChannelSelector="G"/></filter>
                  </defs>
                  <circle cx="30" cy="30" r="22" fill="none" stroke="#d4c090" strokeWidth="1" filter="url(#mf)" />
                  <path d="M38 18 Q50 30 38 42 Q28 38 28 30 Q28 22 38 18Z" fill="#d4c090" opacity="0.5" filter="url(#mf)" />
                  <circle cx="22" cy="24" r="2" fill="none" stroke="#d4c090" strokeWidth="0.8" opacity="0.6"/>
                  <circle cx="28" cy="38" r="1.2" fill="none" stroke="#d4c090" strokeWidth="0.8" opacity="0.4"/>
                  {[0,60,120,180,240,300].map((a,i)=>(
                    <circle key={i} cx={30+26*Math.cos(a*Math.PI/180)} cy={30+26*Math.sin(a*Math.PI/180)} r="0.8" fill="#d4c090" opacity="0.4"/>
                  ))}
                </svg>
              </div>

              <NightDivider />

              {/* Code input */}
              <div className="space-y-2">
                <label className="night-label">Unirse a una partida</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  className="night-input w-full rounded-xl px-5 py-4 text-center"
                  style={{
                    background:'rgba(0,0,0,0.45)', border:'1px solid #3d2a14',
                    color:'#d4860a', fontFamily:'Cinzel,serif',
                    fontSize:'1.5rem', letterSpacing:'0.5em',
                  }}
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={!name || !code || isJoining}
                className="night-btn-secondary w-full flex items-center justify-center gap-3 py-4 rounded-xl transition-all active:scale-[0.98]"
              >
                <UserPlus className="w-5 h-5" />
                {isJoining ? 'Buscando el pueblo...' : 'ENTRAR AL PUEBLO'}
              </button>

              <NightDivider />

              <button
                onClick={handleDevMode}
                className="night-btn-secondary w-full flex items-center justify-center gap-2 py-3 rounded-xl"
                style={{fontSize:'0.65rem', letterSpacing:'0.2em', opacity:0.7}}
              >
                <Terminal className="w-3.5 h-3.5" />
                Dev Quick Start
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center gap-6">
            <div className="h-px flex-1" style={{background:'linear-gradient(90deg,transparent,#3d2a14)'}}/>
            <p className="night-label" style={{fontSize:'0.6rem', opacity:0.5}}>
              Online Multiplayer • <span style={{color:'#7a4d06'}}>Modo anónimo disponible</span>
            </p>
            <div className="h-px flex-1" style={{background:'linear-gradient(90deg,#3d2a14,transparent)'}}/>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── DEFAULT / SKETCHY THEMES ────────────────────────────────────────────────
  return (
    <div className={`flex flex-col items-center justify-center min-h-screen p-6 transition-colors duration-500 relative overflow-hidden ${theme === 'sketchy' ? 'watercolor-bg' : 'bg-slate-950'}`}>
      <SketchyFilters />
      
      {/* Artistic Decorations for Sketchy Theme */}
      {theme === 'sketchy' && (
        <>
          <TornEdge position="top" />
          <TornEdge position="bottom" />
          <NotebookCorner />
          
          <PaperStain className="top-10 left-10 w-64 h-64 opacity-40 rotate-12" color="rgba(121, 85, 72, 0.08)" />
          <PaperStain className="bottom-20 right-1/4 w-80 h-80 opacity-30 -rotate-6" color="rgba(76, 175, 80, 0.05)" />
          <PaperStain className="top-1/3 right-10 w-48 h-48 opacity-25 rotate-45" color="rgba(33, 150, 243, 0.05)" />
          
          <PencilSketch type="wolf" className="absolute top-24 right-24 w-40 h-40 opacity-20 rotate-12" />
          <PencilSketch type="moon" className="absolute bottom-32 left-12 w-24 h-24 opacity-15 rotate-[-15deg]" />
          <Scribble className="top-1/4 left-1/4 w-64 h-64 text-amber-900/5 rotate-45" />
          <Scribble className="bottom-1/3 right-1/3 w-48 h-48 text-amber-900/10 -rotate-12" />
        </>
      )}

      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-4xl relative z-10"
      >
        <HandDrawn 
          className={`w-full p-8 sm:p-12 rounded-[2.5rem] flex flex-col md:flex-row gap-12 ${
            theme === 'sketchy' ? 'bg-transparent shadow-none' : 'bg-slate-900 border border-slate-800 shadow-[0_0_80px_rgba(79,70,229,0.15)]'
          }`}
          fill={theme === 'sketchy' ? 'transparent' : 'transparent'}
          stroke={theme === 'sketchy' ? '#2c1810' : '#1e1b4b'}
        >
          <div className="flex-1 space-y-8 relative">
            <div className="flex items-center gap-4 relative z-10">
              <HandDrawn type="box" fill={theme === 'sketchy' ? '#e8dec5' : '#4f46e533'} className="p-3 rounded-2xl">
                <Shield className={`w-8 h-8 ${theme === 'sketchy' ? 'text-[#5d4037]' : 'text-indigo-400'}`} />
              </HandDrawn>
              <div>
                <h1 className={`text-4xl tracking-tighter italic leading-none ${theme === 'sketchy' ? 'text-[#2c1810] font-display text-5xl' : 'text-white font-display font-black uppercase'}`}>
                  PUEBLO <span className={`${theme === 'sketchy' ? 'text-amber-800' : 'text-indigo-500'}`}>DUERME</span>
                </h1>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${theme === 'sketchy' ? 'text-amber-900/60 font-typewriter' : 'text-slate-500'}`}>Multiplayer Mystery Game</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${theme === 'sketchy' ? 'text-amber-900/60 font-chat text-lg' : 'text-slate-500'}`}>Tu Identidad</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre de jugador..."
                  className={`w-full border rounded-2xl px-5 py-4 transition-all shadow-inner ${
                    theme === 'sketchy' 
                      ? 'bg-amber-50/50 border-amber-900/20 text-[#2c1810] placeholder:text-amber-900/30 font-chat text-2xl rotate-[-0.5deg]' 
                      : 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/50 font-bold'
                  }`}
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <HandDrawn 
                  type="button" 
                  fill={theme === 'sketchy' ? '#fffbeb' : 'transparent'} 
                  fillStyle="solid"
                  className={`w-full transition-transform ${theme === 'sketchy' ? 'rotate-1 hover:rotate-0' : ''}`}
                  stroke={theme === 'sketchy' ? '#78350f' : '#4f46e5'}
                >
                  <button
                    onClick={handleCreate}
                    disabled={!name || isCreating}
                    className={`w-full flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed py-5 rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-sm font-black ${
                      theme === 'sketchy' ? 'text-amber-900 font-typewriter' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_30px_rgba(79,70,229,0.3)]'
                    }`}
                  >
                    <Play className={`w-5 h-5 ${theme === 'sketchy' ? 'text-amber-600' : 'fill-current'}`} />
                    {isCreating ? 'Iniciando...' : 'CREAR NUEVO PUEBLO'}
                  </button>
                </HandDrawn>
                
                {!user?.email && (
                  <button
                    onClick={loginWithGoogle}
                    className={`w-full flex items-center justify-center gap-2 text-[10px] transition-colors font-black uppercase ${theme === 'sketchy' ? 'text-amber-900/60 hover:text-amber-900 font-chat text-base' : 'text-slate-500 hover:text-white'}`}
                  >
                    <LogIn className="w-3 h-3" /> O CONÉCTATE CON GOOGLE PARA GUARDAR PERFIL
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={`w-[1px] hidden md:block self-stretch ${theme === 'sketchy' ? 'bg-amber-900/10' : 'bg-slate-800'}`}></div>

          <div className="flex-1 space-y-8 flex flex-col justify-center">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${theme === 'sketchy' ? 'text-amber-900/60 font-chat text-lg' : 'text-slate-500'}`}>Unirse a la partida</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO"
                  className={`w-full text-center tracking-[0.6em] transition-all shadow-inner border rounded-2xl px-5 py-4 ${
                    theme === 'sketchy' 
                      ? 'bg-amber-50/50 border-amber-900/20 text-[#2c1810] placeholder:text-amber-900/30 font-typewriter text-xl rotate-[0.5deg]' 
                      : 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-700 font-mono text-2xl focus:outline-none focus:ring-2 focus:ring-slate-700'
                  }`}
                />
              </div>

              <HandDrawn 
                type="button" 
                fill={theme === 'sketchy' ? '#fef3c7' : 'transparent'} 
                fillStyle="solid"
                className={`w-full transition-transform ${theme === 'sketchy' ? '-rotate-1 hover:rotate-0' : ''}`}
                stroke={theme === 'sketchy' ? '#78350f' : '#334155'}
              >
                <button
                  onClick={handleJoin}
                  disabled={!name || !code || isJoining}
                  className={`w-full flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed font-black py-5 rounded-2xl transition-all active:scale-[0.98] uppercase tracking-widest text-sm ${
                    theme === 'sketchy' ? 'text-amber-900 font-typewriter' : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  <UserPlus className={`w-5 h-5 ${theme === 'sketchy' ? 'text-amber-600' : ''}`} />
                  {isJoining ? 'Buscando...' : 'UNIRSE AL PUEBLO'}
                </button>
              </HandDrawn>
            </div>

            <div className={`pt-4 border-t ${theme === 'sketchy' ? 'border-amber-900/10' : 'border-slate-800/50'}`}>
              <button
                onClick={handleDevMode}
                className={`w-full flex items-center justify-center gap-3 transition-all border text-[10px] uppercase tracking-widest py-3 rounded-xl font-bold ${
                  theme === 'sketchy' ? 'bg-amber-100/50 border-amber-900/20 text-amber-900 hover:bg-amber-200' : 'bg-slate-950 hover:bg-indigo-950 text-indigo-500 border-indigo-500/20'
                }`}
              >
                <Terminal className="w-4 h-4" />
                Dev Quick Start
              </button>
            </div>
          </div>
        </HandDrawn>

        <div className="mt-12 flex items-center justify-center gap-8">
          <div className={`h-px flex-1 ${theme === 'sketchy' ? 'bg-amber-900/10' : 'bg-slate-800'}`} />
          <p className={`text-[9px] font-black uppercase tracking-[0.4em] ${theme === 'sketchy' ? 'text-amber-900/30' : 'text-slate-600'}`}>
            Online Multiplayer • <span className={theme === 'sketchy' ? 'text-amber-800/40' : 'text-indigo-400/50'}>Anonymous Support Enabled</span>
          </p>
          <div className={`h-px flex-1 ${theme === 'sketchy' ? 'bg-amber-900/10' : 'bg-slate-800'}`} />
        </div>
      </motion.div>
    </div>
  );
}
