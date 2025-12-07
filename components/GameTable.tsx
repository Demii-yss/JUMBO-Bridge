import React, { memo } from 'react';
import { GameState, PlayerPosition, GamePhase, NetworkActionType } from '../types';
import { NEXT_TURN, PARTNER } from '../constants';
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
    getRelativeSlot: (target: PlayerPosition, myPos: PlayerPosition) => string;
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
    getRelativeSlot
}) => {
    return (
        <>
            {['top', 'left', 'right', 'bottom'].map((slot) => {
                let pos: PlayerPosition;
                if (slot === 'bottom') pos = myPosition!;
                else if (slot === 'top') pos = PARTNER[myPosition!];
                else if (slot === 'left') pos = NEXT_TURN[myPosition!];
                else pos = NEXT_TURN[PARTNER[myPosition!]];

                if (!pos) return null;

                const profile = getProfile(pos);
                const isTurn = gameState.turn === pos;
                const isActive = isTurn && (gameState.phase === GamePhase.Playing || gameState.phase === GamePhase.Bidding);
                const isDeclarer = gameState.contract?.declarer === pos;
                const isSideBadge = slot === 'left' || slot === 'right';

                const badge = (
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
