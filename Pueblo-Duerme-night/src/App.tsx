/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, loginAnonymously } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Lobby from './components/Lobby';
import GameView from './components/GameView';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SketchyFilters, NightFractalBackground, NightTorches } from './components/ThemeManager';
import { Paintbrush, Layout, Moon } from 'lucide-react';

function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'default',  icon: <Layout className="w-4 h-4" />,    title: 'Moderno',    active: 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' },
    { id: 'sketchy',  icon: <Paintbrush className="w-4 h-4" />, title: 'Cuaderno',  active: 'bg-amber-600 border-amber-400 text-white shadow-[0_0_15px_rgba(217,119,6,0.5)]' },
    { id: 'night',    icon: <Moon className="w-4 h-4" />,       title: 'Noche',      active: 'bg-[#3d1005] border-[#9b2020] text-[#e8b090] shadow-[0_0_15px_rgba(155,32,32,0.6)]' },
  ] as const;

  return (
    <div className="fixed top-4 right-4 z-[300] flex gap-1.5 items-center">
      {themes.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={t.title}
          className={`p-2 rounded-full transition-all border text-xs font-bold flex items-center gap-1 px-3 ${
            theme === t.id
              ? t.active
              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white backdrop-blur-sm'
          }`}
        >
          {t.icon}
          <span className="hidden sm:inline">{t.title}</span>
        </button>
      ))}
    </div>
  );
}

function MainContent() {
  const [user, setUser] = useState<User | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans transition-colors duration-500 ${
        theme === 'sketchy' ? 'bg-[#f4f1ea] text-[#2c1810]'
        : theme === 'night'  ? 'bg-[#0d0a07] text-[#e8d5b0]'
        : 'bg-slate-900 text-white'
      }`}>
        {theme === 'night' && <NightFractalBackground />}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className={`w-12 h-12 border-4 border-t-transparent rounded-full ${
            theme === 'night' ? 'border-[#9b2020]' : theme === 'sketchy' ? 'border-[#2c1810]' : 'border-white'
          }`}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      theme === 'sketchy'
        ? 'bg-[#f4f1ea] text-[#2c1810] watercolor-bg overflow-x-hidden'
      : theme === 'night'
        ? 'bg-[#0d0a07] text-[#e8d5b0] overflow-x-hidden'
      : 'bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200'
    }`}>
      <SketchyFilters />
      {theme === 'night' && (
        <>
          <NightFractalBackground />
          <NightTorches />
          {/* Fog layer */}
          <div className="night-fog-layer" />
          {/* Vignette */}
          <div className="night-vignette" />
        </>
      )}
      <ThemeSelector />
      <AnimatePresence mode="wait">
        {!gameId ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Lobby onJoin={setGameId} user={user} />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen"
          >
            <GameView gameId={gameId} onLeave={() => setGameId(null)} user={user!} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainContent />
    </ThemeProvider>
  );
}


function MainContent() {
  const [user, setUser] = useState<User | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className={`min-h-screen ${theme === 'sketchy' ? 'bg-[#f4f1ea] text-[#2c1810]' : 'bg-slate-900 text-white'} flex items-center justify-center font-sans transition-colors duration-500`}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className={`w-12 h-12 border-4 ${theme === 'sketchy' ? 'border-[#2c1810]' : 'border-white'} border-t-transparent rounded-full`}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      theme === 'sketchy' 
        ? 'bg-[#f4f1ea] text-[#2c1810] watercolor-bg overflow-x-hidden' 
        : 'bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200'
    }`}>
      <SketchyFilters />
      <ThemeSelector />
      <AnimatePresence mode="wait">
        {!gameId ? (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Lobby onJoin={setGameId} user={user} />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen"
          >
            <GameView gameId={gameId} onLeave={() => setGameId(null)} user={user!} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainContent />
    </ThemeProvider>
  );
}

