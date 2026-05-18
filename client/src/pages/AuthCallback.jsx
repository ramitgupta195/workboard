import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api';

export default function AuthCallback() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error || !token) {
      navigate('/login?error=google');
      return;
    }

    localStorage.setItem('wb_token', token);
    authApi.me().then(user => {
      login(user, token);
      navigate('/');
    }).catch(() => navigate('/login?error=google'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/70 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
