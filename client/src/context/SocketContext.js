import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { getApiOrigin } from '../lib/runtimeApi';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('f10_token') || localStorage.getItem('token');

    if (token && typeof window !== 'undefined') {
      const url = process.env.REACT_APP_SERVER_URL || getApiOrigin();
      if (!url) return undefined;

      const newSocket = io(url, {
        auth: {
          token,
        },
      });

      newSocket.on('connect', () => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('Socket connected');
        }
        setConnected(true);
      });

      newSocket.on('disconnect', () => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('Socket disconnected');
        }
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Socket connection error:', error);
        }
        setConnected(false);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, []);

  const joinAuction = (auctionId) => {
    if (socket) {
      socket.emit('join-auction', auctionId);
    }
  };

  const leaveAuction = (auctionId) => {
    if (socket) {
      socket.emit('leave-auction', auctionId);
    }
  };

  const value = {
    socket,
    connected,
    joinAuction,
    leaveAuction
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};


































