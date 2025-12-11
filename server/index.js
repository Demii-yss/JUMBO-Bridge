
import express from 'express';
import { createServer } from 'http';
import { Server } from "socket.io";
import roomManager from './roomManager.js';

const app = express();
const server = createServer(app);

// CORS 配置：允許本地開發和 GitHub Pages
const allowedOrigins = [
    "http://localhost:3001",              // 本地開發
    "http://localhost:3000",              // 本地開發（備用）
    /^https:\/\/.*\.github\.io$/,         // 所有 GitHub Pages
];

// 如果在開發環境，允許所有來源
if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push("*");
}

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type"]
    },
    // 確保支持所有傳輸方式
    transports: ['polling', 'websocket'],
    // 增加連接超時
    pingTimeout: 60000,
    pingInterval: 25000,
    // 允許升級
    allowUpgrades: true,
    // 路徑配置
    path: '/socket.io/'
});

// 2. Session Management (Single Session & Reconnect)
const userSessions = new Map(); // Global Map<userId, socketId>

io.on('connection', (socket) => {
    console.log(`[CONNECT] User connected: ${socket.id}, Transport: ${socket.conn.transport.name}`);

    // 1. Lobby Stats Probe
    socket.on('QUERY_LOBBY_STATS', () => {
        const stats = {};
        for (let i = 1; i <= 5; i++) {
            const roomId = `JUMBO-BRIDGE-ROOM-${i}`;
            const room = roomManager.getRoom(roomId);
            stats[roomId] = room ? room.players.length : 0;
        }
        socket.emit('LOBBY_STATS', stats);
    });

    socket.on('REGISTER_SESSION', ({ userId }) => {
        console.log(`[SESSION] Register request: ${userId} (Socket: ${socket.id})`);
        // A. Conflict Resolution (Kick old session)
        if (userSessions.has(userId)) {
            const oldSocketId = userSessions.get(userId);
            if (oldSocketId !== socket.id) {
                console.log(`[SESSION] Kicking old socket ${oldSocketId} for user ${userId}`);
                const oldSocket = io.sockets.sockets.get(oldSocketId);
                if (oldSocket) {
                    oldSocket.emit('FORCE_LOGOUT', { reason: 'Logged in from another location' });
                    oldSocket.disconnect(true); // Close underlying connection
                }
            }
        }

        // B. Register New Session
        userSessions.set(userId, socket.id);

        // C. Check for Existing Game (Reconnect)
        const roomId = roomManager.findRoomByUser(userId);
        if (roomId) {
            socket.emit('SESSION_FOUND', { roomId: roomId.replace('JUMBO-BRIDGE-ROOM-', '') });
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ User disconnected:', socket.id);
        console.log('   Reason:', reason);
        console.log('   Transport was:', socket.conn.transport.name);
        
        // Clean up userSessions map
        for (const [uid, sid] of userSessions.entries()) {
            if (sid === socket.id) {
                console.log('   User ID:', uid);
                userSessions.delete(uid);
                break;
            }
        }
        const result = roomManager.handleDisconnect(socket.id);
        if (result) {
            io.to(result.roomId).emit('STATE_UPDATE', { state: result.room });
        }
    });

    // 監聽連接錯誤
    socket.on('error', (error) => {
        console.error('⚠️ Socket error:', socket.id, error);
    });

    // 監聽傳輸升級
    socket.conn.on('upgrade', (transport) => {
        console.log('🔄 Transport upgraded to:', transport.name, 'for', socket.id);
    });

    // 3. Join Room
    socket.on('JOIN_REQUEST', ({ roomId, name, userId }) => {
        console.log(`[JOIN_REQUEST] Raw: roomId=${roomId}, userId='${userId}', name='${name}'`);
        // Enforce 1 Room per User
        const safeUserId = userId || socket.id;

        // Check if user is in ANY other room and remove/leave them?
        for (const [rid, room] of roomManager.rooms) {
            if (rid !== roomId && room.players.some(p => p.id === safeUserId)) {
                const updatedOldRoom = roomManager.removePlayer(rid, safeUserId);
                io.to(rid).emit('STATE_UPDATE', { state: updatedOldRoom });
                socket.leave(rid);
            }
        }

        const player = { socketId: socket.id, userId: safeUserId, name };
        const result = roomManager.addPlayer(roomId, player);
        console.log(`[JOIN] ${safeUserId} -> ${roomId}: Success=${result.success} Error=${result.error}`);

        if (result.success) {
            socket.join(roomId);

            const addedPlayer = result.room.players.find(p => p.id === safeUserId);
            if (!addedPlayer) {
                console.error("CRITICAL: Player added but not found in room state!");
                socket.emit('JOIN_REJECT', { reason: "Internal Server Error: Player State Lost" });
                return;
            }

            socket.emit('JOIN_ACCEPT', {
                state: result.room,
                yourPosition: addedPlayer.position
            });

            io.to(roomId).emit('STATE_UPDATE', { state: result.room });
        } else {
            console.log(`[JOIN REJECT] ${result.error}`);
            socket.emit('JOIN_REJECT', { reason: result.error });
        }
    });

    socket.on('STATE_UPDATE', ({ roomId, state }) => {
        roomManager.updateRoom(roomId, state);
        socket.to(roomId).emit('STATE_UPDATE', { state });
    });

    // Generic Action Relay (Chat, Emotes)
    socket.on('ACTION_RELAY', ({ roomId, action }) => {
        socket.to(roomId).emit('ACTION_RELAY', action);
    });

    socket.on('LEAVE_ROOM', ({ userId }) => {
        for (const [rid, room] of roomManager.rooms) {
            if (room.players.some(p => p.id === userId)) {
                const updatedRoom = roomManager.removePlayer(rid, userId);
                socket.leave(rid);
                io.to(rid).emit('STATE_UPDATE', { state: updatedRoom });
                break;
            }
        }
    });

});

// 支持環境變數配置端口（用於雲端部署）
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
