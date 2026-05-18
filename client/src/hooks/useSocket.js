import { useEffect } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('http://localhost:3001', { withCredentials: true });
  }
  return socket;
}

export function useSocket(boardId, handlers) {
  useEffect(() => {
    if (!boardId) return;
    const s = getSocket();
    s.emit('join:board', boardId);
    Object.entries(handlers).forEach(([event, handler]) => s.on(event, handler));
    return () => {
      s.emit('leave:board', boardId);
      Object.entries(handlers).forEach(([event, handler]) => s.off(event, handler));
    };
  }, [boardId]);
}
