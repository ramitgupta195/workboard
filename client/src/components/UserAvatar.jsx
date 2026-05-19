// Deterministic illustrated avatar — no letters, unique per user ID

function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick(arr, n) { return arr[n % arr.length]; }

const BG       = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#0ea5e9','#a855f7','#10b981'];
const SKIN     = ['#FDDBB4','#F5C5A3','#E8A87C','#D08B5B','#AE5D29','#7D4A1E'];
const HAIR_CLR = ['#1a1a1a','#3d2b1f','#8B4513','#c8a96e','#e8c96e','#b5451b','#4a4a6a','#d4d4d4'];
const SHIRT    = ['#4f46e5','#0891b2','#059669','#dc2626','#9333ea','#ea580c','#0d9488','#475569'];

function hairPath(style, hc) {
  // Each style returns SVG elements. Face head: ellipse cx=50 cy=47 rx=18 ry=20
  const fills = `fill="${hc}"`;
  switch (style) {
    case 0: // Short crop
      return `<ellipse cx="50" cy="30" rx="18.5" ry="9" ${fills}/>
              <rect x="31.5" y="30" width="37" height="10" ${fills}/>`;
    case 1: // Side part
      return `<ellipse cx="50" cy="28" rx="19" ry="11" ${fills}/>
              <rect x="31" y="28" width="38" height="14" ${fills}/>
              <path d="M50 28 Q48 35 46 38" stroke="#00000020" stroke-width="1.5" fill="none"/>`;
    case 2: // Medium tousled
      return `<ellipse cx="50" cy="27" rx="20" ry="12" ${fills}/>
              <rect x="30" y="27" width="40" height="16" ${fills}/>
              <path d="M36 27 Q40 20 44 27" ${fills} stroke="none"/>
              <path d="M52 25 Q56 18 62 25" ${fills} stroke="none"/>`;
    case 3: // Long straight
      return `<ellipse cx="50" cy="27" rx="20" ry="12" ${fills}/>
              <rect x="30" y="27" width="40" height="16" ${fills}/>
              <rect x="30" y="30" width="9" height="36" rx="4" ${fills}/>
              <rect x="61" y="30" width="9" height="36" rx="4" ${fills}/>`;
    case 4: // Curly afro
      return `<circle cx="50" cy="23" r="12" ${fills}/>
              <circle cx="37" cy="29" r="9" ${fills}/>
              <circle cx="63" cy="29" r="9" ${fills}/>
              <circle cx="31" cy="41" r="7" ${fills}/>
              <circle cx="69" cy="41" r="7" ${fills}/>
              <circle cx="50" cy="27" r="8" ${fills}/>`;
    case 5: // Top bun / knot
      return `<circle cx="50" cy="18" r="9" ${fills}/>
              <ellipse cx="50" cy="24" rx="5" ry="3" fill="${hc}cc"/>
              <ellipse cx="50" cy="28" rx="19" ry="10" ${fills}/>
              <rect x="31" y="28" width="38" height="12" ${fills}/>`;
    case 6: // Spiky
      return `<ellipse cx="50" cy="29" rx="19" ry="10" ${fills}/>
              <rect x="31" y="29" width="38" height="10" ${fills}/>
              <polygon points="37,29 40,14 43,29" ${fills}/>
              <polygon points="44,27 47,12 51,27" ${fills}/>
              <polygon points="51,27 55,13 58,27" ${fills}/>
              <polygon points="57,29 60,15 64,29" ${fills}/>`;
    case 7: // Wavy bob
      return `<ellipse cx="50" cy="27" rx="20" ry="12" ${fills}/>
              <rect x="30" y="27" width="40" height="22" ${fills}/>
              <path d="M30 49 Q35 54 40 49 Q45 44 50 49 Q55 54 60 49 Q65 44 70 49 L70 27 L30 27 Z" ${fills}/>`;
    default:
      return `<ellipse cx="50" cy="29" rx="18.5" ry="10" ${fills}/>
              <rect x="31.5" y="29" width="37" height="10" ${fills}/>`;
  }
}

function eyePath(style) {
  switch (style) {
    case 0: // Round dots
      return `<circle cx="43" cy="44" r="2.6" fill="#1a1a1a"/>
              <circle cx="57" cy="44" r="2.6" fill="#1a1a1a"/>
              <circle cx="44" cy="43" r="0.9" fill="white"/>
              <circle cx="58" cy="43" r="0.9" fill="white"/>`;
    case 1: // Happy closed
      return `<path d="M40 44 Q43 41 46 44" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
              <path d="M54 44 Q57 41 60 44" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 2: // Wide eyes
      return `<ellipse cx="43" cy="44" rx="3.2" ry="3.6" fill="#1a1a1a"/>
              <ellipse cx="57" cy="44" rx="3.2" ry="3.6" fill="#1a1a1a"/>
              <circle cx="44.2" cy="42.8" r="1.1" fill="white"/>
              <circle cx="58.2" cy="42.8" r="1.1" fill="white"/>`;
    default:
      return `<circle cx="43" cy="44" r="2.6" fill="#1a1a1a"/>
              <circle cx="57" cy="44" r="2.6" fill="#1a1a1a"/>
              <circle cx="44" cy="43" r="0.9" fill="white"/>
              <circle cx="58" cy="43" r="0.9" fill="white"/>`;
  }
}

function mouthPath(style) {
  switch (style) {
    case 0: return `<path d="M44 53 Q50 58 56 53" stroke="#c0796b" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    case 1: return `<path d="M44 53 Q50 56 56 53" stroke="#c0796b" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    case 2: return `<path d="M44 55 Q50 60 56 55" stroke="#c0796b" stroke-width="2" fill="#e8897b"/>`;
    default: return `<path d="M44 53 Q50 58 56 53" stroke="#c0796b" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  }
}

function generateSvg(seed) {
  const h = hash(String(seed ?? 'default'));
  const bg      = pick(BG,       h);
  const skin    = pick(SKIN,     h >> 4);
  const skinDark= skin.replace(/[\da-f]{2}$/i, s => Math.max(0, parseInt(s,16)-30).toString(16).padStart(2,'0'));
  const hairClr = pick(HAIR_CLR, h >> 8);
  const shirtClr= pick(SHIRT,    h >> 12);
  const hairStyle = (h >> 16) % 8;
  const eyeStyle  = (h >> 20) % 3;
  const mouthStyle= (h >> 24) % 3;

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="${bg}"/>
    <ellipse cx="50" cy="95" rx="30" ry="18" fill="${shirtClr}"/>
    <rect x="44" y="64" width="12" height="12" rx="6" fill="${skin}"/>
    ${hairPath(hairStyle, hairClr)}
    <ellipse cx="50" cy="47" rx="18" ry="20" fill="${skin}"/>
    ${eyePath(eyeStyle)}
    <ellipse cx="50" cy="51" rx="1.4" ry="1" fill="${skinDark}"/>
    ${mouthPath(mouthStyle)}
  </svg>`;
}

export default function UserAvatar({ user, size = 28, className = '' }) {
  const seed = user?.id ?? user?.name ?? 'anon';
  const svg = generateSvg(seed);
  const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      className={`rounded-full flex-shrink-0 ${className}`}
      title={user?.name}
      alt={user?.name ?? ''}
      draggable={false}
    />
  );
}
