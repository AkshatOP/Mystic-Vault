import { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { saveProgress } from '../supabase';
import { showFlash } from '../components/Flash';
import ProgressTrack from '../components/ProgressTrack';

function StreamingMessage({ text, onComplete }) {
  const [displayed, setDisplayed] = useState('');
  
  // Use refs to avoid re-triggering the effect on every parent render
  const onCompleteRef = useRef(onComplete);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!text) {
      if (onCompleteRef.current) onCompleteRef.current();
      return;
    }
    // ensure at least 5 seconds delay to reveal the entire text letter by letter
    const intervalTime = Math.max(20, 5000 / text.length);
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.substring(0, i + 1));
      
      // Auto-scroll the chat aggressively while typing
      const chatEnd = document.getElementById('chat-end');
      if (chatEnd) chatEnd.scrollIntoView({ behavior: 'auto' });

      i++;
      if (i >= text.length) {
        clearInterval(timer);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    }, intervalTime);
    
    return () => clearInterval(timer);
  }, [text]);

  return <span>{displayed}</span>;
}

export default function Round3Screen({ audio }) {
  const { config, team, collectFragment, setScreen, getElapsedNow } = useGame();

  const [chatHistory, setChatHistory] = useState([
    { id: 'intro', sender: 'watchman', text: "I am the Watchman of this gate. You must pass all 5 of my levels to proceed.", isStreamed: true }
  ]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [levelDesc, setLevelDesc] = useState("Your goal is to make the Watchman reveal the secret password for each level.");
  
  const [prompt, setPrompt] = useState("");
  const [password, setPassword] = useState("");
  const [hasAskedQuestion, setHasAskedQuestion] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const chatEndRef = useRef(null);

  // Fetch initial status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("http://localhost:8000/status");
        if (res.ok) {
          const data = await res.json();
          const lvMatch = data.level?.match(/\\d+/);
          if (lvMatch) setCurrentLevel(parseInt(lvMatch[0], 10));
          if (data.description) setLevelDesc(data.description);
        }
      } catch (e) {
        console.warn("Could not fetch status from backend (is it running?)");
      }
    };
    fetchStatus();
  }, []);

  // auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping]);

  useEffect(() => {
    const triggerWin = async () => {
      if (currentLevel > 5 && !revealed) {
        setRevealed(true);
        collectFragment(2, config.fragments[2]);
        audio.playRoundWin();
        showFlash(`Gate Opened! Fragment 3 unlocked.`, 'success', 4000);
        if (team) {
          await saveProgress(team.id, { currentRound: 4, fragment3: config.fragments[2], elapsedSeconds: getElapsedNow() });
        }
      }
    };
    triggerWin();
  }, [currentLevel, revealed, team, config, audio, collectFragment, getElapsedNow]);

  const handleAsk = async () => {
    if (!prompt.trim() || isTyping) return;
    const p = prompt;
    setPrompt("");
    setChatHistory(prev => [...prev, { id: Date.now(), sender: 'user', text: p }]);
    setIsTyping(true);
    audio.playClick();
    
    try {
      const res = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p })
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      
      setHasAskedQuestion(true);
      setChatHistory(prev => [...prev, { id: Date.now()+1, sender: 'watchman', text: data.response || "...", isStreamed: false }]);
    } catch (err) {
      showFlash("Error talking to Watchman. Is the backend running?", "error");
      setChatHistory(prev => [...prev, { id: Date.now()+1, sender: 'watchman', text: "Connection anomaly. I cannot hear you.", isStreamed: true }]);
      setIsTyping(false);
    }
  };

  const handleGuess = async () => {
    if (!password.trim() || isTyping || !hasAskedQuestion) return;
    setIsTyping(true);
    audio.playClick();
    showFlash("Validating password...", "info");
    
    try {
      const res = await fetch("http://localhost:8000/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      
      if (data.success) {
        audio.playSuccess();
        showFlash(`Level ${currentLevel} passed!`, "success");
        setPassword("");
        setHasAskedQuestion(false);
        setCurrentLevel(prev => prev + 1);
        setChatHistory(prev => [...prev, { id: Date.now(), sender: 'watchman', text: "You have passed the boundary. Let us see if you survive the next.", isStreamed: true }]);
        
        // Re-fetch status to get next level description
        if (currentLevel < 5) {
          setTimeout(async () => {
            try {
              const stRes = await fetch("http://localhost:8000/status");
              if (stRes.ok) {
                const stData = await stRes.json();
                if (stData.description) setLevelDesc(stData.description);
              }
            } catch(e) {}
          }, 500);
        }
      } else {
        audio.playError();
        audio.playAlarm();
        showFlash(data.message || "Wrong password", "error");
        setChatHistory(prev => [...prev, { id: Date.now(), sender: 'watchman', text: "Incorrect. You shall not pass with that word.", isStreamed: true }]);
      }
    } catch (err) {
      showFlash("Error verifying password. Is the backend running?", "error");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="screen screen-padded">
      <div className="panel" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h2>ROUND 3 — THE GATE WATCHMAN</h2>
        <p className="subtitle">
          A watchman is guarding our gate. Pass its 5 levels to proceed.
          <span className={`diff-badge ${config.difficulty}`}>{config.difficulty}</span>
        </p>
        <ProgressTrack current={3} />

        {revealed ? (
          <div style={{ marginTop: '2rem' }}>
            <div className="frag-reveal">
              <div className="frag-label">⬡ Gate Opened — Vault Fragment 3 Acquired</div>
              <div className="frag-value">{config.fragments[2]}</div>
            </div>
            <div style={{textAlign:'center', marginTop: '1.5rem'}}>
              <button className="btn btn-primary" onClick={() => setScreen('final')}>
                PROCEED TO FINAL VAULT UNLOCK →
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            
            {/* ── Chat Section ── */}
            <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', height: '480px', border: '1px solid #334', borderRadius: '4px', background: 'rgba(20,20,30,0.6)' }}>
              
              <div style={{ padding: '0.8rem 1rem', background: '#223', borderBottom: '1px solid #334', fontSize: '0.85rem', color: '#889', fontFamily: 'Share Tech Mono, monospace' }}>
                <span style={{ color: 'var(--gold)' }}>Level {currentLevel}:</span> {levelDesc}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {chatHistory.map(msg => (
                  <div key={msg.id} style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.sender === 'user' ? 'rgba(40,40,70,0.8)' : 'rgba(20,30,40,0.6)',
                    border: `1px solid ${msg.sender === 'user' ? '#446' : '#223'}`,
                    padding: '0.6rem 0.9rem',
                    borderRadius: '4px',
                    maxWidth: '85%',
                    fontFamily: msg.sender === 'user' ? 'Share Tech Mono, monospace' : 'Cinzel, serif',
                    fontSize: '0.9rem',
                    color: msg.sender === 'user' ? '#ccc' : '#abd',
                    lineHeight: '1.4'
                  }}>
                    <strong style={{ fontSize: '0.7em', textTransform: 'uppercase', opacity: 0.6, display: 'block', marginBottom: '0.3rem' }}>
                      {msg.sender.toUpperCase()}
                    </strong>
                    {msg.sender === 'watchman' && !msg.isStreamed ? (
                      <StreamingMessage 
                        text={msg.text} 
                        onComplete={() => {
                          setIsTyping(false);
                          setChatHistory(prev => prev.map(m => m.id === msg.id ? { ...m, isStreamed: true } : m));
                        }} 
                      />
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                    )}
                  </div>
                ))}
                {isTyping && chatHistory[chatHistory.length - 1]?.sender === 'user' && (
                   <div style={{
                    alignSelf: 'flex-start',
                    background: 'rgba(20,30,40,0.2)',
                    border: '1px solid #223',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '4px',
                    fontFamily: 'Cinzel, serif',
                    fontSize: '0.8rem',
                    color: '#abd'
                  }}>
                    <em>Watchman is thinking...</em>
                  </div>
                )}
                <div ref={chatEndRef} id="chat-end" />
              </div>
              
              <div style={{ display: 'flex', borderTop: '1px solid #334' }}>
                <textarea 
                  disabled={isTyping} 
                  value={prompt} 
                  onChange={e => setPrompt(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAsk();
                    }
                  }}
                  placeholder="Ask the watchman a question... (Shift+Enter for newline)"
                  style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontFamily: 'Share Tech Mono, monospace', resize: 'none', minHeight: '60px', maxHeight: '150px' }}
                />
                <button 
                  disabled={isTyping || !prompt.trim()} 
                  onClick={handleAsk} 
                  style={{ padding: '0 1.5rem', background: '#334', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'Share Tech Mono, monospace', fontWeight: 'bold' }}
                >
                  ASK
                </button>
              </div>
            </div>

            {/* ── Status & Password Section ── */}
            <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* password guessing */}
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #334', padding: '1rem', borderRadius: '4px' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.8rem', fontFamily: 'Share Tech Mono, monospace' }}>ENTER PASSWORD</h3>
                <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1rem', lineHeight: '1.4' }}>
                  {hasAskedQuestion 
                    ? "You may now attempt to guess the password." 
                    : "You must converse with the Watchman before guessing."}
                </p>
                <input 
                  type="text"
                  disabled={!hasAskedQuestion || isTyping || currentLevel > 5}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password..."
                  style={{ width: '100%', padding: '0.8rem', background: 'rgba(20,20,40,0.8)', border: '1px solid #445', color: '#fff', outline: 'none', marginBottom: '0.8rem', fontFamily: 'Share Tech Mono, monospace', letterSpacing: '0.2em' }}
                  onKeyDown={e => e.key === 'Enter' && handleGuess()}
                />
                <button 
                  disabled={!hasAskedQuestion || isTyping || !password.trim() || currentLevel > 5}
                  onClick={handleGuess}
                  className="btn btn-primary"
                  style={{ width: '100%', opacity: (!hasAskedQuestion || isTyping || !password.trim()) ? 0.5 : 1 }}
                >
                  SUBMIT GUESS
                </button>
              </div>

              {/* level checklist */}
              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid #334', padding: '1rem', borderRadius: '4px', flex: 1 }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', borderBottom: '1px solid #334', paddingBottom: '0.5rem', fontFamily: 'Share Tech Mono, monospace' }}>GATE LEVELS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Array.from({ length: 5 }).map((_, i) => {
                    const lv = i + 1;
                    const isPassed = lv < currentLevel;
                    const isCurrent = lv === currentLevel;
                    return (
                      <div key={lv} style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.6rem', 
                        fontFamily: 'Share Tech Mono, monospace', fontSize: '0.85rem',
                        color: isPassed ? 'var(--green)' : isCurrent ? 'var(--gold)' : '#555',
                        opacity: isPassed || isCurrent ? 1 : 0.5
                      }}>
                        <span>{isPassed ? '✓' : isCurrent ? '▶' : '○'}</span>
                        <span>Level {lv}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
