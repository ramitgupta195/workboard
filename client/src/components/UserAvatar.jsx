function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Curated gradient pairs — modern, distinct
const GRADIENTS = [
  ['#667eea','#764ba2'],
  ['#f093fb','#f5576c'],
  ['#4facfe','#00f2fe'],
  ['#43e97b','#38f9d7'],
  ['#fa709a','#fee140'],
  ['#30cfd0','#667eea'],
  ['#6a11cb','#2575fc'],
  ['#f7971e','#ffd200'],
  ['#ee0979','#ff6a00'],
  ['#0ba360','#3cba92'],
  ['#bc4e9c','#f80759'],
  ['#4481eb','#04befe'],
];

// 8 minimal flat hair shapes — all sit on a head circle at cx=50 cy=43 r=18
function hair(style, color) {
  const f = `fill="${color}"`;
  switch (style) {
    case 0: // Clean crop
      return `<rect x="32" y="25" width="36" height="18" rx="18" ${f}/>`;
    case 1: // Round natural
      return `<circle cx="50" cy="38" r="21" ${f}/>`;
    case 2: // Top bun
      return `<circle cx="50" cy="18" r="9" ${f}/>
              <rect x="46" y="17" width="8" height="14" ${f}/>
              <circle cx="50" cy="38" r="21" ${f}/>`;
    case 3: // Side-swept / parted
      return `<ellipse cx="46" cy="34" rx="22" ry="16" ${f}/>
              <ellipse cx="62" cy="28" rx="12" ry="10" ${f}/>`;
    case 4: // Afro / full
      return `<circle cx="50" cy="35" r="26" ${f}/>`;
    case 5: // Long sides
      return `<circle cx="50" cy="38" r="21" ${f}/>
              <rect x="27" y="38" width="8" height="30" rx="4" ${f}/>
              <rect x="65" y="38" width="8" height="30" rx="4" ${f}/>`;
    case 6: // Flat-top fade
      return `<rect x="32" y="22" width="36" height="22" rx="4" ${f}/>`;
    case 7: // Wavy / loose
      return `<circle cx="50" cy="38" r="21" ${f}/>
              <path d="M29 48 Q34 55 29 62 Q26 68 30 74" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"/>
              <path d="M71 48 Q66 55 71 62 Q74 68 70 74" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
    default:
      return `<circle cx="50" cy="38" r="21" ${f}/>`;
  }
}

function generateSvg(seed) {
  const h = hash(String(seed ?? 'anon'));
  const [c1, c2] = GRADIENTS[h % GRADIENTS.length];
  const hairStyle = (h >> 8) % 8;

  // Hair color: midpoint between gradient start and a darkened version
  const mix = (a, b) => Math.round((parseInt(a,16) + parseInt(b,16)) / 2).toString(16).padStart(2,'0');
  const blend = (hex, amt) => {
    const r = Math.max(0, parseInt(hex.slice(1,3),16) - amt).toString(16).padStart(2,'0');
    const g = Math.max(0, parseInt(hex.slice(3,5),16) - amt).toString(16).padStart(2,'0');
    const b = Math.max(0, parseInt(hex.slice(5,7),16) - amt).toString(16).padStart(2,'0');
    return `#${r}${g}${b}`;
  };
  const hairColor = blend(c1, 55);

  // Unique gradient angle per user
  const angle = (h >> 16) % 4 * 45; // 0, 45, 90, 135

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle},0.5,0.5)">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <clipPath id="clip"><circle cx="50" cy="50" r="50"/></clipPath>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#bg)"/>
  <g clip-path="url(#clip)">
    ${hair(hairStyle, hairColor)}
    <circle cx="50" cy="43" r="18" fill="rgba(255,255,255,0.92)"/>
    <circle cx="44" cy="42" r="2" fill="${hairColor}" opacity="0.7"/>
    <circle cx="56" cy="42" r="2" fill="${hairColor}" opacity="0.7"/>
    <ellipse cx="50" cy="86" rx="30" ry="20" fill="rgba(255,255,255,0.18)"/>
  </g>
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
