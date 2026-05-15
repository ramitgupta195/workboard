import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import UserAvatar from './UserAvatar';
import NotificationsPanel from './NotificationsPanel';

export default function Navbar({ title, boardBackground, boardId, canManageBoard, onSettingsClick, onSearchClick }) {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const { theme, toggle } = useThemeStore();
  const [spinning, setSpinning] = useState(false);
  const onBoard = !!boardBackground;

  function handleToggle() {
    if (spinning) return;
    setSpinning(true);
    toggle();
    setTimeout(() => setSpinning(false), 400);
  }

  return (
    <nav
      className={`h-[52px] flex items-center justify-between px-4 flex-shrink-0 ${
        onBoard
          ? 'bg-black/25'
          : 'bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Link
          to="/"
          className={`flex items-center gap-2 font-semibold text-sm transition-opacity hover:opacity-70 ${
            onBoard ? 'text-white' : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
            onBoard ? 'bg-white/20' : 'bg-indigo-600'
          }`}>
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <span className="hidden sm:inline">Workboard</span>
        </Link>

        {title && (
          <>
            <span className={`text-sm ${onBoard ? 'text-white/40' : 'text-slate-300'}`}>/</span>
            <span className={`text-sm font-medium truncate max-w-[180px] ${onBoard ? 'text-white/90' : 'text-slate-600'}`}>
              {title}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs hidden sm:inline ${onBoard ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}`}>
          {user?.name}
        </span>

        {boardId && (
          <div className="hidden sm:flex items-center gap-1.5">
            {onSearchClick && (
              <button
                onClick={onSearchClick}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  onBoard
                    ? 'bg-white/15 hover:bg-white/25 text-white/80 hover:text-white'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
                title="Search (⌘K)"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
            <Link
              to={`/boards/${boardId}/automations`}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                onBoard
                  ? 'bg-white/15 hover:bg-white/25 text-white/80 hover:text-white'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Automations
            </Link>
{canManageBoard && onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  onBoard
                    ? 'bg-white/15 hover:bg-white/25 text-white/80 hover:text-white'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
                title="Board settings"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </button>
            )}
          </div>
        )}

        <NotificationsPanel onBoard={onBoard} />

        <button
          onClick={handleToggle}
          className={`p-1.5 rounded-lg transition-colors ${
            onBoard
              ? 'text-white/70 hover:text-white hover:bg-white/10'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className={spinning ? 'theme-spin' : ''} style={{ display: 'block' }}>
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </span>
        </button>

        <div className="relative group">
          <UserAvatar
            user={user}
            size={28}
            className={`cursor-pointer ring-2 transition-all ${
              onBoard ? 'ring-white/30 hover:ring-white/60' : 'ring-slate-100 hover:ring-indigo-200'
            }`}
          />
          <div className="absolute right-0 top-full mt-1.5 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-50 py-1">
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
