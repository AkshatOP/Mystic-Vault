import { useEffect, useState, useRef } from 'react';
import { getCTFConfig, onCTFConfigLoad } from './CTFClue';

// Import images directly — webpack bundles them, no CORS
import img1 from '../assets/ctf-image-1.jpg';
import img2 from '../assets/ctf-image-2.jpg';
import img3 from '../assets/ctf-image-3.jpg';

const CTF_IMAGES = [img1, img2, img3];

export default function ImageCTFPuzzle({ teamId, solved, onCheck }) {
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [answer,      setAnswer]      = useState('');
  const [ctfConfig,   setCTFConfig]   = useState(getCTFConfig());
  const [imgIndex,    setImgIndex]    = useState(0);
  const [shake,       setShake]       = useState(false);
  const [imgSrc,      setImgSrc]      = useState(null); // for display

  useEffect(() => {
    const unsub = onCTFConfigLoad(cfg => setCTFConfig(cfg));
    return unsub;
  }, []);

  useEffect(() => {
    if (!teamId) return;
    let hash = 0;
    for (let i = 0; i < teamId.length; i++) hash = (hash * 31 + teamId.charCodeAt(i)) & 0xffff;
    setImgIndex(hash % CTF_IMAGES.length);
  }, [teamId]);

  useEffect(() => {
    if (!ctfConfig || !teamId) return;
    setLoading(true);

    const flag   = (ctfConfig.image_flag || 'NEXUS').toUpperCase();
    const src    = CTF_IMAGES[imgIndex];

    // Step 1: Load image into an <img> element for display
    setImgSrc(src);

    // Step 2: Fetch binary and inject JPEG COM marker for download
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src, true);
    xhr.responseType = 'arraybuffer';

    xhr.onload = function() {
      if (xhr.status === 200 || xhr.status === 0) {
        try {
          const modified  = injectJPEGComment(xhr.response, `VAULT_IMAGE_FLAG: ${flag}`);
          const blob      = new Blob([modified], { type: 'image/jpeg' });
          const url       = URL.createObjectURL(blob);
          setDownloadUrl(url);
          console.log('[ImageCTF] COM marker injected. Flag:', flag, 'Blob size:', blob.size);
        } catch(e) {
          console.error('[ImageCTF] Injection failed:', e);
          // Fallback — offer original image
          const blob = new Blob([xhr.response], { type: 'image/jpeg' });
          setDownloadUrl(URL.createObjectURL(blob));
        }
      } else {
        console.error('[ImageCTF] XHR status:', xhr.status);
      }
      setLoading(false);
    };

    xhr.onerror = function() {
      console.error('[ImageCTF] XHR network error');
      // Fallback — just use the image src directly as download
      setDownloadUrl(src);
      setLoading(false);
    };

    xhr.send();

    return () => {
      if (downloadUrl && downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [ctfConfig, imgIndex, teamId]);

  function handleCheck() {
    const val = answer.trim().toUpperCase();
    if (!ctfConfig) return;
    if (val === (ctfConfig.image_flag || 'NEXUS').toUpperCase()) {
      onCheck(true);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  const imageName = `vault-evidence-${imgIndex + 1}.jpg`;

  const [tapCount, setTapCount] = useState(0);
  const [tapHint,  setTapHint]  = useState(false);
  const tapRef = useRef(null);

  function handleImageTap() {
    if (!downloadUrl || solved) return;
    const next = tapCount + 1;
    setTapCount(next);
    setTapHint(true);
    clearTimeout(tapRef.current);
    if (next >= 3) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = imageName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTapCount(0); setTapHint(false);
    } else {
      tapRef.current = setTimeout(() => { setTapCount(0); setTapHint(false); }, 1800);
    }
  }

  return (
    <div>
      {/* Triple-tap image to download */}
      <div style={{ margin: '0.75rem 0', position: 'relative', cursor: downloadUrl && !solved ? 'pointer' : 'default' }}
        onClick={handleImageTap}>
        {imgSrc ? (
          <img src={imgSrc} alt="Vault evidence"
            style={{
              width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block',
              border: `1px solid ${tapCount > 0 ? 'var(--gold)' : 'var(--gold-dim)'}`,
              filter: 'brightness(0.85) contrast(1.1)', transition: 'border-color 0.2s',
              userSelect: 'none',
            }}
          />
        ) : (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid #1a1a2e', color: '#555', fontFamily: 'Cinzel,serif', fontSize: '0.8rem', letterSpacing: '0.12em' }}>
            {loading ? 'ENCODING METADATA...' : 'LOADING...'}
          </div>
        )}
        {tapHint && !solved && (
          <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.85)', border:'1px solid var(--gold-dim)', padding:'0.3rem 0.65rem', fontFamily:'Cinzel,serif', fontSize:'0.62rem', letterSpacing:'0.1em', color:'var(--gold)', pointerEvents:'none' }}>
            {tapCount}/3 — tap {3 - tapCount} more to download
          </div>
        )}
      </div>

      {!solved && (
        <div className={`input-row ${shake ? 'shake' : ''}`}>
          <input
            type="text"
            placeholder="Enter the flag you found…"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
            style={{ textTransform: 'uppercase', letterSpacing: '0.15em' }}
          />
          <button className="btn btn-sm" onClick={handleCheck}>CHECK</button>
        </div>
      )}
    </div>
  );
}

// ── JPEG COM marker injection ─────────────────────────────────────────────
// Inserts a Comment (COM, 0xFFE) marker right after the SOI (0xFFD8) marker
function injectJPEGComment(arrayBuffer, commentText) {
  const src = new Uint8Array(arrayBuffer);

  if (src[0] !== 0xFF || src[1] !== 0xD8) {
    throw new Error('Not a valid JPEG — missing SOI marker');
  }

  const textBytes  = new TextEncoder().encode(commentText);
  const dataLength = 2 + textBytes.length; // length field includes the 2 length bytes

  // Build COM segment: marker(2) + length(2) + data
  const com = new Uint8Array(2 + 2 + textBytes.length);
  com[0] = 0xFF;
  com[1] = 0xFE; // COM marker
  com[2] = (dataLength >> 8) & 0xFF;
  com[3] =  dataLength       & 0xFF;
  com.set(textBytes, 4);

  // Assemble: SOI + COM + rest of original JPEG
  const out = new Uint8Array(src.length + com.length);
  out[0] = 0xFF;
  out[1] = 0xD8; // SOI
  out.set(com, 2);
  out.set(src.slice(2), 2 + com.length);

  return out.buffer;
}
