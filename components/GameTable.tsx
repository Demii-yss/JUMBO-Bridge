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
                else if (slot === 'right') targetPos = NEXT_TURN[myPosition];
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
                    if (slot === 'top') style = { top: '0', left: '50%', transform: 'translate(-50%, 0)', paddingTop: '1vmin' };
                    if (slot === 'left') style = { top: '50%', left: '20%', transform: 'translate(-50%, -50%)' };
                    if (slot === 'right') style = { top: '50%', right: '20%', transform: 'translate(50%, -50%)' };

                    // If it's bottom, it's me, so never empty.

                    return (
                        <div key={`empty-${slot}`} className="absolute z-20" style={style}>
                            <div className="flex flex-col items-center justify-center p-4 bg-black/40 rounded-xl border-2 border-dashed border-gray-500 backdrop-blur-sm">
                                {/* <span className="text-gray-400 mb-2 font-bold">{TEXT[targetPos]}</span>  <-- Removed per user request */}
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
                const isDeclarer = gameState.contract?.declarer === pos && gameState.phase !== GamePhase.Finished;
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
                            isReady={gameState.readyPlayers.includes(pos)}
                            onClickAction={isHost && profile.isBot && onRemoveBot ? () => onRemoveBot(pos) : undefined}
                        />
                        {/* Remove Bot Button (Keep as alternative) */}
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
                        <React.Fragment key={pos}>
                            {/* 1. Badge Container - Moved to Bottom Right in Landscape */}
                            <div className={`absolute z-40 pointer-events-none ${isPortrait ? 'bottom-0 left-0 w-full flex justify-center items-end pb-0' : 'bottom-[2vmin] right-[2vmin] flex flex-col items-end'}`}>
                                <div className="mb-1 pointer-events-auto">{badge}</div>
                            </div>

                            {/* 2. Hand Container (Always Centered Bottom) */}
                            <div className={`absolute bottom-0 left-0 w-full flex justify-center z-40 pointer-events-none`}>
                                <div className={`pointer-events-auto relative w-full flex justify-center ${isPortrait ? 'scale-[1.0] origin-bottom mb-0' : ''}`}>
                                    <PlayerHand
                                        cards={gameState.hands[pos]}
                                        position={pos}
                                        isFaceUp={true}
                                        vertical={false}
                                        currentTrick={gameState.currentTrick}
                                        isMyTurn={isMyTurnToPlay}
                                        trumpSuit={gameState.contract?.suit}
                                        onPlayCard={(card) => sendAction({ type: NetworkActionType.PLAY, card, position: pos } as any)}
                                        scale={isPortrait ? 1.0 : 1}
                                        interactive={true}
                                    />
                                </div>
                            </div>
                        </React.Fragment>
                    );
                }

                if (slot === 'top') {
                    return (
                        <div key={pos} className="absolute top-0 left-0 w-full flex justify-center items-start pt-4 pointer-events-none z-30">
                            {/* Wrapper to align Badge and Hand relative to each other */}
                            <div className="relative pointer-events-auto mt-4">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-40 pointer-events-auto mt-[1vmin]">
                                    {badge}
                                </div>
                                <div className="relative z-30">
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
                        </div>
                    );
                }

                if (slot === 'left') {
                    // Unified Logic: Always Vertical (Rotated)
                    // Centering: origin-center, centered in the slot
                    return (
                        <div key={pos} className="absolute left-0 top-0 h-full w-20 flex flex-col justify-center items-center pointer-events-none z-30">
                            <div className="relative pointer-events-auto w-0 h-0 flex items-center justify-center">
                                {/* Badge Center Point */}
                                <div className="absolute z-40 rotate-90 origin-center whitespace-nowrap flex justify-center items-center">
                                    {badge}
                                </div>
                                <div className="absolute pl-4 py-8 z-30">
                                    {/* Hand Offset (Left of Badge? No, Hand is vertical) */}
                                    {/* Note: Original had separate hand rendering logic. */}
                                    {/* If Hand is vertical, it needs to be positioned correctly relative to the new centered badge or slot. */}
                                    {/* Original: `pl-4` relative to slot. */}
                                    {!isPortrait && (
                                        <div className="translate-x-8"> {/* Push hand slightly right */}
                                            <PlayerHand cards={gameState.hands[pos]} position={pos} isFaceUp={false} vertical={true} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                if (slot === 'right') {
                    // Unified Logic: Always Vertical (Rotated)
                    return (
                        <div key={pos} className="absolute right-0 top-0 h-full w-20 flex flex-col justify-center items-center pointer-events-none z-30">
                            <div className="relative pointer-events-auto w-0 h-0 flex items-center justify-center">
                                {/* Badge Center Point */}
                                <div className="absolute z-40 -rotate-90 origin-center whitespace-nowrap flex justify-center items-center">
                                    {badge}
                                </div>
                                <div className="absolute pr-4 py-8 z-30">
                                    {!isPortrait && (
                                        <div className="-translate-x-8">
                                            <PlayerHand cards={gameState.hands[pos]} position={pos} isFaceUp={false} vertical={true} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }
                return null;
            })}
        </>
    );
});

export default GameTable;
