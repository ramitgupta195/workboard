import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { invitesApi } from '../api';
import { useAuthStore } from '../store/authStore';

const ROLE_COLOR = {
  owner: 'bg-indigo-100 text-indigo-700',
  admin: 'bg-violet-100 text-violet-700',
  manager: 'bg-blue-100 text-blue-700',
  member: 'bg-slate-100 text-slate-600',
};

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    invitesApi.get(token)
      .then(setInviteInfo)
      .catch(() => setError('This invite link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Auto-accept once user is logged in and invite is loaded
  useEffect(() => {
    if (user && inviteInfo && !accepted && !accepting) {
      accept();
    }
  }, [user, inviteInfo]);

  async function accept() {
    setAccepting(true);
    try {
      await invitesApi.accept(token);
      setAccepted(true);
      setTimeout(() => navigate(`/boards/${inviteInfo.board.id}`), 1800);
    } catch (err) {
      const msg = err.error || '';
      if (msg === 'Already a board member') {
        navigate(`/boards/${inviteInfo.board.id}`);
      } else {
        setError(msg || 'Failed to accept invite.');
        setAccepting(false);
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-0 overflow-hidden animate-slide-up">

        {/* Header strip */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-7 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15 rounded-2xl mb-3">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">You're invited!</h1>
          <p className="text-indigo-200 text-sm mt-1">Join your team on Workboard</p>
        </div>

        <div className="px-8 py-6">
          {loading ? (
            <div className="text-center py-6">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400 mt-3">Loading invite…</p>
            </div>

          ) : error ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">Invite not available</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{error}</p>
              </div>
              <Link to="/" className="inline-block text-sm text-indigo-600 hover:underline font-medium">Go to Workboard</Link>
            </div>

          ) : accepted ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">Welcome aboard!</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Taking you to <strong>{inviteInfo?.board.title}</strong>…</p>
              </div>
            </div>

          ) : inviteInfo ? (
            <div className="space-y-5">
              {/* Board card */}
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-5 text-center border border-slate-100 dark:border-slate-700">
                {inviteInfo.inviterName && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                    <span className="font-medium text-slate-600 dark:text-slate-300">{inviteInfo.inviterName}</span> invited you to
                  </p>
                )}
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{inviteInfo.board.title}</p>
                <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full capitalize ${ROLE_COLOR[inviteInfo.role] || ROLE_COLOR.member}`}>
                  {inviteInfo.role}
                </span>
              </div>

              {!user ? (
                <div className="space-y-3">
                  <p className="text-center text-sm text-slate-500 dark:text-slate-400">Sign in or create an account to accept</p>
                  <Link
                    to={`/register?redirect=/invite/${token}`}
                    className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-center text-sm"
                  >
                    Create account & join
                  </Link>
                  <Link
                    to={`/login?redirect=/invite/${token}`}
                    className="block w-full border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-3 rounded-xl transition-colors text-center text-sm"
                  >
                    Sign in to accept
                  </Link>
                </div>
              ) : (
                <button
                  onClick={accept}
                  disabled={accepting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  {accepting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Joining…
                    </span>
                  ) : 'Accept & join board'}
                </button>
              )}

              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                <Link to="/" className="hover:text-slate-600 transition-colors">Go home instead</Link>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
