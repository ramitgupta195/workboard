import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardsApi } from '../api';
import api from '../api';
import UserAvatar from './UserAvatar';

const BG_OPTIONS = [
  { value: 'gradient-1', label: 'Ocean' },
  { value: 'gradient-2', label: 'Sunset' },
  { value: 'gradient-3', label: 'Forest' },
  { value: 'gradient-4', label: 'Sky' },
  { value: 'gradient-5', label: 'Coral' },
  { value: 'gradient-6', label: 'Dusk' },
];

const ROLES = ['viewer', 'csm', 'member', 'admin', 'owner'];

const ROLE_BADGE = {
  owner:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
  admin:  'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  member: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  csm:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  viewer: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
};

export default function BoardSettingsModal({
  board,
  members,
  onClose,
  onUpdated,
  onMembersChanged,
  currentUserRole,
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('settings');

  // Settings tab state
  const [title, setTitle] = useState(board.title || '');
  const [background, setBackground] = useState(board.background || 'gradient-1');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Members tab state
  const [localMembers, setLocalMembers] = useState(members || []);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState('');
  const [roleUpdating, setRoleUpdating] = useState({});
  const [removing, setRemoving] = useState({});

  const canManage = currentUserRole === 'admin' || currentUserRole === 'owner';
  const isOwner = currentUserRole === 'owner';

  // ---- Settings tab handlers ----

  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await boardsApi.update(board.id, {
        title: title.trim(),
        background,
      });
      onUpdated(updated);
    } catch (err) {
      setSaveError(err?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await boardsApi.delete(board.id);
      onClose();
      navigate('/');
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // ---- Members tab handlers ----

  async function handleAddMember(e) {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAddingMember(true);
    setAddError('');
    try {
      const newMember = await api.post(`/boards/${board.id}/members`, {
        email: addEmail.trim(),
        role: addRole,
      });
      const updated = [...localMembers, newMember];
      setLocalMembers(updated);
      onMembersChanged(updated);
      setAddEmail('');
      setAddRole('member');
    } catch (err) {
      setAddError(err?.error || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    setRoleUpdating(r => ({ ...r, [userId]: true }));
    try {
      await api.put(`/boards/${board.id}/members/${userId}`, { role: newRole });
      const updated = localMembers.map(m =>
        m.id === userId ? { ...m, role: newRole } : m
      );
      setLocalMembers(updated);
      onMembersChanged(updated);
    } catch (err) {
      // ignore, revert visually is handled by not changing state
    } finally {
      setRoleUpdating(r => ({ ...r, [userId]: false }));
    }
  }

  async function handleRemoveMember(userId) {
    if (!confirm('Remove this member from the board?')) return;
    setRemoving(r => ({ ...r, [userId]: true }));
    try {
      await api.delete(`/boards/${board.id}/members/${userId}`);
      const updated = localMembers.filter(m => m.id !== userId);
      setLocalMembers(updated);
      onMembersChanged(updated);
    } catch (err) {
      // ignore
    } finally {
      setRemoving(r => ({ ...r, [userId]: false }));
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg animate-slide-up border border-slate-200 dark:border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Board settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 px-6">
          {['settings', 'members'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 mr-6 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ---- Settings tab ---- */}
          {tab === 'settings' && (
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Board title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Board title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Background
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BG_OPTIONS.map(bg => (
                    <button
                      key={bg.value}
                      type="button"
                      onClick={() => setBackground(bg.value)}
                      className={`h-14 rounded-lg bg-${bg.value} relative overflow-hidden transition-all ${
                        background === bg.value
                          ? 'ring-2 ring-indigo-500 ring-offset-1'
                          : 'hover:opacity-80'
                      }`}
                    >
                      <span className="absolute inset-0 flex items-end pb-1 justify-center text-white text-xs font-medium opacity-80">
                        {bg.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {saveError && (
                <p className="text-sm text-red-500">{saveError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>

              {/* Danger zone — owner only */}
              {isOwner && (
                <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                    Danger zone
                  </p>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete this board
                    </button>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-3">
                        Are you sure? This will permanently delete the board and all its cards.
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                        >
                          {deleting ? 'Deleting…' : 'Yes, delete board'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          {/* ---- Members tab ---- */}
          {tab === 'members' && (
            <div className="space-y-5">
              {/* Member list */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {localMembers.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-2"
                  >
                    <UserAvatar user={member} size={32} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {member.email}
                      </p>
                    </div>

                    {canManage && member.role !== 'owner' ? (
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value)}
                        disabled={roleUpdating[member.id]}
                        className="text-xs border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {ROLES.filter(r => r !== 'owner').map(r => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[member.role] || ROLE_BADGE.viewer}`}
                      >
                        {member.role}
                      </span>
                    )}

                    {canManage && member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removing[member.id]}
                        className="text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 flex-shrink-0"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add member form */}
              {canManage && (
                <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Add member
                  </p>
                  <form onSubmit={handleAddMember} className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={addEmail}
                        onChange={e => setAddEmail(e.target.value)}
                        placeholder="Email address"
                        className="flex-1 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={addRole}
                        onChange={e => setAddRole(e.target.value)}
                        className="border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {ROLES.filter(r => r !== 'owner').map(r => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {addError && (
                      <p className="text-sm text-red-500">{addError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={!addEmail.trim() || addingMember}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      {addingMember ? 'Adding…' : 'Add member'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
