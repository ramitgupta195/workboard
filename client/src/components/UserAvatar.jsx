export default function UserAvatar({ user, size = 28, className = '' }) {
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`}
      style={{ width: size, height: size, background: user?.avatar_color || '#6366f1', fontSize: size * 0.38 }}
      title={user?.name}
    >
      {initials}
    </div>
  );
}
