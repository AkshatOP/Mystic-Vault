import { useEffect, useRef, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { saveProgress } from '../supabase';
import { showFlash } from '../components/Flash';
import ProgressTrack from '../components/ProgressTrack';

const CELL = 40;

// ── Maze generator ──────────────────────────────────────────────────
function generateMaze(cols, rows) {
  const cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r, c, walls: { N: true, S: true, E: true, W: true },
      visited: false, explored: false,
    }))
  );
  function neighbors(r, c) {
    const ns = [];
    if (r > 0      && !cells[r-1][c].visited) ns.push({ r:r-1, c, dir:'N', opp:'S' });
    if (r < rows-1 && !cells[r+1][c].visited) ns.push({ r:r+1, c, dir:'S', opp:'N' });
    if (c > 0      && !cells[r][c-1].visited) ns.push({ r, c:c-1, dir:'W', opp:'E' });
    if (c < cols-1 && !cells[r][c+1].visited) ns.push({ r, c:c+1, dir:'E', opp:'W' });
    return ns;
  }
  const stack = [cells[0][0]]; cells[0][0].visited = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const ns  = neighbors(cur.r, cur.c).filter(n => !cells[n.r][n.c].visited);
    if (ns.length) {
      const next = ns[Math.floor(Math.random() * ns.length)];
      cells[cur.r][cur.c].walls[next.dir] = false;
      cells[next.r][next.c].walls[next.opp] = false;
      cells[next.r][next.c].visited = true;
      stack.push(cells[next.r][next.c]);
    } else { stack.pop(); }
  }
  cells[0][0].explored = true;
  return cells;
}

