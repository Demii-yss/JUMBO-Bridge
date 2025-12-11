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
    generateNewDealState: (state: GameState, isReplay: boolean) => GameState; // Added property
    setPlayerName: (name: string) => void;
}

export const useMultiplayer = ({
    gameState,
    setGameState,
    gameStateRef,
    myPosition,
    setMyPosition,
    playerName,
    setPlayerName,
    startNewDeal,
    triggerEmote,
    triggerInteraction,
    addLog,
    setSystemMessage,
    handleRedealRequest,
    generateNewDealState, // Destructure here
    userId // Received from App (Input ID)
}: UseMultiplayerProps & { userId: string }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [statusMsg, setStatusMsg] = useState<string>('');
    const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});

    // Track current room for logic
    const currentRoomId = useRef<string | null>(null);
    const userIdRef = useRef(userId);
    const socketInitialized = useRef(false); // 防止重複初始化

    // Update ref when prop changes
    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    const isHost = gameState.players.find(p => p.id === userId)?.isHost || false;

    // --- Init Socket ---
    useEffect(() => {
        // 防止 React Strict Mode 重複執行
        if (socketInitialized.current) {
            console.log('⚠️ Socket already initialized, skipping...');
            return;
        }
        
        // 根據環境自動選擇伺服器地址
        // 開發環境：localhost:3000
        // 生產環境：需要部署後端伺服器並設定 VITE_SERVER_URL
        let serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
        
        // 確保 URL 包含協議，防止被解析為相對路徑
        if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
            serverUrl = 'https://' + serverUrl;
        }
        
        // 解析 URL 以確保格式正確
        try {
            const url = new URL(serverUrl);
            serverUrl = url.origin; // 只使用 origin (protocol + host + port)
        } catch (e) {
            console.error('Invalid server URL:', serverUrl);
        }
        
        console.log('=== Socket.IO Configuration ===');
        console.log('Server URL:', serverUrl);
        console.log('URL is absolute:', serverUrl.startsWith('http'));
        console.log('================================');
        
        const newSocket = io(serverUrl, {
            // 只使用 websocket，不降級到 polling
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            timeout: 45000,
            withCredentials: false,
            closeOnBeforeunload: false,
            forceNew: true
        });
        
        socketInitialized.current = true;
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('✅ Socket Connected:', newSocket.id);
            console.log('   Transport:', newSocket.io.engine.transport.name);
            setStatusMsg('Connected to Server');
            // If we have ID already (re-mount?), register.
            if (userIdRef.current) {
                newSocket.emit('REGISTER_SESSION', { userId: userIdRef.current });
            }
        });

        newSocket.on('FORCE_LOGOUT', (data: { reason: string }) => {
            console.warn('Force Logout:', data.reason);
            setStatusMsg(`Disconnected: ${data.reason}`);
            alert(`You have been logged out: ${data.reason}`);
            window.location.reload(); // Force return to login screen
        });

        newSocket.on('SESSION_FOUND', (data: { roomId: string }) => {
            console.log("Session Found! Rejoining:", data.roomId);
            const targetRoomId = `JUMBO-BRIDGE-ROOM-${data.roomId}`;
            currentRoomId.current = targetRoomId;

            // Bypass joinRoom to avoid stale closure issues (initial joinRoom has socket=null)
            if (userIdRef.current) {
                console.log(`[CLIENT] Auto-Rejoining ${targetRoomId} with UserID: ${userIdRef.current}`);
                newSocket.emit('JOIN_REQUEST', {
                    roomId: targetRoomId,
                    name: playerName, // Might be stale, but acceptable for reconnect 
                    userId: userIdRef.current
                });
                setStatusMsg("Rejoining Session...");
            } else {
                console.error("Critical: Session found but no User ID ref!");
            }
        });

        newSocket.on('disconnect', (reason) => {
            console.log('❌ Socket Disconnected');
            console.log('   Reason:', reason);
            setStatusMsg('Disconnected from Server');
        });

        // 監聽連接錯誤
        newSocket.on('connect_error', (error) => {
            console.error('⚠️ Connection Error:', error.message);
            setStatusMsg('Connection Error: ' + error.message);
        });

        // 監聽傳輸升級
        newSocket.io.engine.on('upgrade', (transport) => {
            console.log('🔄 Transport upgraded to:', transport.name);
        });
        
        // 監聽 transport 錯誤
        newSocket.io.engine.on('error', (error) => {
            console.error('❌ Transport Error:', error);
        });
        
        // 監聽 transport 關閉
        newSocket.io.engine.on('close', (reason) => {
            console.log('🔌 Transport Closed:', reason);
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

            // Sync persistent name from server
            const myProfile = data.state.players.find(p => p.position === data.yourPosition);
            if (myProfile && myProfile.name && myProfile.name !== playerName) {
                console.log("[CLIENT] Syncing persistent name:", myProfile.name);
                setPlayerName(myProfile.name);
            }
        });

        newSocket.on('JOIN_REJECT', (data: { reason: string }) => {
            console.error('Join Rejected:', data.reason);
            alert(data.reason);
            setStatusMsg(`Error: ${data.reason}`);
            currentRoomId.current = null;
        });

        newSocket.on('STATE_UPDATE', (data: { state: GameState }) => {
            console.log('Received State Update', data.state);
            setGameState(data.state);
        });

        newSocket.on('ACTION_RELAY', (action: NetworkMessage) => {
            handleIncomingAction(action);
        });

        return () => {
            console.log('🧹 Cleaning up socket connection...');
            if (newSocket && newSocket.connected) {
                newSocket.removeAllListeners();
                newSocket.disconnect();
                newSocket.close();
            }
            socketInitialized.current = false;
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
    const joinRoom = useCallback(async (roomNumber: string) => {
        if (!socket) return;

        const currentUserId = userIdRef.current; // Use Ref

        if (!currentUserId) {
            console.error("CRITICAL: joinRoom called without valid userId!");
            // This might happen if auto-join triggers too early?
            // But SESSION_FOUND implies we registered.
            // If we registered, userId MUST be set.
            // But let's be safe.
            return;
        }

        const targetRoomId = `JUMBO-BRIDGE-ROOM-${roomNumber}`;
        currentRoomId.current = targetRoomId;

        setStatusMsg("Entering Room...");
        console.log(`[CLIENT] Joining Room ${targetRoomId} with UserID: ${currentUserId}`);
        socket.emit('JOIN_REQUEST', { roomId: targetRoomId, name: playerName, userId: currentUserId });
    }, [socket, playerName]); // playerName is a prop, userIdRef.current is stable

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
            else if (action.type === NetworkActionType.DEAL) {
                // Generate state directly
                newState = generateNewDealState(newState, false);
                // Note: The auto-transition to Reviewing needs to be managed?
                // `startNewDeal` did setTimeout -> Reviewing.
                // We should emulate that here or broadcast the Reviewing transition later?
                // If we set state to "Dealing", UI shows animation.
                // We need to set a timeout to switch to Reviewing and BROADCAST.
                setTimeout(() => {
                    if (isHost && socket) { // Re-check host status
                        // We need the LATEST state to avoid overwriting invalid logic?
                        // Actually, we can just emit a Partial update? 
                        // Or just follow `startNewDeal` pattern: Set Local -> Broadcast.
                        // But we are in `sendAction`.

                        // Fix: Emit 'DEALING' state now.
                        // Then emit 'REVIEWING' state after 1s.
                        const reviewingState = { ...newState, phase: GamePhase.Reviewing };
                        setGameState(reviewingState);
                        socket.emit('STATE_UPDATE', { roomId: currentRoomId.current, state: reviewingState });
                    }
                }, 1000);
            }
            else if (action.type === NetworkActionType.RESTART) {
                newState = generateNewDealState(newState, true);
                // Same timeout logic as above
                setTimeout(() => {
                    if (isHost && socket) {
                        const reviewingState = { ...newState, phase: GamePhase.Reviewing };
                        setGameState(reviewingState);
                        socket.emit('STATE_UPDATE', { roomId: currentRoomId.current, state: reviewingState });
                    }
                }, 1000);
            }
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
                isBot: true // Flag
            };
            const newPlayers = [...prev.players, newBot];
            // Bot Auto-Ready
            const newReady = [...prev.readyPlayers, slot]; // Add Bot to Ready
            const newState = { ...prev, players: newPlayers, readyPlayers: newReady };

            socket?.emit('STATE_UPDATE', { roomId: currentRoomId.current, state: newState });

            return newState;
        });
    };

    const removeBot = (slot: PlayerPosition) => {
        if (!isHost) return;
        setGameState(prev => {
            const newPlayers = prev.players.filter(p => p.position !== slot);
            // Bot Cleanup Ready
            const newReady = prev.readyPlayers.filter(p => p !== slot);
            const newState = { ...prev, players: newPlayers, readyPlayers: newReady };
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
