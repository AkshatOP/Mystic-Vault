import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { saveSession, loadSession, clearSession } from '../hooks/useSession';
import { DEFAULT_CONFIG, DIFFICULTY_SETTINGS } from '../config/constants';

const GameContext = createContext(null);


// Store start time at module level so it is never lost due to re-renders
let _startMs = null;
let _timerInterval = null;

export function GameProvider({ children }) {
  // Restore session from localStorage if available
  const savedSession = loadSession();

  const [team,      setTeamRaw]   = useState(savedSession?.team || null);
  const [screen,    setScreenRaw] = useState(savedSession?.screen || 'intro');
  const [fragments, setFragments] = useState(savedSession?.fragments || ['', '', '']);
  const [config,    setConfig]    = useState(savedSession ? { ...DEFAULT_CONFIG, ...savedSession.config } : DEFAULT_CONFIG);
  const [elapsed,   setElapsed]   = useState(savedSession?.elapsed || 0);

  // Wrapped setters that also persist session
  function setTeam(t) {
    setTeamRaw(t);
    if (t) saveSession({ team: t, screen, fragments, config: { difficulty: config.difficulty, fragments: config.fragments, finalAnswer: config.finalAnswer }, elapsed });
  }
  function setScreen(s) {
    setScreenRaw(s);
    saveSession({ team, screen: s, fragments, config: { difficulty: config.difficulty, fragments: config.fragments, finalAnswer: config.finalAnswer }, elapsed });
  }

  function startTimer() {
    if (_timerInterval) return; // already running
    // If resuming, offset start time by already elapsed seconds
    _startMs = savedSession?.elapsed ? Date.now() - (savedSession.elapsed * 1000) : Date.now();
    console.log('[Timer] Started at', _startMs);
    _timerInterval = setInterval(() => {
      if (_startMs) setElapsed(Math.floor((Date.now() - _startMs) / 1000));
    }, 500);
  }

  function stopTimer() {
    clearInterval(_timerInterval);
    _timerInterval = null;
    console.log('[Timer] Stopped. startMs was:', _startMs);
  }

  // Returns exact elapsed seconds right now — reads module-level _startMs (never stale)
  function getElapsedNow() {
    if (!_startMs) {
      console.warn('[Timer] getElapsedNow called but _startMs is null!');
      return elapsed; // fall back to last known state value
    }
    const val = Math.floor((Date.now() - _startMs) / 1000);
    console.log('[Timer] getElapsedNow =', val, 'seconds');
    return val;
  }

  useEffect(() => () => stopTimer(), []);

  function collectFragment(index, value) {
    setFragments(prev => {
      const n = [...prev]; n[index] = value;
      saveSession({ team, screen, fragments: n, config: { difficulty: config.difficulty, fragments: config.fragments, finalAnswer: config.finalAnswer }, elapsed });
      return n;
    });
  }

  function resetGame() {
    stopTimer();
    _startMs = null;
    clearSession();
    setTeamRaw(null); setScreenRaw('intro');
    setFragments(['', '', '']); setElapsed(0);
  }

  const diff = DIFFICULTY_SETTINGS[config.difficulty];

  return (
    <GameContext.Provider value={{
      team, setTeam, screen, setScreen,
      fragments, collectFragment,
      config, setConfig,
      elapsed, startTimer, stopTimer, getElapsedNow,
      diff, resetGame,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() { return useContext(GameContext); }
