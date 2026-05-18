import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { invitesApi } from '../api';
import { useAuthStore } from '../store/authStore';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    invitesApi.get(token)
      .then(setInviteInfo)
      .catch(() => setError('This invite link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    try {
      await invitesApi.accept(token);
      navigate(`/boards/${inviteInfo.board.id}`);
    } catch (err) {
      setError(err.error || 'Failed to accept invite. Please try again.');
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-3">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Board invite</h1>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400 mt-3">Loading invite…</p>
          </div>
        ) : error ? (
          <div className="text-center space-y-4">
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg px-4 py-4 text-sm">
              {error}
            </div>
            {!user ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <Link to="/login" className="text-indigo-600 hover:underline font-medium">Sign in</Link> to view board invites.
              </p>
            ) : (
              <Link to="/" className="text-sm text-indigo-600 hover:underline font-medium">Go to your boards</Link>
            )}
          </div>
        ) : inviteInfo ? (
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">You've been invited to</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{inviteInfo.board.title}</p>
              {inviteInfo.role && (
                <span className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 capitalize">
                  {inviteInfo.role}
                </span>
              )}
            </div>

            {!user ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Sign in to accept this invite
                </p>
                <Link
                  to={`/login?redirect=/invite/${token}`}
                  className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors text-center text-sm"
                >
                  Sign in to accept
                </Link>
              </div>
            ) : (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {accepting ? 'Joining…' : 'Accept & Join board'}
              </button>
            )}

            <p className="text-center text-sm text-slate-400 dark:text-slate-500">
              <Link to="/" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Go home instead</Link>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
