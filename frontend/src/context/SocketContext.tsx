import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { CONFIG } from '../config';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  emitLocation: (latitude: number, longitude: number, heading?: number, speed?: number) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    console.log('🔌 Connecting to WebSocket Server at:', CONFIG.SOCKET_URL);
    const newSocket = io(CONFIG.SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket backend Server!');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket backend Server!');
      setIsConnected(false);
    });

    newSocket.on('error', (err) => {
      console.error('⚠️ WebSocket error:', err);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, isAuthenticated]);

  const emitLocation = (latitude: number, longitude: number, heading?: number, speed?: number) => {
    if (socket && isConnected) {
      socket.emit('update-location', {
        latitude,
        longitude,
        heading,
        speed,
      });
    } else {
      console.warn('⚠️ Cannot emit location: Socket not connected.');
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, emitLocation }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
