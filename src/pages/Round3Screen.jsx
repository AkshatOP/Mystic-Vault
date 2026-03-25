import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { saveProgress } from '../supabase';
import { showFlash } from '../components/Flash';
import ProgressTrack from '../components/ProgressTrack';

export default function Round3Screen({ audio }) {
  const { config, diff, team, collectFragment, setScreen, getElapsedNow } = useGame();
  const seqLen   = diff.r3SeqLen;
  const scrambled = config.r3Scrambled;
  const correct   = config.r3Correct;
  const sequence  = config.r3Sequence.slice(0, seqLen);

  // All commands shown for unscrambling = correct + decoys
  const allCommands = [...correct, ...config.r3Decoys];

  const [phase,          setPhase]          = useState(1); // 1=unscramble, 2=identify, 3=sequence
  const [unscrambled,    setUnscrambled]     = useState(Array(scrambled.length).fill(false));
  const [inputs,         setInputs]          = useState(Array(scrambled.length).fill(''));
  const [shakeIdx,       setShakeIdx]        = useState(-1);
  const [removedDecoys,  setRemovedDecoys]   = useState([]); // ids removed by team
  const [decoySubmitted, setDecoySubmitted]  = useState(false);
  const [decoyCorrect,   setDecoyCorrect]    = useState(false);
  const [slots,          setSlots]           = useState(Array(seqLen).fill(null));
  const [revealed,       setRevealed]        = useState(false);

  function shake(i) { setShakeIdx(i); setTimeout(()=>setShakeIdx(-1),400); }

  // Step 1 — Unscramble
  function checkUnscramble(i) {
    audio.playClick();
    if (inputs[i].trim().toUpperCase()===correct[i]) {
      const n=[...unscrambled]; n[i]=true; setUnscrambled(n);
      audio.playSuccess();
      showFlash(`Command decrypted: ${correct[i]}`, 'success');
      if (n.every(Boolean)) setTimeout(()=>setPhase(2), 400);
    } else {
      audio.playError(); audio.playAlarm(); shake(i);
      showFlash('Incorrect command.', 'error');
    }
  }
  function setInput(i,v){const a=[...inputs];a[i]=v;setInputs(a);}

  // Step 2 — Identify & remove decoys
  function toggleDecoy(cmd) {
    setRemovedDecoys(prev =>
      prev.includes(cmd) ? prev.filter(c=>c!==cmd) : [...prev, cmd]
    );
  }
  function submitDecoyCheck() {
    audio.playClick();
    const actualDecoys = config.r3Decoys;
    const correct2 = actualDecoys.every(d=>removedDecoys.includes(d)) &&
                     removedDecoys.every(r=>actualDecoys.includes(r));
    if (correct2) {
      setDecoySubmitted(true); setDecoyCorrect(true);
      audio.playSuccess();
      showFlash('Invalid commands identified! Proceeding to sequencing.', 'success');
      setTimeout(()=>setPhase(3), 600);
    } else {
      audio.playError(); audio.playAlarm();
      showFlash('Incorrect. Some commands are misidentified.', 'error');
    }
  }

  // Step 3 — Arrange sequence
  function onDragStart(e,cmd){e.dataTransfer.setData('cmd',cmd);}
  function onDrop(e,idx){
    e.preventDefault();
    const cmd=e.dataTransfer.getData('cmd');
    if(slots.includes(cmd)) return;
    const n=[...slots]; n[idx]=cmd; setSlots(n);
  }
  function onClickCmd(cmd){
    const emptyIdx=slots.findIndex(s=>!s);
    if(emptyIdx===-1||slots.includes(cmd)) return;
    const n=[...slots]; n[emptyIdx]=cmd; setSlots(n);
  }
  function removeSlot(i){const n=[...slots]; n[i]=null; setSlots(n);}
  function clearSlots(){setSlots(Array(seqLen).fill(null));}

  async function checkSequence() {
    audio.playClick();
    if(slots.some(s=>!s)){showFlash('Fill all slots.','error');return;}
    if(slots.every((cmd,i)=>cmd===sequence[i])){
      setRevealed(true);
      collectFragment(2, config.fragments[2]);
      audio.playRoundWin();
      showFlash(`System restored! Fragment 3 unlocked.`, 'success', 4000);
      if(team) await saveProgress(team.id,{currentRound:4,fragment3:config.fragments[2], elapsedSeconds: getElapsedNow() });
    } else {
      audio.playError(); audio.playAlarm();
      clearSlots();
      showFlash('Incorrect sequence. Consult the hint.', 'error');
    }
  }

  const finalAnswer = sequence.join('-');
  const placedCmds  = new Set(slots.filter(Boolean));

  return (
    <div className="screen screen-padded">
      <div className="panel">
        <h2>ROUND 3 — SYSTEM RECONSTRUCTION</h2>
        <p className="subtitle">
          Restore the corrupted vault command system
          <span className={`diff-badge ${config.difficulty}`}>{config.difficulty}</span>
        </p>
        <ProgressTrack current={3} />

        <div className="voice-box">
          <div className="voice-speaker">⬡ Vault AI</div>
          CIPHER deliberately corrupted the vault command system. One command is a trap — a false signal designed to trigger permanent lockdown. Identify it. Remove it. Then execute the correct sequence — or the vault seals forever.
        </div>

        {/* ── Step 1 — Unscramble ── */}
        <div style={{marginBottom:'1rem'}}>
          <h3 style={{fontSize:'0.85rem',marginBottom:'0.5rem'}}>
            Step 1 — Unscramble the Commands
            {phase>1 && <span style={{color:'var(--green)',marginLeft:'0.5rem',fontSize:'0.75rem'}}>✓ Complete</span>}
          </h3>
          {scrambled.map((sc,i)=>(
            <div key={i} className={`puzzle-card ${unscrambled[i]?'solved':''} ${shakeIdx===i?'shake':''}`}>
              <div className="cipher-text">{sc}</div>
              {!unscrambled[i] ? (
                <div className="input-row">
                  <input type="text" placeholder="Unscrambled command…" value={inputs[i]}
                    onChange={e=>setInput(i,e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&checkUnscramble(i)}
                    style={{textTransform:'uppercase',letterSpacing:'0.15em'}}/>
                  <button className="btn btn-sm" onClick={()=>checkUnscramble(i)}>CHECK</button>
                </div>
              ) : (
                <div className="solved-badge">✓ {correct[i]}</div>
              )}
            </div>
          ))}
        </div>

        {/* ── Step 2 — Identify decoys ── */}
        {phase >= 2 && (
          <div style={{marginBottom:'1rem',animation:'fadeUp 0.4s ease'}}>
            <div className="divider"/>
            <h3 style={{fontSize:'0.85rem',marginBottom:'0.5rem'}}>
              Step 2 — Identify Invalid Commands
              {phase>2 && <span style={{color:'var(--green)',marginLeft:'0.5rem',fontSize:'0.75rem'}}>✓ Complete</span>}
            </h3>
            <div className="clue-box">{config.r3DecoyCue}</div>
            <p style={{fontSize:'0.82rem',color:'#888',marginBottom:'0.75rem'}}>
              Click to mark any command that does NOT belong to the recovery protocol.
            </p>
            <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.75rem'}}>
              {allCommands.map(cmd=>{
                const marked=removedDecoys.includes(cmd);
                return (
                  <div key={cmd}
                    onClick={()=>phase===2&&!decoySubmitted&&toggleDecoy(cmd)}
                    style={{
                      padding:'0.45rem 1rem', fontFamily:'Cinzel,serif', fontSize:'0.8rem',
                      letterSpacing:'0.14em', cursor:phase===2&&!decoySubmitted?'pointer':'default',
                      border:`1px solid ${marked?'var(--red-dim)':'#334'}`,
                      background:marked?'rgba(120,20,20,0.35)':'rgba(30,30,60,0.6)',
                      color:marked?'var(--red)':'#99aacc', borderRadius:'1px',
                      transition:'all 0.2s',
                      textDecoration: phase>2&&config.r3Decoys.includes(cmd)?'line-through':'none',
                    }}>
                    {cmd}
                  </div>
                );
              })}
            </div>
            {phase===2&&!decoySubmitted&&(
              <button className="btn btn-primary btn-sm" onClick={submitDecoyCheck}>
                SUBMIT — REMOVE MARKED COMMANDS
              </button>
            )}
          </div>
        )}

        {/* ── Step 3 — Sequence ── */}
        {phase >= 3 && !revealed && (
          <div style={{animation:'fadeUp 0.4s ease'}}>
            <div className="divider"/>
            <h3 style={{fontSize:'0.85rem',marginBottom:'0.5rem'}}>Step 3 — Arrange Execution Sequence ({seqLen} steps)</h3>
            <div className="clue-box">{config.r3Clue}</div>
            <p style={{fontSize:'0.78rem',color:'#777',marginBottom:'0.5rem'}}>Expected answer format: <span style={{fontFamily:'Share Tech Mono,monospace',color:'var(--gold-dim)'}}>{sequence.join('-')}</span></p>
            <div style={{fontSize:'0.72rem',letterSpacing:'0.12em',color:'#666',textTransform:'uppercase',marginBottom:'0.3rem'}}>Available Commands:</div>
            <div className="cmds-pool">
              {sequence.map(cmd=>(
                <div key={cmd}
                  className={`cmd-chip ${placedCmds.has(cmd)?'placed':''}`}
                  draggable={!placedCmds.has(cmd)}
                  onDragStart={e=>onDragStart(e,cmd)}
                  onClick={()=>!placedCmds.has(cmd)&&onClickCmd(cmd)}>
                  {cmd}
                </div>
              ))}
            </div>
            <div style={{fontSize:'0.72rem',letterSpacing:'0.12em',color:'#666',textTransform:'uppercase',marginBottom:'0.3rem'}}>Sequence:</div>
            <div className="seq-slots">
              {slots.map((s,i)=>(
                <div key={i} className={`seq-slot ${s?'filled':''}`}
                  onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,i)}>
                  {s||`STEP ${i+1}`}
                  {s&&<button className="remove-btn" onClick={()=>removeSlot(i)}>✕</button>}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:'0.6rem',marginTop:'0.8rem'}}>
              <button className="btn btn-sm" onClick={clearSlots}>CLEAR</button>
              <button className="btn btn-primary btn-sm" onClick={checkSequence}>SUBMIT SEQUENCE</button>
            </div>
          </div>
        )}

        {revealed && (
          <>
            <div className="frag-reveal">
              <div className="frag-label">⬡ System Restored — Vault Fragment 3 Acquired</div>
              <div className="frag-value">{config.fragments[2]}</div>
            </div>
            <div style={{background:'rgba(0,0,0,0.4)',border:'1px solid var(--green-dim)',padding:'0.8rem 1rem',margin:'0.75rem 0',fontFamily:'Share Tech Mono,monospace',fontSize:'0.9rem',color:'var(--green)',letterSpacing:'0.12em'}}>
              FINAL ANSWER FORMAT: {finalAnswer}
            </div>
            <div style={{textAlign:'center'}}>
              <button className="btn btn-primary" onClick={()=>setScreen('final')}>
                PROCEED TO FINAL VAULT UNLOCK →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