export default function Round2Screen({ audio }) {
  const { config, diff, team, collectFragment, setScreen, getElapsedNow } = useGame();
  const [mazeLevel, setMazeLevel] = useState(1); // 1 = Dark Maze, 2 = Memory Maze
  const [l1Done,    setL1Done]    = useState(false);
  const [l2Done,    setL2Done]    = useState(false);
  const [revealed,  setRevealed]  = useState(false);
  const [steps,     setSteps]     = useState(0);
  const [restarts,  setRestarts]  = useState(0);
  const [status,    setStatus]    = useState('');

  return (
    <div className="screen screen-padded">
      <div className="panel panel-lg">
        <h2>ROUND 2 — MAZE SYSTEM</h2>
        <p className="subtitle">
          Navigate through the vault's firewall system
          <span className={`diff-badge ${config.difficulty}`}>{config.difficulty}</span>
        </p>
        <ProgressTrack current={2} />

        {/* Sub-level tabs */}
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem' }}>
          {[
            { n:1, label:'Level 1 — Dark Maze' },
            { n:2, label:'Level 2 — Chase Maze' },
          ].map(lvl => (
            <div key={lvl.n} style={{
              flex:1, padding:'0.7rem', textAlign:'center',
              fontFamily:'Cinzel,serif', fontSize:'0.75rem', letterSpacing:'0.1em',
              textTransform:'uppercase',
              border: mazeLevel===lvl.n ? '1px solid var(--gold)' : '1px solid #333',
              color: mazeLevel===lvl.n ? 'var(--gold)' : (lvl.n===1&&l1Done ? 'var(--green)' : '#555'),
              background: mazeLevel===lvl.n ? 'rgba(201,168,76,0.08)' : 'rgba(0,0,0,0.3)',
              cursor: lvl.n===2 && !l1Done ? 'not-allowed' : 'pointer',
              opacity: lvl.n===2 && !l1Done ? 0.4 : 1,
              transition:'all 0.2s',
            }} onClick={() => { if(lvl.n===1 || l1Done) setMazeLevel(lvl.n); }}>
              {lvl.n===1&&l1Done ? '✓ ' : ''}{lvl.label}
            </div>
          ))}
        </div>

        {mazeLevel === 1 && (
          <Level1DarkMaze
            diff={diff}
            audio={audio}
            onComplete={() => { setL1Done(true); showFlash('Firewall Level 1 bypassed. Drone layer incoming. Stay sharp.', 'success', 4000); setTimeout(()=>setMazeLevel(2),1500); }}
          />
        )}

        {mazeLevel === 2 && l1Done && (
          <Level2MemoryMaze
            diff={diff}
            audio={audio}
            onComplete={async () => {
              setL2Done(true); setRevealed(true);
              collectFragment(1, config.fragments[1]);
              audio.playSuccess();
              showFlash(`Fragment 2 unlocked: ${config.fragments[1]}`, 'info', 4000);
              if (team) await saveProgress(team.id, { currentRound: 3, fragment2: config.fragments[1] , elapsedSeconds: getElapsedNow() });
            }}
          />
        )}

        {revealed && (
          <>
            <div className="frag-reveal">
              <div className="frag-label">⬡ Firewall Breached — Vault Fragment 2 Acquired</div>
              <div className="frag-value">{config.fragments[1]}</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <button className="btn btn-primary" onClick={() => setScreen('r3')}>
                ADVANCE TO ROUND 3 — SYSTEM RECONSTRUCTION →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  LEVEL 1 — DARK MAZE  (fog of war, minimap)
// ════════════════════════════════════════════════════════════
function Level1DarkMaze({ diff, audio, onComplete }) {
  const COLS = diff.mazeSize[0];
  const ROWS = diff.mazeSize[1];
  const VIS  = diff.visibility;

  const mazeRef  = useRef(null);
  const mmRef    = useRef(null);
  const cellsRef = useRef(null);
  const playerRef = useRef({ r:0, c:0 });
  const mouthRef  = useRef({ angle: 0, opening: true });
  const stepsRef  = useRef(0);
  const doneRef   = useRef(false);
  const rafRef    = useRef(null);

  const [steps, setSteps] = useState(0);
  const [done,  setDone]  = useState(false);

  useEffect(() => {
    cellsRef.current = generateMaze(COLS, ROWS);
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function loop() {
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw() {
    const mc = mazeRef.current; const mmC = mmRef.current;
    if (!mc || !mmC) return;
    const ctx = mc.getContext('2d');
    const C   = CELL;
    const cells = cellsRef.current;
    const { r:pr, c:pc } = playerRef.current;

    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, COLS*C, ROWS*C);

    cells.forEach((row, r) => row.forEach((cell, c) => {
      const dist = Math.max(Math.abs(r-pr), Math.abs(c-pc));
      if (dist > VIS) return;
      const op = 1 - dist / VIS * 0.55;
      const x = c*C, y = r*C;
      ctx.fillStyle = (r===ROWS-1&&c===COLS-1) ? `rgba(0,80,40,${op})` : `rgba(10,10,25,${op})`;
      ctx.fillRect(x, y, C, C);
      ctx.strokeStyle = `rgba(100,80,30,${op})`; ctx.lineWidth = 1.5;
      if (cell.walls.N){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+C,y);ctx.stroke();}
      if (cell.walls.S){ctx.beginPath();ctx.moveTo(x,y+C);ctx.lineTo(x+C,y+C);ctx.stroke();}
      if (cell.walls.W){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+C);ctx.stroke();}
      if (cell.walls.E){ctx.beginPath();ctx.moveTo(x+C,y);ctx.lineTo(x+C,y+C);ctx.stroke();}
      if (r===ROWS-1&&c===COLS-1) {
        ctx.fillStyle=`rgba(0,255,136,${op})`;
        ctx.font='bold 12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('EXIT', x+C/2, y+C/2);
      }
    }));
    drawPacman(ctx, pc*C+C/2, pr*C+C/2, C/2-4);
    drawMinimap(mmRef.current, cellsRef.current, playerRef.current, COLS, ROWS);
  }

  function drawPacman(ctx, x, y, r) {
    const m = mouthRef.current;
    m.angle += m.opening ? 0.12 : -0.12;
    if (m.angle > 0.35) m.opening = false;
    if (m.angle < 0.02) m.opening = true;
    const start = m.angle, end = Math.PI * 2 - m.angle;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, start, end);
    ctx.closePath();
    ctx.fillStyle = '#f0cc6e';
    ctx.fill();
    // Eye
    ctx.beginPath();
    ctx.arc(x + r*0.2, y - r*0.4, r*0.12, 0, Math.PI*2);
    ctx.fillStyle = '#0a0a0f';
    ctx.fill();
  }

  function move(dr, dc) {
    if (doneRef.current) return;
    const cells = cellsRef.current;
    const { r, c } = playerRef.current;
    const dirMap = {'-10':'N','10':'S','0-1':'W','01':'E'};
    const dir = dirMap[`${dr}${dc}`];
    if (!dir || cells[r][c].walls[dir]) return;
    const nr=r+dr, nc=c+dc;
    if (nr<0||nr>=ROWS||nc<0||nc>=COLS) return;
    playerRef.current={r:nr,c:nc};
    cells[nr][nc].explored=true;
    stepsRef.current++;
    setSteps(stepsRef.current);
    audio.playClick();
    if (nr===ROWS-1&&nc===COLS-1) {
      doneRef.current=true; setDone(true);
      setTimeout(onComplete, 600);
    }
  }

  useEffect(() => {
    function handler(e) {
      const map={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],w:[-1,0],s:[1,0],a:[0,-1],d:[0,1],W:[-1,0],S:[1,0],A:[0,-1],D:[0,1]};
      const d=map[e.key]; if(d){e.preventDefault();move(...d);}
    }
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  }, []);

  const W=COLS*CELL, H=ROWS*CELL, MC=5, dW=Math.min(W,480);
  return (
    <div>
      <div className="voice-box">
        <div className="voice-speaker">⬡ Level 1 — Dark Maze</div>
        CIPHER has cut all lights in the Firewall Labyrinth. Navigate by instinct. The EXIT is your only way forward. Your path is tracked in the minimap.
      </div>
      <div style={{display:'flex',gap:'1.5rem',alignItems:'flex-start',justifyContent:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:'0.65rem',letterSpacing:'0.15em',color:'#555',textTransform:'uppercase',marginBottom:'0.4rem',textAlign:'center'}}>WASD / Arrow Keys</div>
          <div className="maze-wrap">
            <canvas ref={mazeRef} id="maze-canvas" width={W} height={H} style={{width:dW,height:dW*H/W}}/>
            <canvas ref={mmRef}   id="minimap"     width={COLS*MC} height={ROWS*MC} style={{width:COLS*MC,height:ROWS*MC}}/>
          </div>
        </div>
        <div style={{minWidth:160}}>
          <h3 style={{fontSize:'0.82rem'}}>Controls</h3>
          <div style={{fontSize:'0.82rem',color:'#777',lineHeight:2.1}}>
            <div>W / ↑ &nbsp; Up</div><div>S / ↓ &nbsp; Down</div>
            <div>A / ← &nbsp; Left</div><div>D / → &nbsp; Right</div>
          </div>
          <div className="divider" style={{margin:'0.8rem 0'}}/>
          <div style={{fontSize:'0.78rem',color:'#666'}}>Steps: {steps}</div>
          {done&&<div style={{fontSize:'0.82rem',color:'var(--green)',marginTop:'0.4rem'}}>Level 1 cleared!</div>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  LEVEL 2 — CHASE MAZE
//  Fully visible maze (21x15), same for ALL difficulty levels.
//  Moving bot patrols the maze — touch it = restart from start.
//  Hitting walls does nothing. Reach the EXIT to complete.
// ════════════════════════════════════════════════════════════
function Level2MemoryMaze({ diff, audio, onComplete }) {
  const COLS = 21, ROWS = 15, C = 34;

  const mazeRef   = useRef(null);
  const cellsRef  = useRef(null);
  const playerRef = useRef({ r:0, c:0 });
  const botRef    = useRef({ r:ROWS-1, c:COLS-1, timer:0, path:[], idx:0 });
  const mouthRef  = useRef({ angle:0.08, opening:true });
  const dirRef    = useRef('E');
  const rafRef    = useRef(null);
  const doneRef   = useRef(false);
  const frameRef  = useRef(0);

  const [restarts, setRestarts] = useState(0);
  const [steps,    setSteps]    = useState(0);
  const [done,     setDone]     = useState(false);
  const [hitFlash, setHitFlash] = useState(false);

  useEffect(() => {
    cellsRef.current = generateMaze(COLS, ROWS);
    // BFS from bot start position to build a patrol path around the maze
    botRef.current.path = buildBotPath(cellsRef.current, COLS, ROWS);
    botRef.current.idx  = 0;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Build a long patrol path for the bot using BFS spanning the maze
  function buildBotPath(cells, cols, rows) {
    const visited = Array.from({length:rows}, ()=>Array(cols).fill(false));
    const path = [];
    let r = rows-1, c = cols-1;
    visited[r][c] = true;
    path.push({r,c});
    // DFS to create a patrol path that snakes through the maze
    const stack = [{r,c}];
    while (stack.length) {
      const cur = stack[stack.length-1];
      const dirs = [
        {dr:-1,dc:0,wall:'N'},{dr:1,dc:0,wall:'S'},
        {dr:0,dc:1,wall:'E'},{dr:0,dc:-1,wall:'W'}
      ].filter(d => {
        const nr=cur.r+d.dr, nc=cur.c+d.dc;
        return nr>=0&&nr<rows&&nc>=0&&nc<cols&&!visited[nr][nc]&&!cells[cur.r][cur.c].walls[d.wall];
      });
      if (dirs.length) {
        const d = dirs[Math.floor(Math.random()*dirs.length)];
        const nr=cur.r+d.dr, nc=cur.c+d.dc;
        visited[nr][nc]=true;
        path.push({r:nr,c:nc});
        stack.push({r:nr,c:nc});
      } else { stack.pop(); if(stack.length) path.push(stack[stack.length-1]); }
    }
    // Loop the path so bot keeps moving
    return [...path, ...path.slice().reverse()];
  }

  function loop() {
    frameRef.current++;
    // Move bot every 18 frames (~3 steps/sec at 60fps)
    if (frameRef.current % 18 === 0) moveBot();
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }

  function moveBot() {
    const bot = botRef.current;
    bot.idx = (bot.idx + 1) % bot.path.length;
    const next = bot.path[bot.idx];
    bot.r = next.r; bot.c = next.c;
    // Check collision with player
    const p = playerRef.current;
    if (p.r === bot.r && p.c === bot.c) handleBotCollision();
  }

  function handleBotCollision() {
    if (doneRef.current) return;
    audio.playBotHit();
    setHitFlash(true);
    setTimeout(() => setHitFlash(false), 600);
    // Restart player
    playerRef.current = {r:0, c:0};
    setRestarts(prev => prev+1);
    setSteps(0);
  }

  function draw() {
    const mc = mazeRef.current;
    if (!mc) return;
    const ctx = mc.getContext('2d');
    const cells = cellsRef.current;
    const {r:pr, c:pc} = playerRef.current;
    const bot = botRef.current;

    ctx.fillStyle = '#060612';
    ctx.fillRect(0, 0, COLS*C, ROWS*C);

    // Draw all cells — fully visible
    cells.forEach((row, r) => row.forEach((cell, c) => {
      const x=c*C, y=r*C;
      // Exit highlight
      if (r===ROWS-1 && c===COLS-1) {
        ctx.fillStyle='rgba(0,80,40,0.4)';
        ctx.fillRect(x, y, C, C);
        ctx.fillStyle='rgba(0,255,136,0.8)';
        ctx.font=`bold ${Math.floor(C*0.32)}px sans-serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('EXIT', x+C/2, y+C/2);
      }
      // Walls
      ctx.strokeStyle='rgba(120,95,35,0.9)'; ctx.lineWidth=1.5;
      if(cell.walls.N){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+C,y);ctx.stroke();}
      if(cell.walls.S){ctx.beginPath();ctx.moveTo(x,y+C);ctx.lineTo(x+C,y+C);ctx.stroke();}
      if(cell.walls.W){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+C);ctx.stroke();}
      if(cell.walls.E){ctx.beginPath();ctx.moveTo(x+C,y);ctx.lineTo(x+C,y+C);ctx.stroke();}
    }));

    // Draw bot — red glowing circle
    const bx = bot.c*C+C/2, by = bot.r*C+C/2, br = C/2-5;
    const botGrad = ctx.createRadialGradient(bx,by,0,bx,by,br+6);
    botGrad.addColorStop(0,'rgba(255,80,80,0.9)');
    botGrad.addColorStop(1,'rgba(180,20,20,0)');
    ctx.beginPath(); ctx.arc(bx, by, br+6, 0, Math.PI*2);
    ctx.fillStyle=botGrad; ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI*2);
    ctx.fillStyle='rgba(220,50,50,0.95)'; ctx.fill();
    // Bot "eye"
    ctx.beginPath(); ctx.arc(bx+br*0.3, by-br*0.3, br*0.18, 0, Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();

    // Draw player — Pac-Man
    drawPacman(ctx, pc*C+C/2, pr*C+C/2, C/2-5);
  }

  function drawPacman(ctx, x, y, r) {
    const m = mouthRef.current;
    m.angle += m.opening ? 0.12 : -0.12;
    if (m.angle > 0.36) m.opening = false;
    if (m.angle < 0.02) m.opening = true;
    // Rotate based on direction
    const rotMap = {N:-Math.PI/2, S:Math.PI/2, E:0, W:Math.PI};
    const rot = rotMap[dirRef.current] || 0;
    ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.arc(0, 0, r, m.angle, Math.PI*2-m.angle);
    ctx.closePath();
    ctx.fillStyle='#f0cc6e';
    ctx.shadowColor='rgba(240,200,110,0.7)'; ctx.shadowBlur=8;
    ctx.fill(); ctx.shadowBlur=0;
    // Eye
    ctx.beginPath(); ctx.arc(r*0.2, -r*0.4, r*0.13, 0, Math.PI*2);
    ctx.fillStyle='#060612'; ctx.fill();
    ctx.restore();
  }

  function tryMove(dr, dc) {
    if (doneRef.current) return;
    const cells = cellsRef.current;
    const {r,c} = playerRef.current;
    const dirMap = {'-10':'N','10':'S','01':'E','0-1':'W'};
    const dirKey = dirMap[`${dr}${dc}`];
    dirRef.current = dirKey;

    // Wall — play thud, no restart
    if (cells[r][c].walls[dirKey]) { audio.playWallHit(); return; }

    const nr=r+dr, nc=c+dc;
    if (nr<0||nr>=ROWS||nc<0||nc>=COLS) return;
    playerRef.current={r:nr,c:nc};
    setSteps(prev=>prev+1);
    audio.playClick();

    // Check bot collision after move
    const bot = botRef.current;
    if (nr===bot.r && nc===bot.c) { handleBotCollision(); return; }

    // Exit reached
    if (nr===ROWS-1 && nc===COLS-1) {
      doneRef.current=true; setDone(true);
      audio.playLevelComplete();
      setTimeout(onComplete, 800);
    }
  }

  useEffect(() => {
    function handler(e) {
      const map={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],
                 w:[-1,0],s:[1,0],a:[0,-1],d:[0,1],W:[-1,0],S:[1,0],A:[0,-1],D:[0,1]};
      const mv=map[e.key]; if(mv){e.preventDefault();tryMove(...mv);}
    }
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  }, []);

  const W=COLS*C, H=ROWS*C;
  const dW=Math.min(W, window.innerWidth-80);

  return (
    <div>
      <div className="voice-box">
        <div className="voice-speaker">⬡ Level 2 — Chase Maze</div>
        CIPHER has deployed a Security Drone. It patrols these corridors relentlessly.
        <strong style={{color:'var(--red)'}}> If it finds you — you restart from the beginning.</strong> Walls are safe. Only the drone will send you back. Reach the EXIT.
      </div>
      {hitFlash && (
        <div style={{background:'rgba(120,20,20,0.95)',border:'1px solid var(--red-dim)',color:'var(--red)',padding:'0.6rem 1rem',marginBottom:'0.8rem',fontFamily:'Cinzel,serif',fontSize:'0.82rem',letterSpacing:'0.1em',textAlign:'center',animation:'fadeUp 0.2s ease'}}>
          BOT DETECTED — SECURITY RESET — RESTARTING...
        </div>
      )}
      <div style={{display:'flex',gap:'1.5rem',alignItems:'flex-start',justifyContent:'center',flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:'0.65rem',letterSpacing:'0.15em',color:'#555',textTransform:'uppercase',marginBottom:'0.4rem',textAlign:'center'}}>WASD / Arrow Keys</div>
          <canvas ref={mazeRef} width={W} height={H}
            style={{width:dW,height:dW*H/W,display:'block',border:'1px solid var(--gold-dim)',boxShadow:'0 0 20px rgba(0,0,0,0.8)'}}/>
        </div>
        <div style={{minWidth:160}}>
          <h3 style={{fontSize:'0.82rem'}}>Legend</h3>
          <div style={{fontSize:'0.82rem',color:'#888',lineHeight:2.2}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <span style={{display:'inline-block',width:14,height:14,borderRadius:'50%',background:'#f0cc6e'}}></span> You
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <span style={{display:'inline-block',width:14,height:14,borderRadius:'50%',background:'#dc3232'}}></span>
              <span style={{color:'var(--red)'}}>Security Bot</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <span style={{display:'inline-block',width:14,height:14,background:'rgba(0,80,40,0.6)',border:'1px solid var(--green-dim)'}}></span> Exit
            </div>
          </div>
          <div className="divider" style={{margin:'0.8rem 0'}}/>
          <div style={{fontSize:'0.78rem',color:'#666'}}>Steps: {steps}</div>
          <div style={{fontSize:'0.78rem',color:'var(--red)',marginTop:'0.3rem'}}>Restarts: {restarts}</div>
          {done&&<div style={{fontSize:'0.82rem',color:'var(--green)',marginTop:'0.4rem'}}>Bot evaded!</div>}
        </div>
      </div>
    </div>
  );
}
// shared minimap renderer
function drawMinimap(canvas, cells, player, COLS, ROWS) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); const MC = 5;
  ctx.fillStyle='rgba(5,5,15,0.9)'; ctx.fillRect(0,0,COLS*MC,ROWS*MC);
  cells.forEach((row,r)=>row.forEach((cell,c)=>{
    if(!cell.explored) return;
    const x=c*MC,y=r*MC;
    ctx.fillStyle=(r===player.r&&c===player.c)?'#4488ff':'rgba(100,80,30,0.6)';
    ctx.fillRect(x+1,y+1,MC-2,MC-2);
    ctx.strokeStyle='rgba(60,50,20,0.8)'; ctx.lineWidth=0.5;
    if(cell.walls.N){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+MC,y);ctx.stroke();}
    if(cell.walls.S){ctx.beginPath();ctx.moveTo(x,y+MC);ctx.lineTo(x+MC,y+MC);ctx.stroke();}
    if(cell.walls.W){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+MC);ctx.stroke();}
    if(cell.walls.E){ctx.beginPath();ctx.moveTo(x+MC,y);ctx.lineTo(x+MC,y+MC);ctx.stroke();}
  }));
  ctx.fillStyle='rgba(0,255,100,0.7)';
  ctx.fillRect((COLS-1)*MC+1,(ROWS-1)*MC+1,MC-2,MC-2);
}
