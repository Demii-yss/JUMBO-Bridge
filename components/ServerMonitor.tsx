import React from 'react';
import DisconnectedPage from './DisconnectedPage';

interface ServerMonitorProps {
    children: React.ReactNode;
    statusMsg: string;
}

const ServerMonitor: React.FC<ServerMonitorProps> = ({ children, statusMsg }) => {
    // 根據 Socket.IO 的狀態訊息判斷是否斷線
    const isDisconnected = statusMsg.includes('Disconnected') || 
                          statusMsg.includes('Connection Error') ||
                          statusMsg.includes('Failed to connect');

    if (isDisconnected) {
        return <DisconnectedPage statusMsg={statusMsg} />;
    }

    return <>{children}</>;
};

export default ServerMonitor;
