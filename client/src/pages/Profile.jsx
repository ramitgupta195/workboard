import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAuthStore } from '../store/authStore';
import Navbar from '../components/Navbar';
import UserAvatar from '../components/UserAvatar';

const COLORS = [
  '#94a3b8', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#10b981', '#06b6d4', '#3b82f6',
];

export default function Profile() {
  const user = useAuthStore(s => s.user);
  const login = useAuthStore(s => s.login);
  const token = useAuthStore(s => s.token);
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    avatar_color: user?.avatar_color || '#6366f1',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    if (!profileForm.name.trim()) { setProfileError('Name is required.'); return; }
    setProfileLoading(true);
    try {
      const updated = await authApi.updateProfile(profileForm);
      login(updated, token);
      setProfileSuccess('Profile updated!');
    } catch (err) {
      setProfileError(err.error || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }
    if (pwForm.newPassword.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    setPwLoading(true);
    try {
      await authApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwSuccess('Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwError(err.error || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Profile settings</h1>
        </div>

        {/* Profile info card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <UserAvatar user={profileForm} size={56} />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{user?.name}</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">{user?.email}</p>
            </div>
          </div>

          {profileSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-lg px-4 py-3 text-sm mb-4">
              {profileSuccess}
            </div>
          )}
          {profileError && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Display name</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Avatar color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setProfileForm(f => ({ ...f, avatar_color: c }))}
                    className="w-8 h-8 rounded-full transition-transform focus:outline-none"
                    style={{
                      background: c,
                      transform: profileForm.avatar_color === c ? 'scale(1.2)' : 'scale(1)',
                      boxShadow: profileForm.avatar_color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : 'none',
                    }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={profileLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              {profileLoading ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Change password card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-5">Change password</h2>

          {pwSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 rounded-lg px-4 py-3 text-sm mb-4">
              {pwSuccess}
            </div>
          )}
          {pwError && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-4">
              {pwError}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Current password</label>
              <input
                type="password"
                required
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">New password</label>
              <input
                type="password"
                required
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Confirm new password</label>
              <input
                type="password"
                required
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={pwLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              {pwLoading ? 'Changing…' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
