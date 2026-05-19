function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

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

export default function UserAvatar({ user, size = 28, className = '' }) {
  const seed = user?.id ?? user?.name ?? 'anon';
  const h = hash(String(seed));
  const [c1, c2] = GRADIENTS[h % GRADIENTS.length];

  const initials = user?.name
    ? user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const fontSize = Math.round(size * 0.38);

  return (
    <div
      className={`rounded-full flex-shrink-0 flex items-center justify-center select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        fontSize,
        fontWeight: 600,
        color: '#fff',
        letterSpacing: '0.01em',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
      title={user?.name}
    >
      {initials}
    </div>
  );
}
