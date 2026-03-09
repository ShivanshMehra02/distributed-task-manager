import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8001';

let socket = null;

export const getSocket = (token) => {
  if (!socket && token) {
    socket = io(SOCKET_URL, {
      path: '/api/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
