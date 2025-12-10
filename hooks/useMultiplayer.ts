import React, { useState, useRef, useEffect, MutableRefObject, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { NetworkMessage, PlayerPosition, GameState, GamePhase, Bid, Card, InteractionType, PlayerProfile, NetworkActionType } from '../types';
import { TEXT } from '../constants';
import { processBidLogic, processPlayLogic, processReadyLogic, processSurrender } from '../services/gameStateReducers';

interface UseMultiplayerProps {
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    gameStateRef: MutableRefObject<GameState>;
    myPosition: PlayerPosition | null;
    setMyPosition: React.Dispatch<React.SetStateAction<PlayerPosition | null>>;
    playerName: string;
    startNewDeal: (isReplay?: boolean) => void;
    triggerEmote: (pos: PlayerPosition, emoji: string) => void;
    triggerInteraction: (type: InteractionType, from: PlayerPosition, to: PlayerPosition) => void;
    addLog: (msg: string) => void;
    setSystemMessage: (msg: string) => void;
    handleRedealRequest: (data: { position: PlayerPosition; points?: number }, broadcast: (msg: string) => void) => void;
}

export const useMultiplayer = ({
    gameState,
    setGameState,
    gameStateRef,
    myPosition,
    setMyPosition,
    playerName,
    startNewDeal,
    triggerEmote,
    triggerInteraction,
    addLog,
    setSystemMessage,
    handleRedealRequest,
    userId // Received from App (Input ID)
}: UseMultiplayerProps & { userId: string }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [statusMsg, setStatusMsg] = useState<string>('');
    const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});

    // Track current room for logic
    const currentRoomId = useRef<string | null>(null);

    const isHost = gameState.players.find(p => p.id === userId)?.isHost || false;

    // --- Init Socket ---
    useEffect(() => {
        const newSocket = io('http://localhost:3000'); // Connect to local server
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Socket Connected:', newSocket.id);
            setStatusMsg('Connected to Server');
            // If we have ID already (re-mount?), register.
            if (userId) {
                newSocket.emit('REGISTER_SESSION', { userId });
            }
        });

        newSocket.on('FORCE_LOGOUT', (data: { reason: string }) => {
            console.warn('Force Logout:', data.reason);
            setStatusMsg(`Disconnected: ${data.reason}`);
            alert(`You have been logged out: ${data.reason}`);
            window.location.reload(); // Force return to login screen
        });

        newSocket.on('SESSION_FOUND', (data: { roomId: string }) => {
            console.log("Found existing session in Room", data.roomId);
            setStatusMsg("Rejoining Room...");
            // Auto Join
            // We need to call joinRoom, but it requires 'socket' which is 'newSocket' here
            // We can't use 'socket' state yet.
            // So we emit directly.
            const targetRoomId = `JUMBO-BRIDGE-ROOM-${data.roomId}`;
            currentRoomId.current = targetRoomId;
            newSocket.emit('JOIN_REQUEST', { roomId: targetRoomId, name: playerName, userId });
        });

        newSocket.on('disconnect', () => {
            console.log('Socket Disconnected');
            setStatusMsg('Disconnected from Server');
        });

        // --- Global Listeners ---
        newSocket.on('LOBBY_STATS', (stats: Record<string, number>) => {
            setRoomCounts(stats);
        });

        newSocket.on('JOIN_ACCEPT', (data: { state: GameState, yourPosition: PlayerPosition }) => {
            console.log('Joined Room!', data);
            setGameState(data.state);
            setMyPosition(data.yourPosition);
            setStatusMsg("");
        });

        newSocket.on('JOIN_REJECT', (data: { reason: string }) => {
            setStatusMsg(data.reason);
        });

        newSocket.on('STATE_UPDATE', (data: { state: GameState }) => {
            console.log('Received State Update', data.state);
            setGameState(data.state);
        });

        newSocket.on('ACTION_RELAY', (action: NetworkMessage) => {
            handleIncomingAction(action);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Register Session when User ID is set (Login)
    useEffect(() => {
        if (socket && userId) {
            console.log("Registering Session for:", userId);
            socket.emit('REGISTER_SESSION', { userId });
        }
    }, [socket, userId]);

    // --- Lobby Logic ---
    const checkLobbyStats = () => {
        if (socket) {
            socket.emit('QUERY_LOBBY_STATS');
        }
    };

    // --- Room Logic ---
    const joinRoom = async (roomNumber: string) => {
        if (!socket) return;

        const targetRoomId = `JUMBO-BRIDGE-ROOM-${roomNumber}`;
        currentRoomId.current = targetRoomId;

        setStatusMsg("Entering Room...");
        socket.emit('JOIN_REQUEST', { roomId: targetRoomId, name: playerName, userId });
    };

    const leaveRoom = () => {
        if (socket) {
            socket.emit('LEAVE_ROOM', { userId });
            currentRoomId.current = null;
            // No reload. App.tsx handles view reset.
        }
    };

    // --- Message Handling ---
    const handleIncomingAction = (action: NetworkMessage) => {
        if (action.type === NetworkActionType.EMOTE) {
            triggerEmote(action.position, action.emoji);
        } else if (action.type === NetworkActionType.INTERACTION) {
            triggerInteraction(action.interactionType, action.from, action.to);
        } else if (action.type === NetworkActionType.MESSAGE) {
            setSystemMessage(action.message);
        }
    };


    // --- Host Logic (Client Side Reducer) ---
    const sendAction = (action: NetworkMessage) => {
        if (!socket) return;
        const roomId = currentRoomId.current;
        if (!roomId) return;

        // Special: Chat/Emotes don't change Game State usually (visual only)
        // But we broadcast them.
        if (action.type === NetworkActionType.EMOTE ||
            action.type === NetworkActionType.INTERACTION ||
            action.type === NetworkActionType.MESSAGE) {

            socket.emit('ACTION_RELAY', { roomId, action });
            // Show locally
            handleIncomingAction(action);
            return;
        }

        if (isHost) {
            // I am Host. I process logic immediately.
            let newState = { ...gameState };

            if (action.type === NetworkActionType.BID) newState = processBidLogic(newState, action.bid);
            else if (action.type === NetworkActionType.DEAL) startNewDeal(false); // This resets state, care.
            else if (action.type === NetworkActionType.RESTART) startNewDeal(true);
            else if (action.type === NetworkActionType.READY) newState = processReadyLogic(newState, action.position);
            else if (action.type === NetworkActionType.PLAY) newState = processPlayLogic(newState, action.card, action.position);
            else if (action.type === NetworkActionType.SURRENDER) newState = processSurrender(newState, action.position);

            // Note: startNewDeal updates state via its own hook usually?
            // If reducers return new state:
            setGameState(newState);
            // Broadcast
            socket.emit('STATE_UPDATE', { roomId, state: newState });
        } else {
            // I am Client. I send Action to Host via Relay.
            socket.emit('ACTION_RELAY', { roomId, action });
        }
    };

    // Need to listen for Actions if I am Host
    useEffect(() => {
        if (!socket) return;

        const onActionRelay = (action: NetworkMessage) => {
            if (isHost) {
                // I am Host, I must process this action from someone else
                console.log("Host processing action:", action);

                let newState = { ...gameStateRef.current }; // Use Ref for latest state

                if (action.type === NetworkActionType.BID) newState = processBidLogic(newState, action.bid);
                else if (action.type === NetworkActionType.READY) newState = processReadyLogic(newState, action.position);
                else if (action.type === NetworkActionType.PLAY) newState = processPlayLogic(newState, action.card, action.position);
                else if (action.type === NetworkActionType.SURRENDER) newState = processSurrender(newState, action.position);
                else if (action.type === NetworkActionType.REQUEST_REDEAL) {
                    // Handle Redeal
                    handleRedealRequest({ position: action.position, points: action.points }, (msg) => {
                        const m = { type: NetworkActionType.MESSAGE, message: msg };
                        socket.emit('ACTION_RELAY', { roomId: currentRoomId.current, action: m });
                        setSystemMessage(msg);
                    });
                    return;
                }

                setGameState(newState);
                socket.emit('STATE_UPDATE', { roomId: currentRoomId.current, state: newState });
            } else {
                // I am client, I just see it (Emotes handled above).
                handleIncomingAction(action);
            }
        };

        socket.on('ACTION_RELAY', onActionRelay);

        return () => {
            socket.off('ACTION_RELAY', onActionRelay);
        }
    }, [socket, isHost]); // Re-bind when isHost changes


    // --- Host Controls ---
    const addBot = (slot: PlayerPosition) => {
        if (!isHost) return;

        setGameState(prev => {
            if (prev.players.some(p => p.position === slot)) return prev;
            const botId = `BOT-${slot}-${Date.now()}`;
            const newBot: PlayerProfile = {
                id: botId,
                name: `${TEXT[slot]} (BOT)`,
                position: slot,
                isHost: false,
                isBot: true
            };
            const newPlayers = [...prev.players, newBot];
            const newState = { ...prev, players: newPlayers };

            socket?.emit('STATE_UPDATE', { roomId: currentRoomId.current, state: newState });

            return newState;
        });
    };

    const removeBot = (slot: PlayerPosition) => {
        if (!isHost) return;
        setGameState(prev => {
            const newPlayers = prev.players.filter(p => p.position !== slot);
            const newState = { ...prev, players: newPlayers };
            socket?.emit('STATE_UPDATE', { roomId: currentRoomId.current, state: newState });
            return newState;
        });
    };

    const copyRoomId = (id: string) => {
        navigator.clipboard.writeText(id);
    };

    return {
        myPeerId: socket?.id || '',
        hostPeerId: 'SERVER',
        setHostPeerId: () => { },
        statusMsg,
        copyFeedback: '',
        connectToHost: () => { }, // unused
        copyRoomId,
        sendAction,
        addBot,
        removeBot,
        joinRoom,
        leaveRoom,
        checkLobbyStats,
        roomCounts
    };
};
