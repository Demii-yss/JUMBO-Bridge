import React, { memo } from 'react';
import { GameState, PlayerPosition, GamePhase, NetworkActionType } from '../types';
import { NEXT_TURN, PARTNER, TEXT } from '../constants'; // Import TEXT
import PlayerHand from './PlayerHand';
import PlayerBadge from './PlayerBadge';

interface GameTableProps {
    myPosition: PlayerPosition;
    gameState: GameState;
    isPortrait: boolean;
    getProfile: (pos: PlayerPosition) => any;
    uniqueNames: Record<string, string>;
    activeEmotes: Record<string, string>;
    selectedItemType: any;
    handleInteraction: (pos: PlayerPosition) => void;
    isMyTurnToPlay: boolean;
    sendAction: (action: any) => void;
    saveReplay?: () => void;
    onAddBot?: (slot: PlayerPosition) => void;
    onRemoveBot?: (slot: PlayerPosition) => void; // New Prop
    isHost?: boolean;
}

const GameTable: React.FC<GameTableProps> = memo(({
    myPosition,
    gameState,
    isPortrait,
    getProfile,
    uniqueNames,
    activeEmotes,
    selectedItemType,
    handleInteraction,
    isMyTurnToPlay,
    sendAction,
    getRelativeSlot,
    saveReplay,
    onAddBot,
    onRemoveBot,
    isHost
}) => {
    return (
        <>
            {['top', 'left', 'right', 'bottom'].map((slot) => {
                let targetPos: PlayerPosition | null = null;

                // Determine which position corresponds to this slot
                if (slot === 'bottom') targetPos = myPosition;
                else if (slot === 'top') targetPos = PARTNER[myPosition];
                else if (slot === 'left') targetPos = NEXT_TURN[myPosition];
                else targetPos = NEXT_TURN[PARTNER[myPosition]];

                // If myPosition is somehow null (shouldn't happen in game table), fallback
                if (!myPosition) return null;

                // Check if there is a player in this position
                const profile = targetPos ? getProfile(targetPos) : null;

                // Logic for EMPTY SLOT
                if (!profile) {
                    if (!targetPos) return null; // Should definitely be a valid enum value here

                    // Render "Waiting..." or "Add Bot" Placeholder
                    let style: React.CSSProperties = {};
                    if (slot === 'top') style = { top: '20%', left: '50%', transform: 'translate(-50%, -50%)' };
                    if (slot === 'left') style = { top: '50%', left: '20%', transform: 'translate(-50%, -50%)' };
                    if (slot === 'right') style = { top: '50%', right: '20%', transform: 'translate(50%, -50%)' };

                    // If it's bottom, it's me, so never empty.

                    return (
                        <div key={`empty-${slot}`} className="absolute z-20" style={style}>
                            <div className="flex flex-col items-center justify-center p-4 bg-black/40 rounded-xl border-2 border-dashed border-gray-500 backdrop-blur-sm">
                                <span className="text-gray-400 mb-2 font-bold">{TEXT[targetPos]}</span>
                                <div className="text-gray-500 text-sm mb-2">{TEXT.WAITING_FOR_OTHERS}</div>
                                {isHost && onAddBot && (
                                    <button
                                        onClick={() => onAddBot(targetPos!)}
                                        className="bg-green-700/80 hover:bg-green-600 text-white text-xs px-3 py-1 rounded shadow transition"
                                    >
                                        + ADD BOT
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                }

                const pos = targetPos!; // Now we know it's a valid player

                const isTurn = gameState.turn === pos;
                const isActive = isTurn && (gameState.phase === GamePhase.Playing || gameState.phase === GamePhase.Bidding);
                const isDeclarer = gameState.contract?.declarer === pos;
                const isSideBadge = slot === 'left' || slot === 'right';

                const badge = (
                    <div className="relative group">
                        <PlayerBadge
                            pos={pos}
                            profile={profile}
                            isTurn={isTurn}
                            isActive={isActive}
                            isDeclarer={isDeclarer}
                            isSideBadge={isSideBadge}
                            tricksWon={gameState.tricksWon[pos]}
                            gamePhase={gameState.phase}
                            activeEmote={activeEmotes[pos]}
                            showInteractionHighlight={!!selectedItemType}
                            handleInteraction={handleInteraction}
                            uniqueNames={uniqueNames}
                            isPortrait={isPortrait}
                            slot={slot}
                        />
                        {/* Remove Bot Button */}
                        {isHost && profile.isBot && gameState.phase === GamePhase.Idle && onRemoveBot && (
                            <button
                                onClick={() => onRemoveBot(pos)}
                                className="absolute -top-3 -right-3 z-50 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md border-2 border-white scale-0 group-hover:scale-100 transition-transform duration-200"
                                title="Remove Bot"
                            >
                                X
                            </button>
                        )}
                    </div>
                );

                if (slot === 'bottom') {
                    return (
                        <div key={pos} className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-end pb-4 pointer-events-none z-30">
                            <div className="mb-4 pointer-events-auto">{badge}</div>
                            <div className={`pointer-events-auto relative w-full flex justify-center ${isPortrait ? 'scale-[1.2] origin-bottom mb-10' : ''}`}>
                                <PlayerHand
                                    cards={gameState.hands[pos]}
                                    position={pos}
                                    isFaceUp={true}
                                    vertical={false}
                                    currentTrick={gameState.currentTrick}
                                    isMyTurn={isMyTurnToPlay}
                                    trumpSuit={gameState.contract?.suit}
                                    onPlayCard={(card) => sendAction({ type: NetworkActionType.PLAY, card, position: pos } as any)}
                                    scale={isPortrait ? 1.2 : 1}
                                />
                            </div>
                        </div>
                    );
                }

                if (slot === 'top') {
                    return (
                        <div key={pos} className="absolute top-0 left-0 w-full flex flex-col items-center justify-start pt-4 pointer-events-none z-30">
                            <div className="mt-4 order-last pointer-events-auto">{badge}</div>
                            <div className="pointer-events-auto relative w-full flex justify-center">
                                {!isPortrait && (
                                    <PlayerHand
                                        cards={gameState.hands[pos]}
                                        position={pos}
                                        isFaceUp={false}
                                        vertical={false}
                                    />
                                )}
                            </div>
                        </div>
                    );
                }

                if (slot === 'left') {
                    return (
                        <div key={pos} className="absolute left-0 top-0 h-full flex flex-row items-center pl-2 pointer-events-none z-30">
                            <div className="pointer-events-auto relative">
                                {!isPortrait && (
                                    <PlayerHand cards={gameState.hands[pos]} position={pos} isFaceUp={false} vertical={true} />
                                )}
                            </div>
                            <div className="ml-8 whitespace-nowrap vertical-lr pointer-events-auto">{badge}</div>
                        </div>
                    );
                }

                if (slot === 'right') {
                    return (
                        <div key={pos} className="absolute right-0 top-0 h-full flex flex-row-reverse items-center pr-2 pointer-events-none z-30">
                            <div className="pointer-events-auto relative">
                                {!isPortrait && (
                                    <PlayerHand cards={gameState.hands[pos]} position={pos} isFaceUp={false} vertical={true} />
                                )}
                            </div>
                            <div className="mr-8 whitespace-nowrap vertical-lr pointer-events-auto">{badge}</div>
                        </div>
                    );
                }
                return null;
            })}
        </>
    );
});

export default GameTable;
