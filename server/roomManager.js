
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
        this.userNames = new Map(); // Persist Names: userId -> name
        this.cleanupTimers = new Map(); // roomId -> Timeout

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

    checkRoomCleanup(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        // If no connected humans, start timer
        const connectedHumans = room.players.filter(p => !p.isBot && p.connected).length;
        if (connectedHumans === 0 && room.players.length > 0) {
            if (!this.cleanupTimers.has(roomId)) {
                console.log(`[ROOM] ${roomId} is empty/disconnected. Starting 60s Cleanup Timer.`);
                const timer = setTimeout(() => {
                    console.log(`[ROOM] ${roomId} Cleanup Timer Fired. Resetting Room.`);
                    this.rooms.set(roomId, JSON.parse(JSON.stringify(INITIAL_GAME_STATE)));
                    this.cleanupTimers.delete(roomId);
                    // Emit update? Server loop handles state updates usually.
                }, 10000);
                this.cleanupTimers.set(roomId, timer);
            }
        } else {
            // Cancel timer if activity detected
            if (this.cleanupTimers.has(roomId)) {
                console.log(`[ROOM] ${roomId} activity detected. Cancelling Cleanup Timer.`);
                clearTimeout(this.cleanupTimers.get(roomId));
                this.cleanupTimers.delete(roomId);
            }
        }
    }

    addPlayer(roomId, player) {
        // Stop Cleanup Timer if active
        if (this.cleanupTimers.has(roomId)) {
            console.log(`[ROOM] ${roomId} activity (join). Cancelling Cleanup Timer.`);
            clearTimeout(this.cleanupTimers.get(roomId));
            this.cleanupTimers.delete(roomId);
        }

        const room = this.rooms.get(roomId);
        if (!room) return { success: false, error: 'Room not found' };

        // Name Persistence Logic
        let finalName = player.name;
        const storedName = this.userNames.get(String(player.userId));

        if (player.name && player.name !== 'Player') {
            // User provided a specific name, update storage
            this.userNames.set(String(player.userId), player.name);
        } else if (storedName) {
            // User provided default/empty, use stored
            finalName = storedName;
        }

        console.log(`[ROOM] addPlayer to ${roomId}: ID='${player.userId}' Name='${finalName}' Socket=${player.socketId}`);

        // Check for Reconnection
        const existingPlayer = room.players.find(p => String(p.id) === String(player.userId));
        if (existingPlayer) {
            console.log(`[ROOM] Reconnecting ${existingPlayer.name}.`);
            existingPlayer.socketId = player.socketId;
            existingPlayer.connected = true;
            existingPlayer.name = finalName; // Update name on reconnect too

            // Per User Rule: Reconnection switch to 'Unready'
            room.readyPlayers = room.readyPlayers.filter(pos => pos !== existingPlayer.position);

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
            name: finalName,
            position: available,
            isHost: (room.players.length === 0),
            isBot: player.isBot || false,
            connected: true
        };

        // Bot Auto-Ready
        if (newPlayer.isBot) {
            room.readyPlayers.push(available);
        }

        room.players.push(newPlayer);
        return { success: true, room };
    }

    handleDisconnect(socketId) {
        for (const [roomId, room] of this.rooms) {
            const player = room.players.find(p => p.socketId === socketId);
            if (player) {
                player.connected = false;
                // Check Cleanup Trigger
                this.checkRoomCleanup(roomId);
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
            // Clear timer if exists (already reset)
            if (this.cleanupTimers.has(roomId)) {
                clearTimeout(this.cleanupTimers.get(roomId));
                this.cleanupTimers.delete(roomId);
            }
        } else {
            // Check if remaining players are all disconnected/bots (?)
            this.checkRoomCleanup(roomId);
        }

        return room;
    }
}

export default new RoomManager();
