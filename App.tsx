import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    GamePhase, PlayerPosition, PlayerProfile, InteractionType, NetworkActionType
} from './types';
import BiddingBox from './components/BiddingBox';
import AuctionBoard from './components/AuctionBoard';
import { TEXT, NEXT_TURN, PARTNER, SUIT_COLORS_LIGHT, SUIT_SYMBOLS } from './constants';
import CardComponent from './components/Card';
import { FlyingItemRenderer, FlyingItem } from './components/FlyingItemRenderer';
import { useGameLogic } from './hooks/useGameLogic';
import { useMultiplayer } from './hooks/useMultiplayer';
import { useBotLogic } from './hooks/useBotLogic';
import { getTrickWinner, calculateHCP } from './services/bridgeLogic';

// Extracted Components
import GameLobby from './components/GameLobby';
import GameOverModal from './components/GameOverModal';
import InteractionOverlay from './components/InteractionOverlay';
import GameTable from './components/GameTable';
import ServerMonitor from './components/ServerMonitor';

function App() {
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
        handleRedealRequest
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
        if (NEXT_TURN[myPos] === targetPos) return 'left';
        if (PARTNER[myPos] === targetPos) return 'top';
        return 'right';
    }, []);

    const triggerInteraction = useCallback((type: InteractionType, from: PlayerPosition, to: PlayerPosition) => {
        const myPos = myPositionRef.current;
        const fromSlot = getRelativeSlot(from, myPos);
        const toSlot = getRelativeSlot(to, myPos);

        const newItem: FlyingItem = {
            id: Date.now() + Math.random(),
            type,
            fromSlot,
            toSlot
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
        addBot, // Get addBot
        removeBot // Get removeBot
    } = useMultiplayer({
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
    });

    // --- Derived State & Helpers ---

    const isHost = myPosition === PlayerPosition.North;
    const isMyTurnToPlay = gameState.turn === myPosition && gameState.phase === GamePhase.Playing;
    const currentTrickWinner = gameState.currentTrick.length > 0 ? getTrickWinner(gameState.currentTrick, gameState.contract?.suit) : null;

    // --- Bot Logic Integration ---
    useBotLogic({
        gameState,
        isHost,
        myPosition,
        sendAction
    });

    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const onRequestRedealClick = () => {
        if (!myPosition) return;
        setHasRequestedRedeal(true);
        const points = calculateHCP(gameState.hands[myPosition]);
        sendAction({ type: NetworkActionType.REQUEST_REDEAL, position: myPosition, points });
    };

    const getPlayerInSlot = (slot: 'bottom' | 'left' | 'top' | 'right') => {
        if (!myPosition) return null;
        if (slot === 'bottom') return myPosition;
        if (slot === 'left') return NEXT_TURN[myPosition];
        if (slot === 'top') return PARTNER[myPosition];
        return [PlayerPosition.North, PlayerPosition.East, PlayerPosition.South, PlayerPosition.West].find(p => getRelativeSlot(p, myPosition) === slot);
    };

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
        if (!myPosition || !selectedItemType) return;
        sendAction({ type: NetworkActionType.INTERACTION, from: myPosition, to: targetPos, interactionType: selectedItemType } as any);
        setSelectedItemType(null);
    };

    const isPortrait = dimensions.height > dimensions.width;
    const safeScale = Math.min(dimensions.width / 1366, dimensions.height / 768);

    // --- Render ---

    if (myPosition === null || gameState.phase === GamePhase.Lobby) {
        return (
            <ServerMonitor>
                <GameLobby
                    playerName={playerName}
                    setPlayerName={setPlayerName}
                    setMyPosition={setMyPosition}
                    setGameState={setGameState}
                    myPeerId={myPeerId}
                    hostPeerId={hostPeerId}
                    setHostPeerId={setHostPeerId}
                    connectToHost={connectToHost}
                    copyRoomId={copyRoomId}
                    statusMsg={statusMsg}
                    debugLogs={debugLogs}
                />
            </ServerMonitor>
        );
    }

    return (
        <ServerMonitor>
            <div className="h-screen w-screen bg-[#1a472a] overflow-hidden flex justify-center items-center relative select-none font-sans">
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
                        <div className="absolute inset-0 z-45 cursor-crosshair" onClick={cancelInteractionSelection}></div>
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
                    {gameState.contract && (
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
                            className="absolute bottom-40 right-10 z-50 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded shadow-lg animate-bounce"
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
                    />

                    {/* Header Info */}
                    <div className="absolute top-0 left-0 w-full p-2 flex justify-between items-start z-50 pointer-events-none">
                        <div className="pointer-events-auto mt-2 ml-2">
                            {isHost && gameState.phase === GamePhase.Idle && (
                                <button
                                    onClick={() => copyRoomId(myPeerId)}
                                    className="bg-black/60 hover:bg-black/80 text-yellow-500 px-4 py-2 rounded-lg border border-yellow-600/50 backdrop-blur-sm shadow-lg flex items-center gap-2 transition-all active:scale-95"
                                    title="Click to Copy Room ID"
                                >
                                    <span className="text-gray-400 text-sm font-bold uppercase">Room ID:</span>
                                    <span className="font-mono text-xl font-bold tracking-wider">{myPeerId}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {isHost && gameState.phase === GamePhase.Idle && (
                            <div className="pointer-events-auto">
                                <button
                                    onClick={() => sendAction({ type: NetworkActionType.DEAL } as any)}
                                    disabled={gameState.players.length < 4}
                                    className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-black px-8 py-4 rounded shadow font-bold text-2xl scale-[1.25] origin-top-right mr-20 mt-10"
                                >
                                    {TEXT.DEAL_CARDS}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Main Table (Center) for Playing Cards - Fluid Size */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <div className="relative w-[50vmin] h-[40vmin] pointer-events-auto">
                            {gameState.currentTrick.map((tc) => {
                                const relativeSlot = getRelativeSlot(tc.player, myPosition);
                                let positionStyle: React.CSSProperties = { position: 'absolute', transition: 'all 0.5s ease-out' };

                                // Position played cards
                                if (relativeSlot === 'bottom') { positionStyle.bottom = '20%'; positionStyle.left = '50%'; positionStyle.transform = 'translateX(-50%)'; }
                                if (relativeSlot === 'top') { positionStyle.top = '20%'; positionStyle.left = '50%'; positionStyle.transform = 'translateX(-50%)'; }
                                if (relativeSlot === 'left') { positionStyle.left = '20%'; positionStyle.top = '50%'; positionStyle.transform = 'translateY(-50%)'; }
                                if (relativeSlot === 'right') { positionStyle.right = '20%'; positionStyle.top = '50%'; positionStyle.transform = 'translateY(-50%)'; }

                                const isWinning = currentTrickWinner === tc.player;
                                return (
                                    <div key={`${tc.player}-${tc.card.id}`} style={positionStyle}>
                                        <CardComponent card={tc.card} highlighted={isWinning} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bidding UI (Modified for Portrait) */}
                    {gameState.phase === GamePhase.Bidding && (
                        <div className={`absolute left-1/2 -translate-x-1/2 z-50 flex gap-4 animate-fade-in-up pointer-events-auto ${isPortrait ? 'flex-col bottom-[25%] scale-90' : 'flex-row bottom-[35%]'}`}>
                            <AuctionBoard history={gameState.bidHistory} dealer={gameState.dealer} />
                            <BiddingBox
                                onBid={(bid) => sendAction({ type: NetworkActionType.BID, bid } as any)}
                                history={gameState.bidHistory}
                                player={myPosition!}
                                disabled={gameState.turn !== myPosition}
                                forceBid={shouldDisablePass()}
                            />
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
                                        <span className="text-2xl text-gray-400 mt-2">{TEXT[p.position]}</span>
                                    </div>
                                ))}
                            </div>
                            {!gameState.readyPlayers.includes(myPosition!) ? (
                                <div className="flex flex-col gap-4 items-center">
                                    <button
                                        onClick={() => sendAction({ type: NetworkActionType.READY, position: myPosition! } as any)}
                                        disabled={hasRequestedRedeal}
                                        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none text-white font-bold py-4 px-12 rounded-xl shadow-lg text-3xl transform hover:scale-105 transition"
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

                    {gameState.phase === GamePhase.Finished && (
                        <GameOverModal
                            gameState={gameState}
                            myPosition={myPosition}
                            isHost={isHost}
                            sendAction={sendAction}
                            downloadHistory={downloadHistory}
                        />
                    )}
                </div>


            </div>
        </ServerMonitor>
    );
}

export default App;