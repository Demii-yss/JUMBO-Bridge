
const INITIAL_GAME_STATE = {
    // Basic Phase Info
    phase: 'Lobby',
    players: [],
    readyPlayers: [],

    // Hands & Dealer
    hands: {
        'North': [],
        'East': [],
        'South': [],
        'West': []
    },
    dealer: 'North',
    turn: 'North',

    // Bidding
    vulnerability: { ns: false, ew: false },
    bidHistory: [],
    lastBid: null,
    contract: null,
    declarer: null,

    // Play
    currentTrick: [],
    tricksWon: {
        'North': 0,
        'East': 0,
        'South': 0,
        'West': 0
    },
    playHistory: [],

    // End Game
    winningTeam: undefined,
    surrendered: false
};

class RoomManager {
    constructor() {
        this.rooms = new Map();
        // Initialize 5 Persistent Rooms
        for (let i = 1; i <= 5; i++) {
            const roomId = `JUMBO-BRIDGE-ROOM-${i}`;
            this.rooms.set(roomId, JSON.parse(JSON.stringify(INITIAL_GAME_STATE)));
        }
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    updateRoom(roomId, newState) {
        if (this.rooms.has(roomId)) {
            this.rooms.set(roomId, newState);
        }
    }

    findRoomByUser(userId) {
        for (const [roomId, room] of this.rooms) {
            if (room.players.some(p => String(p.id) === String(userId))) {
                return roomId;
            }
        }
        return null;
    }

    addPlayer(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room) return { success: false, error: 'Room not found' };

        console.log(`[ROOM] addPlayer to ${roomId}: ID='${player.userId}' (Type: ${typeof player.userId}) Socket=${player.socketId}`);
        console.log(`[ROOM] Current Players: ${JSON.stringify(room.players.map(p => ({ id: p.id, type: typeof p.id, name: p.name })))}`);

        // Check for Reconnection
        const existingPlayer = room.players.find(p => String(p.id) === String(player.userId));
        if (existingPlayer) {
            console.log(`[ROOM] Found existing player ${existingPlayer.name} (${existingPlayer.id}). Reconnecting.`);
            existingPlayer.socketId = player.socketId;
            existingPlayer.connected = true;
            return { success: true, room, reconnect: true };
        }

        if (room.players.length >= 4) {
            return { success: false, error: 'Room Full' };
        }

        const occupied = room.players.map(p => p.position);
        const all = ['North', 'East', 'South', 'West'];
        const available = all.find(p => !occupied.includes(p));

        if (!available) return { success: false, error: 'No slots available' };

        const newPlayer = {
            id: player.userId,
            socketId: player.socketId,
            name: player.name,
            position: available,
            isHost: (room.players.length === 0),
            isBot: false,
            connected: true
        };

        room.players.push(newPlayer);
        return { success: true, room };
    }

    handleDisconnect(socketId) {
        for (const [roomId, room] of this.rooms) {
            const player = room.players.find(p => p.socketId === socketId);
            if (player) {
                player.connected = false;
                return { roomId, room };
            }
        }
        return null;
    }

    removePlayer(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const wasHost = room.players.find(p => p.id === userId)?.isHost;
        room.players = room.players.filter(p => p.id !== userId);

        if (wasHost && room.players.length > 0) {
            // Prioritize Connected Humans > Humans > Bots (Any)
            const nextHost =
                room.players.find(p => !p.isBot && p.connected) ||
                room.players.find(p => !p.isBot) ||
                room.players[0];

            if (nextHost) {
                nextHost.isHost = true;
            }
        }

        if (room.players.length === 0) {
            this.rooms.set(roomId, JSON.parse(JSON.stringify(INITIAL_GAME_STATE)));
        }

        return room;
    }
}

export default new RoomManager();
