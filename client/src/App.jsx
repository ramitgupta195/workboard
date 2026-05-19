import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import Boards from './pages/Boards';
import Board from './pages/Board';
import Automations from './pages/Automations';
import Permissions from './pages/Permissions';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import MyTasks from './pages/MyTasks';
import AcceptInvite from './pages/AcceptInvite';
import FileExplorer from './pages/FileExplorer';

function PrivateRoute({ children }) {
  const user = useAuthStore(s => s.user);
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/" element={<PrivateRoute><Boards /></PrivateRoute>} />
        <Route path="/boards/:id" element={<PrivateRoute><Board /></PrivateRoute>} />
        <Route path="/boards/:id/automations" element={<PrivateRoute><Automations /></PrivateRoute>} />
        <Route path="/boards/:id/permissions" element={<PrivateRoute><Permissions /></PrivateRoute>} />
        <Route path="/permissions" element={<PrivateRoute><Permissions /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/my-tasks" element={<PrivateRoute><MyTasks /></PrivateRoute>} />
        <Route path="/files" element={<PrivateRoute><FileExplorer /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
