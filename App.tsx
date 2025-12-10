import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    GamePhase, PlayerPosition, PlayerProfile, InteractionType, NetworkActionType
} from './types';
import BiddingBox from './components/BiddingBox';
import AuctionBoard from './components/AuctionBoard';
import { TEXT, NEXT_TURN, PARTNER } from './constants';
import { SUIT_COLORS_LIGHT, SUIT_SYMBOLS, COLORS } from './colors';
import CardComponent from './components/Card';
import { FlyingItemRenderer, FlyingItem } from './components/FlyingItemRenderer';
import { useGameLogic } from './hooks/useGameLogic';
import { useMultiplayer } from './hooks/useMultiplayer';
import { useBotLogic } from './hooks/useBotLogic';
import { getTrickWinner, calculateHCP } from './services/bridgeLogic';

// Components
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import GameOverModal from './components/GameOverModal';
import InteractionOverlay from './components/InteractionOverlay';
import GameTable from './components/GameTable';
import ServerMonitor from './components/ServerMonitor';

type AppView = 'HOME' | 'LOBBY' | 'ROOM';

function App() {
    // --- View State ---
    const [currentView, setCurrentView] = useState<AppView>('HOME');
    const [playerId, setPlayerId] = useState<string>('');
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

    // --- Local State ---
    const [myPosition, setMyPosition] = useState<PlayerPosition | null>(null);
    const [playerName, setPlayerName] = useState<string>('Player');
    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    // UI State
    const [activeEmotes, setActiveEmotes] = useState<Record<string, string>>({});
    const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
    const [showEmotePicker, setShowEmotePicker] = useState(false);
    const [showItemPicker, setShowItemPicker] = useState(false);
    const [selectedItemType, setSelectedItemType] = useState<InteractionType | null>(null);
    const [activeInteractionType, setActiveInteractionType] = useState<InteractionType>('FLOWER');
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

    // --- Hooks ---
    const {
        gameState,
        setGameState,
        gameStateRef,
        hasRequestedRedeal,
        setHasRequestedRedeal,
        startNewDeal,
        systemMessage,
        setSystemMessage,
        handleRedealRequest,
        generateNewDealState
    } = useGameLogic();

    // Helper: Add Log
    const addLog = useCallback((msg: string) => {
        setDebugLogs(prev => [msg, ...prev].slice(0, 5));
    }, []);

    // Helper: Triggers (needed for Multiplayer hook)
    const triggerEmote = useCallback((pos: PlayerPosition, emoji: string) => {
        setActiveEmotes(prev => ({ ...prev, [pos]: emoji }));
        setTimeout(() => {
            setActiveEmotes(prev => {
                const next = { ...prev };
                if (next[pos] === emoji) delete next[pos];
                return next;
            });
        }, 3000);
    }, []);

    const myPositionRef = useRef(myPosition);
    useEffect(() => { myPositionRef.current = myPosition; }, [myPosition]);

    const getRelativeSlot = useCallback((targetPos: PlayerPosition, myPos: PlayerPosition | null): 'bottom' | 'left' | 'top' | 'right' => {
        if (!myPos) return 'bottom';
        if (targetPos === myPos) return 'bottom';
        if (NEXT_TURN[myPos] === targetPos) return 'right';
        if (PARTNER[myPos] === targetPos) return 'top';
        return 'left';
    }, []);

    const triggerInteraction = useCallback((type: InteractionType, from: PlayerPosition, to: PlayerPosition) => {
        const myPos = myPositionRef.current;
        const fromSlot = getRelativeSlot(from, myPos);
        const toSlot = getRelativeSlot(to, myPos);

        const newItem: FlyingItem = {
            id: Date.now() + Math.random(),
            type,
            fromSlot,
            toSlot,
            fromPlayer: from // Store source
        };

        setFlyingItems(prev => [...prev, newItem]);
    }, [getRelativeSlot]);

    const {
        myPeerId,
        hostPeerId,
        setHostPeerId,
        statusMsg,
        copyFeedback,
        connectToHost,
        copyRoomId,
        sendAction,
        addBot,
        removeBot,
        joinRoom, // New function to implement
        leaveRoom,
        checkLobbyStats,
        roomCounts
    } = useMultiplayer({
        gameState,
        setGameState,
        gameStateRef,
        myPosition,
        setMyPosition,
        playerName,
        startNewDeal,
        generateNewDealState, // Added
        triggerEmote,
        triggerInteraction,
        addLog,
        setSystemMessage,
        handleRedealRequest,
        userId: playerId, // Pass the User Input ID as the unique Session ID
        setPlayerName // Pass setter for sync
    });

    // --- Derived State & Helpers ---

    const myProfile = gameState.players.find(p => p.position === myPosition);
    const isHost = myProfile?.isHost || false;
    const isMyTurnToPlay = gameState.turn === myPosition && gameState.phase === GamePhase.Playing;
    const currentTrickWinner = gameState.currentTrick.length > 0 ? getTrickWinner(gameState.currentTrick, gameState.contract?.suit) : null;

    // Results Screen Visibility Logic
    const [showResults, setShowResults] = useState(false);
    useEffect(() => {
        if (gameState.phase === GamePhase.Finished) {
            setShowResults(true);
        } else {
            setShowResults(false);
        }
    }, [gameState.phase]);

    // --- Bot Logic Integration ---
    useBotLogic({
        gameState,
        isHost,
        myPosition,
        sendAction
    });

    // Check if my animation is playing (outgoing)
    const isInteractionLocked = flyingItems.some(item => item.fromPlayer === myPosition);

    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Broadcast System Message (Host Only)
    // This allows useGameLogic to set a message (like Auto-Redeal) and have it sent to everyone.
    useEffect(() => {
        if (isHost && systemMessage) {
            sendAction({ type: NetworkActionType.MESSAGE, message: systemMessage });
        }
    }, [isHost, systemMessage, sendAction]);

    const onRequestRedealClick = () => {
        if (!myPosition) return;
        // Manual Redeal Check: Points < 4
        const points = calculateHCP(gameState.hands[myPosition]);
        if (points >= 4) {
            setSystemMessage("必須 < 4 點才能申請重洗");
            setTimeout(() => setSystemMessage(""), 2000);
            return;
        }
        setHasRequestedRedeal(true);
        sendAction({ type: NetworkActionType.REQUEST_REDEAL, position: myPosition, points });
    };

    const getPlayerInSlot = useCallback((slot: 'bottom' | 'left' | 'top' | 'right') => {
        if (!myPosition) return null;
        if (slot === 'bottom') return myPosition;
        if (slot === 'right') return NEXT_TURN[myPosition];
        if (slot === 'top') return PARTNER[myPosition];
        return [PlayerPosition.North, PlayerPosition.East, PlayerPosition.South, PlayerPosition.West].find(p => getRelativeSlot(p, myPosition) === slot);
    }, [myPosition, getRelativeSlot]);

    const handleDropInteraction = useCallback((type: InteractionType, x: number, y: number) => {
        const { width, height } = dimensions;

        let targetSlot: 'top' | 'left' | 'right' | null = null;
        if (y < height * 0.2) targetSlot = 'top';
        else if (x < width * 0.2 && y > height * 0.2) targetSlot = 'left';
        else if (x > width * 0.8 && y > height * 0.2) targetSlot = 'right';

        if (targetSlot) {
            const targetPos = getPlayerInSlot(targetSlot);
            if (targetPos && targetPos !== myPosition) {
                sendAction({ type: NetworkActionType.INTERACTION, from: myPosition, to: targetPos, interactionType: type } as any);
            }
        }
    }, [dimensions, myPosition, getPlayerInSlot, sendAction]);

    let targetTricksDisplay = null;
    let canSurrender = false;

    if (gameState.contract && gameState.phase === GamePhase.Playing && myPosition) {
        const myPartner = PARTNER[myPosition];
        const isDeclarerSide = [gameState.contract.declarer, PARTNER[gameState.contract.declarer]].includes(myPosition);
        const level = Number(gameState.contract.level);

        const ourTricks = (gameState.tricksWon[myPosition] || 0) + (gameState.tricksWon[myPartner] || 0);
        const theirTricks = (Object.values(gameState.tricksWon) as number[]).reduce((a, b) => a + b, 0) - ourTricks;

        const declarerTarget = 6 + level;
        const defenderTarget = 14 - declarerTarget;

        const myTarget = isDeclarerSide ? declarerTarget : defenderTarget;
        targetTricksDisplay = `${ourTricks}/${myTarget}`;

        const theyMetTarget = (isDeclarerSide && theirTricks >= defenderTarget) || (!isDeclarerSide && theirTricks >= declarerTarget);
        if (theyMetTarget) canSurrender = true;
    }

    const downloadHistory = () => {
        const data = {
            date: new Date().toISOString(),
            players: gameState.players,
            contract: gameState.contract,
            bidding: gameState.bidHistory,
            play: gameState.playHistory,
            result: gameState.tricksWon
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bridge_game_${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const closePickers = () => {
        setShowEmotePicker(false);
        setShowItemPicker(false);
    };

    const cancelInteractionSelection = () => {
        setSelectedItemType(null);
    };

    const shouldDisablePass = () => {
        if (gameState.bidHistory.length === 4) {
            const allPass = gameState.bidHistory.every(b => b.type === 'Pass');
            if (allPass && gameState.turn === myPosition) return true;
        }
        return false;
    };

    const uniqueNames = React.useMemo(() => {
        const nameCounts: Record<string, number> = {};
        const mapping: Record<string, string> = {};

        gameState.players.forEach(p => {
            nameCounts[p.name] = (nameCounts[p.name] || 0) + 1;
        });

        const currentCounts: Record<string, number> = {};
        gameState.players.forEach(p => {
            if (nameCounts[p.name] > 1) {
                currentCounts[p.name] = (currentCounts[p.name] || 0) + 1;
                if (currentCounts[p.name] === 1) mapping[p.id] = p.name;
                else mapping[p.id] = `${p.name} ${currentCounts[p.name]}`;
            } else {
                mapping[p.id] = p.name;
            }
        });
        return mapping;
    }, [gameState.players]);

    const getProfile = useCallback((pos: PlayerPosition) => gameState.players.find(p => p.position === pos), [gameState.players]);

    const handleEmote = (emoji: string) => {
        if (!myPosition) return;
        sendAction({ type: NetworkActionType.EMOTE, position: myPosition, emoji } as any);
        setShowEmotePicker(false);
    };

    const handleInteraction = (targetPos: PlayerPosition) => {
        if (!myPosition) return;
        if (targetPos === myPosition) return; // Cannot target self

        // Use selected item or active item (fallback for drag)
        const type = selectedItemType || activeInteractionType;
        if (!type) return;

        sendAction({ type: NetworkActionType.INTERACTION, from: myPosition, to: targetPos, interactionType: type } as any);
        setSelectedItemType(null);
    };

    const isPortrait = dimensions.height > dimensions.width;
    const safeScale = Math.min(dimensions.width / 1366, dimensions.height / 768);

    // --- Navigation Handlers ---

    const handleLogin = (id: string) => {
        setPlayerId(id);
        setCurrentView('LOBBY');
        // Load name if saved? For now default
    };

    const handleJoinRoom = (roomNumber: number) => {
        setSelectedRoomId(roomNumber);
        setCurrentView('ROOM');
        if (joinRoom) {
            joinRoom(roomNumber.toString());
        }
    };

    const handleExitRoom = () => {
        if (leaveRoom) leaveRoom();
        setSelectedRoomId(null);
        setCurrentView('LOBBY');
        setMyPosition(null);
        setGameState(prev => ({ ...prev, players: [], phase: GamePhase.Lobby }));
    };

    // Auto-Switch to Room if Position Set (Reconnection Handler)
    useEffect(() => {
        if (myPosition && currentView !== 'ROOM') {
            setCurrentView('ROOM');
        }
    }, [myPosition, currentView]);

    const handleLogout = () => {
        if (leaveRoom) leaveRoom(); // Clean up if active
        setPlayerId('');
        setCurrentView('HOME');
    };

    // --- Render Based on View ---

    if (currentView === 'HOME') {
        return <HomeScreen onLogin={handleLogin} />;
    }

    if (currentView === 'LOBBY') {
        return (
            <LobbyScreen
                playerId={playerId}
                playerName={playerName}
                setPlayerName={setPlayerName}
                onLogout={handleLogout}
                onJoinRoom={handleJoinRoom}
                checkLobbyStats={checkLobbyStats}
                roomCounts={roomCounts}
            />
        );
    }

    // --- ROOM VIEW (Direct to Green Table) ---
    // Show Loading/Connecting overlay until myPosition is set
    if (myPosition === null) {
        return (
            <ServerMonitor>
                <div className={`fixed inset-0 ${COLORS.TABLE_BG} flex flex-col justify-center items-center text-white`}>
                    <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>
                    <h2 className="text-3xl font-bold animate-pulse text-yellow-400 mb-4">{statusMsg || TEXT.CONNECTING}</h2>
                    <button
                        className="mt-8 bg-red-600/80 hover:bg-red-600 text-white px-6 py-2 rounded shadow font-bold z-50 pointer-events-auto"
                        onClick={handleExitRoom}
                    >
                        {TEXT.EXIT_ROOM}
                    </button>
                    {/* Debug Logs for issue tracking */}
                    <div className="fixed bottom-0 right-0 p-2 text-xs text-gray-500 max-w-sm">
                        {debugLogs.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                </div>
            </ServerMonitor>
        );
    }

    // Once position is set, we render the Table (Green Screen) directly.
    // GameLobby (Black Screen) is completely bypassed.

    return (
        <ServerMonitor>
            <div
                className={`fixed inset-0 ${COLORS.TABLE_BG} overflow-hidden flex justify-center items-center relative select-none font-sans`}
                style={{ width: dimensions.width, height: dimensions.height }}
            >
                {/* Exit Room Button (Visual Adjustment for Green Table) */}
                {gameState.phase !== GamePhase.Playing && gameState.phase !== GamePhase.Bidding && gameState.phase !== GamePhase.Reviewing && (
                    <button
                        className="fixed top-4 left-4 z-[200] bg-red-800/60 hover:bg-red-700/80 text-white px-4 py-2 rounded shadow font-bold text-sm backdrop-blur-sm border border-red-500/30 transition-all"
                        onClick={handleExitRoom}
                    >
                        {TEXT.EXIT_ROOM}
                    </button>
                )}

                <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>

                <div
                    className="w-full h-full relative"
                    style={{ fontSize: `${16 * safeScale}px` }}
                >
                    <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>

                    {(showEmotePicker || showItemPicker) && (
                        <div className="absolute inset-0 z-40" onClick={closePickers}></div>
                    )}

                    {selectedItemType && (
                        <>
                            <div className="absolute inset-0 z-45 cursor-crosshair" onClick={cancelInteractionSelection}></div>

                            {/* Target Zone: Partner (Top) - 20% Height, 100% Width */}
                            <div
                                className="absolute top-0 left-0 w-full h-[20%] z-50 hover:bg-white/10 transition-colors cursor-pointer border-b-2 border-white/20"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const p = getPlayerInSlot('top');
                                    if (p) handleInteraction(p);
                                }}
                            ></div>

                            {/* Target Zone: Left Player - 20% Width, 80% Height (Bottom aligned) */}
                            <div
                                className="absolute bottom-0 left-0 w-[20%] h-[80%] z-50 hover:bg-white/10 transition-colors cursor-pointer border-r-2 border-white/20"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const p = getPlayerInSlot('left');
                                    if (p) handleInteraction(p);
                                }}
                            ></div>

                            {/* Target Zone: Right Player - 20% Width, 80% Height (Bottom aligned) */}
                            <div
                                className="absolute bottom-0 right-0 w-[20%] h-[80%] z-50 hover:bg-white/10 transition-colors cursor-pointer border-l-2 border-white/20"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const p = getPlayerInSlot('right');
                                    if (p) handleInteraction(p);
                                }}
                            ></div>
                        </>
                    )}

                    {flyingItems.map(item => (
                        <FlyingItemRenderer key={item.id} item={item} onComplete={() => setFlyingItems(prev => prev.filter(i => i.id !== item.id))} />
                    ))}

                    {systemMessage && (
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] bg-black/70 px-8 py-4 rounded-full text-2xl text-yellow-300 font-bold animate-pulse pointer-events-none whitespace-nowrap">
                            {systemMessage}
                        </div>
                    )}

                    {/* Active Turn Highlights (Quadrants) */}
                    {['bottom', 'left', 'top', 'right'].map(slot => {
                        const pos = getPlayerInSlot(slot as any);
                        if (!pos) return null;
                        const isTurn = gameState.turn === pos && (gameState.phase === GamePhase.Playing || gameState.phase === GamePhase.Bidding);

                        let bgClass = 'transition-opacity duration-500 absolute pointer-events-none z-0';
                        if (slot === 'bottom') bgClass += ' bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-amber-500/40 to-transparent';
                        if (slot === 'top') bgClass += ' top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-amber-500/40 to-transparent';
                        if (slot === 'left') bgClass += ' left-0 top-0 bottom-0 w-1/3 bg-gradient-to-r from-amber-500/40 to-transparent';
                        if (slot === 'right') bgClass += ' right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-amber-500/40 to-transparent';

                        return <div key={`bg-${slot}`} className={`${bgClass} ${isTurn ? 'opacity-100' : 'opacity-0'}`}></div>;
                    })}

                    {/* Info Info - Fluid Text & Padding (Unified Size) */}
                    {gameState.contract && gameState.phase !== GamePhase.Finished && (
                        <div className={`absolute z-50 bg-black/60 border-yellow-500 rounded backdrop-blur-md shadow-2xl 
                            p-[2vmin]
                            ${isPortrait ? 'top-[8vmin] right-[2vmin] border-r-[1vmin] text-right' : 'bottom-[2vmin] left-[2vmin] border-l-[1vmin] text-left'}
                        `}>
                            <div className={`text-[3.5vmin] font-bold flex items-center leading-none ${isPortrait ? 'justify-end' : ''}`}>
                                <span className="mr-2 text-gray-100">{TEXT.CONTRACT}:</span>
                                {gameState.contract.level}
                                <span className={`${SUIT_COLORS_LIGHT[gameState.contract.suit]} ml-1`}>
                                    {SUIT_SYMBOLS[gameState.contract.suit]}
                                </span>
                            </div>
                            <div className={`text-[3vmin] font-bold mt-2 flex items-center ${isPortrait ? 'justify-end' : ''}`}>
                                <span className="mr-2 text-gray-300">{TEXT.TRICKS}:</span>
                                <span className="text-white">{targetTricksDisplay}</span>
                            </div>
                        </div>
                    )}

                    {/* Surrender Button */}
                    {canSurrender && (
                        <button
                            onClick={() => sendAction({ type: NetworkActionType.SURRENDER, position: myPosition! } as any)}
                            className={`absolute bottom-40 right-10 z-50 ${COLORS.BTN_DANGER} font-bold py-2 px-6 rounded shadow-lg animate-bounce`}
                        >
                            {TEXT.SURRENDER}
                        </button>
                    )}

                    <InteractionOverlay
                        isPortrait={isPortrait}
                        showEmotePicker={showEmotePicker}
                        setShowEmotePicker={setShowEmotePicker}
                        showItemPicker={showItemPicker}
                        setShowItemPicker={setShowItemPicker}
                        selectedItemType={selectedItemType}
                        setSelectedItemType={setSelectedItemType}
                        handleEmote={handleEmote}
                        activeInteractionType={activeInteractionType}
                        setActiveInteractionType={setActiveInteractionType}
                        onDropInteraction={handleDropInteraction}
                        isLocked={isInteractionLocked}
                    />



                    {/* Start/Ready System (Lobby/Finished) */}
                    {((gameState.phase === GamePhase.Idle || gameState.phase === GamePhase.Lobby || gameState.phase === GamePhase.Finished) && !showResults) && (
                        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100]">
                            {/* Host: Start Game */}
                            {isHost ? (
                                <button
                                    onClick={() => sendAction({ type: NetworkActionType.DEAL } as any)}
                                    // Logic: 3 other players must be ready, and total 4 players
                                    disabled={gameState.players.length < 4 || (gameState.readyPlayers.length < 3)} // Assuming Host is never in readyPlayers? Or check exact logic
                                    // Actually better: check if all non-host players are in readyPlayers
                                    // const nonHosts = gameState.players.filter(p => !p.isHost);
                                    // const distinctReady = new Set(gameState.readyPlayers);
                                    // const allReady = nonHosts.every(p => distinctReady.has(p.position));
                                    // Let's rely on simple count for now if Host doesn't use Ready button. User said "Host doesn't have ready button".
                                    className={`${COLORS.BTN_PRIMARY} ${(gameState.players.length < 4 || gameState.readyPlayers.length < 3) ? COLORS.BTN_DISABLED : ''} px-8 py-4 rounded shadow-lg font-bold text-3xl transition-all`}
                                >
                                    {TEXT.DEAL_CARDS} {/* Reuse Text or "Start Game" */}
                                    {(gameState.players.length < 4) && (
                                        <div className="text-sm font-normal mt-1 opacity-80">(Wait for 4 Players)</div>
                                    )}
                                    {(gameState.players.length === 4 && gameState.readyPlayers.length < 3) && (
                                        <div className="text-sm font-normal mt-1 opacity-80">({gameState.readyPlayers.length}/{3} Players Ready)</div>
                                    )}
                                </button>
                            ) : (
                                /* Non-Host: Ready Toggle */
                                <button
                                    onClick={() => sendAction({ type: NetworkActionType.READY, position: myPosition! } as any)}
                                    className={`px-8 py-4 rounded shadow-lg font-bold text-3xl transition-all ${gameState.readyPlayers.includes(myPosition!)
                                        ? 'bg-green-600 hover:bg-green-500 text-white scan-line-active' // Ready Style
                                        : 'bg-gray-600 hover:bg-gray-500 text-white animate-pulse' // Not Ready Style
                                        }`}
                                >
                                    {gameState.readyPlayers.includes(myPosition!) ? "READY!" : "CLICK TO READY"}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Main Table (Center) for Playing Cards - Fluid Size */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[60]">
                        <div className="relative w-0 h-0 pointer-events-auto overflow-visible">
                            {gameState.currentTrick.map((tc) => {
                                const relativeSlot = getRelativeSlot(tc.player, myPosition);
                                let positionStyle: React.CSSProperties = { position: 'absolute', transition: 'all 0.5s ease-out' };

                                // Position played cards relative to center (0,0)
                                // Top: Move up. Bottom: Move down.
                                // Sides: Move left/right.
                                if (relativeSlot === 'bottom') {
                                    // Portrait: Push down 40% of screen (~30vmin from center?).
                                    // Previous was bottom -40% of 40vmin box => 16vmin from box bottom. Box bottom is 20vmin. So 36vmin.
                                    // Landscape: center (0,0)? No, bottom of table. Table 40vmin? 20vmin.
                                    // Let's use vmin offsets.
                                    positionStyle.top = isPortrait ? '35vmin' : '15vmin';
                                    positionStyle.left = '0';
                                    positionStyle.transform = 'translate(-50%, -50%)';
                                }
                                if (relativeSlot === 'top') {
                                    positionStyle.top = isPortrait ? '-25vmin' : '-15vmin';
                                    positionStyle.left = '0';
                                    positionStyle.transform = 'translate(-50%, -50%)';
                                }
                                if (relativeSlot === 'left') {
                                    // Portrait: Side edge. 48vw approx.
                                    // Landscape: Side of table.
                                    positionStyle.left = isPortrait ? '-45vw' : '-25vmin';
                                    positionStyle.top = isPortrait ? '10vmin' : '0';
                                    positionStyle.transform = isPortrait ? 'translate(0, -50%) rotate(90deg)' : 'translate(-50%, -50%) rotate(90deg)';
                                }
                                if (relativeSlot === 'right') {
                                    positionStyle.right = isPortrait ? '-45vw' : '-25vmin';
                                    positionStyle.top = isPortrait ? '10vmin' : '0';
                                    positionStyle.transform = isPortrait ? 'translate(0, -50%) rotate(90deg)' : 'translate(50%, -50%) rotate(90deg)';
                                }

                                const isWinning = currentTrickWinner === tc.player;
                                return (
                                    <div key={`${tc.player}-${tc.card.id}`} style={positionStyle}>
                                        <CardComponent card={tc.card} highlighted={isWinning} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bidding UI (Scaled Dynamically for Landscape only) */}
                    {gameState.phase === GamePhase.Bidding && (
                        <div
                            className={`absolute left-1/2 -translate-x-1/2 z-50 flex gap-4 animate-fade-in-up pointer-events-auto ${isPortrait ? 'flex-col top-[12vh] origin-top pt-2' : 'flex-row bottom-[35%] origin-center'}`}
                            style={{
                                transform: isPortrait
                                    ? 'translate(-50%, 0)' // No scale in portrait (handled by component sizing)
                                    : `translate(-50%, 0) scale(${safeScale * 1.2})`
                            }}
                        >
                            <AuctionBoard
                                history={gameState.bidHistory}
                                dealer={gameState.dealer}
                                myPosition={myPosition}
                                isPortrait={isPortrait}
                            />
                            <div className={gameState.turn === myPosition ? '' : 'invisible pointers-events-none'}>
                                <BiddingBox
                                    onBid={(bid) => sendAction({ type: NetworkActionType.BID, bid } as any)}
                                    history={gameState.bidHistory}
                                    player={myPosition!}
                                    disabled={gameState.turn !== myPosition}
                                    forceBid={shouldDisablePass()}
                                    isPortrait={isPortrait}
                                />
                            </div>
                        </div>
                    )}

                    {/* Ready / Reviewing UI */}
                    {gameState.phase === GamePhase.Reviewing && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-stone-900/95 p-10 rounded-2xl border-2 border-yellow-500 text-center shadow-2xl pointer-events-auto">
                            <h2 className="text-4xl font-bold mb-8 text-white">{TEXT.CHECK_HANDS}</h2>
                            <div className="flex gap-8 justify-center mb-10">
                                {gameState.players.map(p => (
                                    <div key={p.position} className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full ${gameState.readyPlayers.includes(p.position) ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        {/* <span className="text-2xl text-gray-400 mt-2">{TEXT[p.position]}</span> Removed per request */}
                                    </div>
                                ))}
                            </div>
                            {!gameState.readyPlayers.includes(myPosition!) ? (
                                <div className="flex flex-col gap-4 items-center">
                                    <button
                                        onClick={() => sendAction({ type: NetworkActionType.READY, position: myPosition! } as any)}
                                        disabled={hasRequestedRedeal}
                                        className={`${COLORS.BTN_SUCCESS} disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none font-bold py-4 px-12 rounded-xl shadow-lg text-3xl transform hover:scale-105 transition`}
                                    >
                                        {TEXT.READY}
                                    </button>
                                    <button onClick={onRequestRedealClick} className="text-gray-400 hover:text-white underline text-xl mt-4">
                                        {TEXT.REQUEST_REDEAL}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-yellow-400 text-2xl animate-pulse">{TEXT.WAITING_FOR_OTHERS}</div>
                            )}
                        </div>
                    )}

                    <GameTable
                        myPosition={myPosition}
                        gameState={gameState}
                        isPortrait={isPortrait}
                        getProfile={getProfile}
                        uniqueNames={uniqueNames}
                        activeEmotes={activeEmotes}
                        selectedItemType={selectedItemType}
                        handleInteraction={handleInteraction}
                        isMyTurnToPlay={isMyTurnToPlay}
                        sendAction={sendAction}
                        getRelativeSlot={getRelativeSlot}
                        onAddBot={addBot}
                        onRemoveBot={removeBot}
                        isHost={isHost}
                    />

                    {/* Game Over Screen */}
                    {gameState.phase === GamePhase.Finished && showResults && myPosition && (
                        <GameOverModal
                            gameState={gameState}
                            myPosition={myPosition}
                            isHost={isHost}
                            sendAction={sendAction}
                            downloadHistory={downloadHistory}
                            onClose={() => setShowResults(false)}
                        />
                    )}
                </div>


            </div>
        </ServerMonitor>
    );
}

export default App;