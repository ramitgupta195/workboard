import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { boardsApi, invitesApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { PERMISSION_DEFS, DEFAULT_PERMISSIONS } from '../hooks/useBoardPermissions';
import Navbar from '../components/Navbar';
import UserAvatar from '../components/UserAvatar';

const BG_PREVIEW = {
  'gradient-1': 'linear-gradient(135deg,#1e3a5f,#1b6ca8)',
  'gradient-2': 'linear-gradient(135deg,#1a1a2e,#0f3460)',
  'gradient-3': 'linear-gradient(135deg,#3b0764,#6f0000)',
  'gradient-4': 'linear-gradient(135deg,#0f2027,#2c5364)',
  'gradient-5': 'linear-gradient(135deg,#2d3561,#4286f4)',
  'gradient-6': 'linear-gradient(135deg,#134e5e,#71b280)',
};

const ROLE_COLS = [
  { key: 'admin',   label: 'Admin',   color: 'text-violet-600 dark:text-violet-400',  dot: 'bg-violet-500' },
  { key: 'manager', label: 'Manager', color: 'text-blue-600 dark:text-blue-400',      dot: 'bg-blue-500' },
  { key: 'member',  label: 'Member',  color: 'text-slate-600 dark:text-slate-400',    dot: 'bg-slate-400' },
];

const ROLE_BADGE = {
  owner:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
  admin:   'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  member:  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

function Toggle({ enabled, onChange, locked }) {
  return (
    <button
      onClick={() => !locked && onChange(!enabled)}
      disabled={locked}
      title={locked ? 'Owner always has full access' : (enabled ? 'Click to disable' : 'Click to enable')}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        locked ? 'cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? (locked ? 'bg-indigo-300 dark:bg-indigo-800' : 'bg-indigo-500') : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function Permissions() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const [allBoards, setAllBoards] = useState([]);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [members, setMembers] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSentTo, setInviteSentTo] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Load boards list
  useEffect(() => {
    boardsApi.list().then(boards => {
      const owned = boards.filter(b => b.created_by === user?.id);
      setAllBoards(owned);
      if (owned.length > 0) loadBoard(owned[0].id);
    });
  }, []);

  async function loadBoard(boardId) {
    setLoadingBoard(true);
    setDirty(false);
    setSavedOk(false);
    try {
      const [boardData, permsData] = await Promise.all([
        boardsApi.get(boardId),
        boardsApi.getPermissions(boardId),
      ]);
      setSelectedBoard(boardData);
      setMembers(boardData.members || []);
      const merged = {};
      ROLE_COLS.forEach(({ key }) => {
        merged[key] = { ...DEFAULT_PERMISSIONS[key], ...(permsData[key] || {}) };
      });
      setPermissions(merged);
    } finally {
      setLoadingBoard(false);
    }
  }

  function togglePerm(role, key) {
    setPermissions(prev => ({ ...prev, [role]: { ...prev[role], [key]: !prev[role][key] } }));
    setDirty(true);
    setSavedOk(false);
  }

  function resetToDefaults() {
    const reset = {};
    ROLE_COLS.forEach(({ key }) => { reset[key] = { ...DEFAULT_PERMISSIONS[key] }; });
    setPermissions(reset);
    setDirty(true);
    setSavedOk(false);
  }

  async function savePermissions() {
    if (!selectedBoard) return;
    setSaving(true);
    try {
      await Promise.all(
        ROLE_COLS.map(({ key }) => boardsApi.updateRolePermissions(selectedBoard.id, key, permissions[key]))
      );
      setDirty(false);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(memberId, newRole) {
    await boardsApi.updateMemberRole(selectedBoard.id, memberId, newRole);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  }

  async function handleRemoveMember(memberId) {
    if (!confirm('Remove this member from the board?')) return;
    await boardsApi.removeMember(selectedBoard.id, memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }

  async function handleSendInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    setInviteError('');
    setInviteSentTo('');
    try {
      await invitesApi.create(selectedBoard.id, inviteEmail.trim(), inviteRole);
      setInviteSentTo(inviteEmail.trim());
      setInviteEmail('');
    } catch (err) {
      setInviteError(err.error || 'Failed to send invite');
    } finally {
      setSendingInvite(false);
    }
  }

  const myMembership = members.find(m => m.id === user?.id);
  const isOwner = myMembership?.role === 'owner' || selectedBoard?.created_by === user?.id;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>

        {/* ── Left sidebar: board list ── */}
        <aside className="w-60 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto">
          <div className="px-4 pt-5 pb-3">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Your boards</p>
          </div>

          {allBoards.length === 0 ? (
            <p className="px-4 text-xs text-slate-400 dark:text-slate-500">You don't own any boards yet.</p>
          ) : (
            <nav className="flex flex-col gap-0.5 px-2 pb-4">
              {allBoards.map(board => {
                const active = selectedBoard?.id === board.id;
                return (
                  <button
                    key={board.id}
                    onClick={() => !active && loadBoard(board.id)}
                    className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-md flex-shrink-0"
                      style={{ background: BG_PREVIEW[board.background] || BG_PREVIEW['gradient-1'] }}
                    />
                    <span className="text-xs font-medium truncate">{board.title}</span>
                    {active && (
                      <svg className="w-3 h-3 ml-auto text-indigo-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          {!selectedBoard ? (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm">
              Select a board to manage permissions
            </div>
          ) : loadingBoard ? (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm animate-pulse">
              Loading…
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-8 py-8">

              {/* Page header */}
              <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-lg flex-shrink-0"
                    style={{ background: BG_PREVIEW[selectedBoard.background] || BG_PREVIEW['gradient-1'] }}
                  />
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedBoard.title}</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Permissions &amp; members</p>
                  </div>
                </div>
                <Link
                  to={`/boards/${selectedBoard.id}`}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Open board
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              </div>

              <div className="grid grid-cols-5 gap-5">

                {/* ── Permission matrix (left, wider) ── */}
                <div className="col-span-3">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">

                    {/* Matrix header */}
                    <div className="grid grid-cols-[1fr_80px_80px_80px] items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Permission</span>
                      {ROLE_COLS.map(r => (
                        <div key={r.key} className="text-center">
                          <span className={`text-[11px] font-bold uppercase tracking-wide ${r.color}`}>{r.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Permission rows */}
                    {PERMISSION_DEFS.map(({ key, label, description }, i) => (
                      <div
                        key={key}
                        className={`grid grid-cols-[1fr_80px_80px_80px] items-center px-4 py-3 ${
                          i < PERMISSION_DEFS.length - 1 ? 'border-b border-slate-50 dark:border-slate-800/60' : ''
                        } hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{description}</p>
                        </div>
                        {ROLE_COLS.map(r => (
                          <div key={r.key} className="flex justify-center">
                            <Toggle
                              enabled={permissions[r.key]?.[key] ?? false}
                              onChange={() => isOwner && togglePerm(r.key, key)}
                              locked={!isOwner}
                            />
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Save bar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800">
                      {isOwner ? (
                        <>
                          <button
                            onClick={resetToDefaults}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                          >
                            Reset to defaults
                          </button>
                          <button
                            onClick={savePermissions}
                            disabled={saving || !dirty}
                            className={`text-xs font-semibold px-5 py-1.5 rounded-lg transition-all ${
                              savedOk
                                ? 'bg-emerald-500 text-white'
                                : dirty
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {saving ? 'Saving…' : savedOk ? '✓ Saved' : 'Save changes'}
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500">Only the board owner can edit permissions</p>
                      )}
                    </div>
                  </div>

                  {/* Role legend */}
                  <div className="mt-3 grid grid-cols-3 gap-2.5">
                    {ROLE_COLS.map(r => {
                      const count = PERMISSION_DEFS.filter(p => permissions[r.key]?.[p.key]).length;
                      return (
                        <div key={r.key} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${r.dot}`} />
                            <span className={`text-xs font-bold ${r.color}`}>{r.label}</span>
                          </div>
                          <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                            {count}
                            <span className="text-xs font-normal text-slate-400 dark:text-slate-500"> / {PERMISSION_DEFS.length}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">permissions enabled</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Members panel (right) ── */}
                <div className="col-span-2">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Members
                        <span className="ml-2 text-xs font-normal text-slate-400">({members.length})</span>
                      </h3>
                    </div>

                    <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-80 overflow-y-auto">
                      {members.map(m => {
                        const isMe = m.id === user?.id;
                        const isThisOwner = m.role === 'owner';
                        return (
                          <div key={m.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                            <UserAvatar user={m} size={28} className="flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                                {m.name}
                                {isMe && <span className="text-slate-400 font-normal ml-1">(you)</span>}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                            </div>
                            {isOwner && !isMe && !isThisOwner ? (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <select
                                  value={m.role}
                                  onChange={e => handleRoleChange(m.id, e.target.value)}
                                  className="text-[11px] border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1 bg-white dark:bg-slate-800 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                                >
                                  <option value="admin">Admin</option>
                                  <option value="manager">Manager</option>
                                  <option value="member">Member</option>
                                </select>
                                <button
                                  onClick={() => handleRemoveMember(m.id)}
                                  className="p-1 text-slate-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                                  title="Remove"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_BADGE[m.role]}`}>
                                {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {isOwner && (
                      <form onSubmit={handleSendInvite} className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Send invite</p>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={e => { setInviteEmail(e.target.value); setInviteError(''); setInviteSentTo(''); }}
                          placeholder="their@email.com"
                          className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-1.5"
                        />
                        <div className="flex gap-1.5">
                          <select
                            value={inviteRole}
                            onChange={e => setInviteRole(e.target.value)}
                            className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="member">Member</option>
                          </select>
                          <button
                            type="submit"
                            disabled={sendingInvite || !inviteEmail.trim()}
                            className="flex-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                          >
                            {sendingInvite ? 'Sending…' : 'Send invite'}
                          </button>
                        </div>
                        {inviteSentTo && (
                          <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1.5 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Invite sent to {inviteSentTo}
                          </p>
                        )}
                        {inviteError && <p className="text-red-500 text-xs mt-1.5">{inviteError}</p>}
                      </form>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
