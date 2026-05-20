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
import { SketchyFilters, StandardFractalBackground } from './components/ThemeManager';
import { Paintbrush, Layout } from 'lucide-react';

function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed top-4 right-4 z-[300] flex gap-2">
      <button
        onClick={() => setTheme(theme === 'default' ? 'sketchy' : 'default')}
        className={`p-2 rounded-full transition-all border ${
          theme === 'sketchy' 
            ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_15px_rgba(217,119,6,0.5)]' 
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
        }`}
        title={theme === 'sketchy' ? 'Estilo Moderno' : 'Estilo Artesanal'}
      >
        {theme === 'sketchy' ? <Layout className="w-5 h-5" /> : <Paintbrush className="w-5 h-5" />}
      </button>
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
      <StandardFractalBackground />
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

