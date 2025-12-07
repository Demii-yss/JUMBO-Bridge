import React, { useState, useEffect, useRef } from 'react';
import DisconnectedPage from './DisconnectedPage';

interface ServerMonitorProps {
    children: React.ReactNode;
}

const ServerMonitor: React.FC<ServerMonitorProps> = ({ children }) => {
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        const checkServerStatus = async () => {
            try {
                // Try to fetch the root page or a stable resource
                // Using HEAD to minimize data transfer
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout

                const response = await fetch('/', {
                    method: 'HEAD',
                    signal: controller.signal,
                    cache: 'no-store'
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    if (!isOnline) {
                        // Was offline, now online -> Reload to re-sync everything
                        window.location.reload();
                    }
                    setIsOnline(true);
                } else {
                    // unexpected status code
                    setIsOnline(false);
                }
            } catch (error) {
                // Fetch failed (network error, timeout, connection refused)
                setIsOnline(false);
            }
        };

        // Check initially
        checkServerStatus();

        // Poll every 2 seconds
        intervalRef.current = window.setInterval(checkServerStatus, 2000);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isOnline]);

    if (!isOnline) {
        return <DisconnectedPage />;
    }

    return <>{children}</>;
};

export default ServerMonitor;
