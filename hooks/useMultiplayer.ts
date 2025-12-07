import React, { useState, useRef, useEffect, MutableRefObject } from 'react';
import { NetworkMessage, PlayerPosition, GameState, GamePhase, Bid, Card, InteractionType, PlayerProfile, NetworkActionType } from '../types';
import { TEXT } from '../constants';
import { processBidLogic, processPlayLogic, processReadyLogic, processSurrender } from '../services/gameStateReducers';

// Declare PeerJS globally
declare const Peer: any;

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
    // New props for decoupled logic
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
    handleRedealRequest
}: UseMultiplayerProps) => {
    const [myPeerId, setMyPeerId] = useState<string>('');
    const [hostPeerId, setHostPeerId] = useState<string>('');
    const [statusMsg, setStatusMsg] = useState<string>('');
    const [copyFeedback, setCopyFeedback] = useState<string>('');

    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);
    const clientsRef = useRef<any[]>([]);

    const isHost = myPosition === PlayerPosition.North;

    // --- Networking Setup ---

    const initPeer = () => {
        if (peerRef.current) return;
        addLog("Init PeerJS...");

        // Generate 5-digit ID (10000-99999)
        const myId = Math.floor(10000 + Math.random() * 90000).toString();

        const peer = new Peer(myId, {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        peer.on('open', (id: string) => {
            console.log("Peer Open:", id);
            addLog(`Peer Open: ${id}`);
            setMyPeerId(id);
            setStatusMsg("Connected to Server");
        });

        peer.on('disconnected', () => {
            console.log("Peer Disconnected");
            setStatusMsg("Disconnected from Server");
        });

        peer.on('close', () => {
            setStatusMsg("Connection Closed");
        });

        peer.on('connection', (conn: any) => {
            conn.on('data', (data: NetworkMessage) => {
                handleHostReceivedDataRef.current(data, conn);
            });
            conn.on('open', () => {
                clientsRef.current.push(conn);
            });
            conn.on('close', () => {
                clientsRef.current = clientsRef.current.filter(c => c !== conn);
            });
        });

        peer.on('error', (err: any) => {
            console.error("Peer Error:", err);
            addLog(`Error: ${err.type}`);
            setStatusMsg(`Connection Error: ${err.type}`);
        });

        peerRef.current = peer;
    };

    useEffect(() => {
        initPeer();
        return () => {
            if (peerRef.current) {
                peerRef.current.removeAllListeners();
                peerRef.current.destroy();
                peerRef.current = null;
            }
        };
    }, []);

    // --- Helper ---
    const copyRoomId = async (id: string) => {
        if (!id) return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(id);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = id;
                textArea.style.position = "absolute";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopyFeedback(TEXT.COPIED);
            setTimeout(() => setCopyFeedback(''), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };


    // --- Host Logic ---

    const handleHostReceivedDataRef = useRef<(data: NetworkMessage, conn: any) => void>(() => { });

    const handleHostReceivedData = (data: NetworkMessage, conn: any) => {
        if (data.type === NetworkActionType.EMOTE) {
            broadcastMessage(data);
            triggerEmote(data.position, data.emoji);
            return;
        }
        if (data.type === NetworkActionType.INTERACTION) {
            broadcastMessage(data);
            triggerInteraction(data.interactionType, data.from, data.to);
            return;
        }
        if (data.type === NetworkActionType.MESSAGE) {
            broadcastMessage(data);
            setSystemMessage(data.message);
            return;
        }
        if (data.type === NetworkActionType.REQUEST_REDEAL) {
            handleRedealRequest(
                { position: data.position, points: data.points },
                (msgContent) => {
                    if (msgContent) {
                        setSystemMessage(msgContent);
                        broadcastMessage({ type: NetworkActionType.MESSAGE, message: msgContent });
                    } else {
                        setSystemMessage('');
                        broadcastMessage({ type: NetworkActionType.MESSAGE, message: '' });
                    }
                }
            );
            return;
        }

        if (data.type === NetworkActionType.JOIN_REQUEST) {
            // Use Ref to get current state
            const prev = gameStateRef.current || gameState;

            if (prev.players.length >= 4) return;
            // Check if player arguably already joined? 
            if (prev.players.some(p => p.id === conn.peer)) return;

            const occupiedPositions = prev.players.map(p => p.position);
            const reserved = (prev.phase === GamePhase.Lobby && !occupiedPositions.includes(PlayerPosition.North))
                ? [PlayerPosition.North]
                : [];

            const allPositions = [PlayerPosition.North, PlayerPosition.East, PlayerPosition.South, PlayerPosition.West];
            const available = allPositions.filter(p => !occupiedPositions.includes(p) && !reserved.includes(p));
            const nextPosition = available[0];

            if (!nextPosition) return;

            const newPlayer: PlayerProfile = {
                id: conn.peer,
                name: data.name,
                position: nextPosition,
                isHost: false
            };

            const newPlayers = [...prev.players, newPlayer];
            const newState = { ...prev, players: newPlayers };

            setGameState(newState);
            conn.send({ type: NetworkActionType.JOIN_ACCEPT, state: newState, yourPosition: nextPosition });
            broadcastState(newState, conn.peer);
            return;
        }

        setGameState(prev => {
            if (data.type === NetworkActionType.BID) return processBidLogic(prev, data.bid);
            if (data.type === NetworkActionType.READY) return processReadyLogic(prev, data.position);
            if (data.type === NetworkActionType.PLAY) return processPlayLogic(prev, data.card, data.position);
            if (data.type === NetworkActionType.SURRENDER) return processSurrender(prev, data.position);
            if (data.type === NetworkActionType.RESTART) { return prev; }

            return prev;
        });
    };

    useEffect(() => {
        handleHostReceivedDataRef.current = handleHostReceivedData;
    });

    const broadcastState = (state: GameState, excludeId?: string) => {
        clientsRef.current.forEach(conn => {
            if (conn.open && conn.peer !== excludeId) {
                conn.send({ type: NetworkActionType.STATE_UPDATE, state });
            }
        });
    };

    const broadcastMessage = (msg: NetworkMessage, excludeId?: string) => {
        clientsRef.current.forEach(conn => {
            if (conn.open && conn.peer !== excludeId) {
                conn.send(msg);
            }
        });
    };

    useEffect(() => {
        if (isHost) {
            broadcastState(gameState);
        }
    }, [gameState, isHost]);

    // --- Host: Add Bot Logic ---
    const addBot = (slot: PlayerPosition) => {
        if (!isHost) return;
        setGameState(prev => {
            if (prev.players.some(p => p.position === slot)) return prev;

            // Create unique ID for bot
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

            return newState;
        });
    };


    // --- Client Logic ---

    const handleClientDataRef = useRef<(data: NetworkMessage) => void>(() => { });

    useEffect(() => {
        handleClientDataRef.current = (data: NetworkMessage) => {
            if (data.type === NetworkActionType.JOIN_ACCEPT) {
                setGameState(data.state);
                setMyPosition(data.yourPosition);
                setStatusMsg("");
            } else if (data.type === NetworkActionType.STATE_UPDATE) {
                setGameState(data.state);
            } else if (data.type === NetworkActionType.EMOTE) {
                triggerEmote(data.position, data.emoji);
            } else if (data.type === NetworkActionType.INTERACTION) {
                triggerInteraction(data.interactionType, data.from, data.to);
            } else if (data.type === NetworkActionType.MESSAGE) {
                setSystemMessage(data.message);
            }
        };
    });

    const connectToHost = (hostId: string) => {
        if (!peerRef.current) return;
        setStatusMsg(TEXT.CONNECTING);

        const conn = peerRef.current.connect(hostId);

        conn.on('open', () => {
            setStatusMsg(TEXT.CONNECTED);
            conn.send({ type: NetworkActionType.JOIN_REQUEST, name: playerName });
        });

        conn.on('data', (data: NetworkMessage) => {
            handleClientDataRef.current(data);
        });

        connRef.current = conn;
    };

    const sendAction = (action: NetworkMessage) => {
        if (isHost) {
            if (action.type === NetworkActionType.EMOTE) {
                broadcastMessage(action);
                triggerEmote(action.position, action.emoji);
                return;
            }
            if (action.type === NetworkActionType.INTERACTION) {
                broadcastMessage(action);
                triggerInteraction(action.interactionType, action.from, action.to);
                return;
            }
            if (action.type === NetworkActionType.REQUEST_REDEAL) {
                handleHostReceivedData(action, null);
                return;
            }

            if (action.type === NetworkActionType.BID) {
                setGameState(prev => processBidLogic(prev, action.bid));
            } else if (action.type === NetworkActionType.DEAL) {
                startNewDeal(false);
            } else if (action.type === NetworkActionType.RESTART) {
                startNewDeal(true);
            } else if (action.type === NetworkActionType.READY) {
                setGameState(prev => processReadyLogic(prev, action.position));
            } else if (action.type === NetworkActionType.PLAY) {
                setGameState(prev => processPlayLogic(prev, action.card, action.position));
            } else if (action.type === NetworkActionType.SURRENDER) {
                setGameState(prev => processSurrender(prev, action.position));
            }
        } else {
            if (connRef.current && connRef.current.open) {
                connRef.current.send(action);
            }
        };
    };

    return {
        myPeerId,
        hostPeerId,
        setHostPeerId,
        statusMsg,
        copyFeedback,
        connectToHost,
        copyRoomId,
        sendAction,
        addBot // Export addBot
    };
};
