import { useState } from 'react';
import { invitesApi, workspaceApi } from '../api';

const ROLES = [
  { value: 'admin',   label: 'Admin',   desc: 'Full board access + invite others', color: 'text-violet-600 dark:text-violet-400' },
  { value: 'manager', label: 'Manager', desc: 'Manage cards and columns',          color: 'text-blue-600 dark:text-blue-400' },
  { value: 'member',  label: 'Member',  desc: 'Create and edit cards',             color: 'text-slate-600 dark:text-slate-400' },
];

export default function InviteModal({ boardId, boardTitle, onClose }) {
  const [mode, setMode] = useState('board'); // 'board' | 'workspace'
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  async function handleSend(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError('');
    try {
      if (mode === 'workspace') {
        await workspaceApi.invite(email.trim(), role);
      } else {
        await invitesApi.create(boardId, email.trim(), role);
      }
      setSent(email.trim());
      setEmail('');
    } catch (err) {
      setError(err.error || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setSent('');
    setError('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Invite people</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[260px]">
              {mode === 'workspace' ? 'All boards in workspace' : boardTitle}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Mode toggle */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-700/60 p-1 gap-1">
            <button
              onClick={() => switchMode('board')}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                mode === 'board'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              This board
            </button>
            <button
              onClick={() => switchMode('workspace')}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                mode === 'workspace'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              All boards
            </button>
          </div>

          {/* Workspace info banner */}
          {mode === 'workspace' && (
            <div className="flex items-start gap-2.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl px-3.5 py-3">
              <svg className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                This person will be added to <strong>all existing boards</strong> and automatically added to <strong>any new boards</strong> you create.
              </p>
            </div>
          )}

          {/* Role picker */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Role</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                    role === r.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className={`text-xs font-bold ${r.color}`}>{r.label}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-tight">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Admin info banner */}
          {role === 'admin' && (
            <div className="flex items-start gap-2.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40 rounded-xl px-3.5 py-3">
              <svg className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
                Admins can manage members, columns, and automations. They can also <strong>create their own boards</strong> and use the full app independently after signing up.
              </p>
            </div>
          )}

          {/* Email form */}
          <form onSubmit={handleSend} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); setSent(''); }}
                placeholder="colleague@company.com"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 bg-white dark:bg-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
            </div>

            {sent && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Invite sent to <strong>{sent}</strong>
              </div>
            )}
            {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send invite
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
            New users will be prompted to create an account when they click the link.
          </p>
        </div>
      </div>
    </div>
  );
}
