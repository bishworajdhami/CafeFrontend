import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const [connection, setConnection] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [reconnectCount, setReconnectCount] = useState(0);
    const socketRef = useRef(null);

    // Initial and reactive connection setup
    useEffect(() => {
        const startConnection = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                // If we have a connection but no token, stop it
                if (socketRef.current) {
                    console.log('[SignalR] No token found, stopping connection');
                    await socketRef.current.stop();
                    socketRef.current = null;
                    setConnection(null);
                    setIsConnected(false);
                }
                return;
            }

            // If already connected or connecting, skip
            if (socketRef.current && (socketRef.current.state === 'Connected' || socketRef.current.state === 'Connecting')) {
                return;
            }

            const API_BASE = process.env.REACT_APP_API_URL || '';
            const hubUrl = `${API_BASE.replace(/\/$/, '')}/hubs/orders`;

            console.log(`[SignalR] Initializing connection to ${hubUrl}`);
            const conn = new signalR.HubConnectionBuilder()
                .withUrl(hubUrl, {
                    accessTokenFactory: () => localStorage.getItem('token')
                })
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds: retryContext => {
                        if (retryContext.elapsedMilliseconds < 60000) return 2000;
                        return 10000;
                    }
                })
                .configureLogging(signalR.LogLevel.Information)
                .build();

            conn.onreconnecting(() => {
                console.warn('[SignalR] Reconnecting...');
                setIsConnected(false);
            });

            conn.onreconnected(() => {
                console.log('[SignalR] Reconnected successfully');
                setIsConnected(true);
                // Incrementing this triggers useEffects in consumers to re-subscribe
                setReconnectCount(prev => prev + 1);
            });

            conn.onclose(() => {
                console.error('[SignalR] Connection closed');
                setIsConnected(false);
            });

            try {
                await conn.start();
                console.log('[SignalR] Connected successfully');
                socketRef.current = conn;
                setConnection(conn);
                setIsConnected(true);
            } catch (err) {
                console.error('[SignalR] Connection failed:', err);
            }
        };

        // Check on mount
        startConnection();

        // Polling to detect login/token presence without requiring a refresh
        const interval = setInterval(startConnection, 5000);

        // Listen for storage events (login in another tab)
        window.addEventListener('storage', startConnection);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', startConnection);
            if (socketRef.current) {
                socketRef.current.stop();
            }
        };
    }, []);

    return (
        <SocketContext.Provider value={{ connection, isConnected, reconnectCount, socketRef }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}
