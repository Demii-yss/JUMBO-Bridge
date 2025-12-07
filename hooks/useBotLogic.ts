import { useEffect } from 'react';
import { GameState, GamePhase, PlayerPosition, NetworkActionType, Card, Suit } from '../types';
import { canPlayCard, getTrickWinner, calculateHCP } from '../services/bridgeLogic';
import { TEXT, SUIT_ORDER, RANK_ORDER } from '../constants';

interface UseBotLogicProps {
    gameState: GameState;
    isHost: boolean;
    myPosition: PlayerPosition | null;
    sendAction: (action: any) => void;
}

export const useBotLogic = ({ gameState, isHost, myPosition, sendAction }: UseBotLogicProps) => {

    useEffect(() => {
        // Only Host manages BOTs
        if (!isHost) return;

        // --- CONCURRENT PHASES (Reviewing) ---
        // In reviewing phase, any bot who hasn't clicked ready should do so.
        // It's not turn-based.
        if (gameState.phase === GamePhase.Reviewing) {
            const bots = gameState.players.filter(p => p.isBot);
            const pendingBots = bots.filter(p => !gameState.readyPlayers.includes(p.position));

            if (pendingBots.length > 0) {
                const timer = setTimeout(() => {
                    // Just Ready the first pending bot to avoid flooding (state updates will trigger loop for others)
                    // Or we can ready all. Let's ready one by one to ensure state stability.
                    const botToReady = pendingBots[0];
                    sendAction({ type: NetworkActionType.READY, position: botToReady.position });
                }, 500); // 500ms delay for "human-like" but fast response
                return () => clearTimeout(timer);
            }
            return;
        }

        // --- TURN-BASED PHASES (Bidding, Playing) ---

        // Check if it's a BOT's turn
        const currentPlayerProfile = gameState.players.find(p => p.position === gameState.turn);
        if (!currentPlayerProfile || !currentPlayerProfile.isBot) return;

        const botPosition = currentPlayerProfile.position;
        const hand = gameState.hands[botPosition];

        const executeBotAction = () => {
            if (gameState.phase === GamePhase.Bidding) {
                // simple BOT: Always PASS
                sendAction({ type: NetworkActionType.BID, bid: { type: 'Pass', player: botPosition } });
            }
            else if (gameState.phase === GamePhase.Playing) {
                // Simple BOT: Play MAX valid card
                const validCards = hand.filter(card => canPlayCard(card, hand, gameState.currentTrick));

                if (validCards.length === 0) {
                    console.error("BOT has no valid cards!");
                    return;
                }

                // Strategy: Just pick the highest rank valid card.
                const sorted = [...validCards].sort((a, b) => {
                    return RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank);
                });

                const cardToPlay = sorted[0];
                sendAction({ type: NetworkActionType.PLAY, card: cardToPlay, position: botPosition });
            }
        };

        // Requirement: "No Delay or Very Short". 
        const timer = setTimeout(executeBotAction, 200);

        return () => clearTimeout(timer);

    }, [gameState, isHost, sendAction]); // Re-run whenever state changes
};
