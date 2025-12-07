import { useEffect, useRef } from 'react';
import { GameState, GamePhase, PlayerPosition, NetworkActionType, Card, Suit, Rank, TrickCard } from '../types';
import { canPlayCard, getTrickWinner } from '../services/bridgeLogic';
import { TEXT, PARTNER, RANK_ORDER } from '../constants';

interface UseBotLogicProps {
    gameState: GameState;
    isHost: boolean;
    myPosition: PlayerPosition | null;
    sendAction: (action: any) => void;
}

// Helpers
const getRankValue = (rank: Rank): number => {
    // RANK_ORDER is ['2', '3', ... 'A']
    // User logic:
    // < 10 (2-9)
    // >= 10 (10, J, Q, K, A)
    // Let's rely on RANK_ORDER index for comparison, but for the "10" threshold:
    // 2=0, 3=1... 9=7, 10=8.
    // So distinct threshold is index >= 8.
    return RANK_ORDER.indexOf(rank);
};

const isHighCard = (rank: Rank): boolean => {
    return getRankValue(rank) >= 8; // Index 8 is '10'
};

export const useBotLogic = ({ gameState, isHost, myPosition, sendAction }: UseBotLogicProps) => {

    useEffect(() => {
        if (!isHost) return;

        // --- CONCURRENT PHASES (Reviewing) ---
        if (gameState.phase === GamePhase.Reviewing) {
            const bots = gameState.players.filter(p => p.isBot);
            const pendingBots = bots.filter(p => !gameState.readyPlayers.includes(p.position));

            if (pendingBots.length > 0) {
                const timer = setTimeout(() => {
                    const botToReady = pendingBots[0];
                    sendAction({ type: NetworkActionType.READY, position: botToReady.position });
                }, 500);
                return () => clearTimeout(timer);
            }
            return;
        }

        // --- TURN-BASED PHASES (Bidding, Playing) ---
        const currentPlayerProfile = gameState.players.find(p => p.position === gameState.turn);
        if (!currentPlayerProfile || !currentPlayerProfile.isBot) return;

        const botPosition = currentPlayerProfile.position;
        const hand = gameState.hands[botPosition];

        const executeBotAction = () => {
            if (gameState.phase === GamePhase.Bidding) {
                sendAction({ type: NetworkActionType.BID, bid: { type: 'Pass', player: botPosition } });
            }
            else if (gameState.phase === GamePhase.Playing) {
                const validCards = hand.filter(card => canPlayCard(card, hand, gameState.currentTrick));

                if (validCards.length === 0) {
                    console.error("BOT has no valid cards!");
                    return;
                }

                let cardToPlay: Card | null = null;
                const trumpSuit = gameState.contract?.suit;
                const isTrumpGame = trumpSuit && trumpSuit !== 'NT';

                // Sort helpers
                const sortByRankAsc = (cards: Card[]) => [...cards].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
                const sortByRankDesc = (cards: Card[]) => [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));

                const getMin = (cards: Card[]) => sortByRankAsc(cards)[0];
                const getMax = (cards: Card[]) => sortByRankDesc(cards)[0];


                // SCENARIO 1: LEADING
                if (gameState.currentTrick.length === 0 || gameState.currentTrick.length === 4) {
                    const declarer = gameState.contract!.declarer;
                    const partner = PARTNER[declarer];
                    const isAttacker = (botPosition === declarer || botPosition === partner);

                    const trumps = isTrumpGame ? validCards.filter(c => c.suit === trumpSuit) : [];
                    const nonTrumps = isTrumpGame ? validCards.filter(c => c.suit !== trumpSuit) : validCards;

                    if (!isAttacker) {
                        // DEFENDER
                        // Choose from non-trumps first. If none, use trump.
                        const pool = nonTrumps.length > 0 ? nonTrumps : trumps;

                        if (pool.length > 0) {
                            const maxCard = getMax(pool);
                            if (isHighCard(maxCard.rank)) {
                                cardToPlay = maxCard; // >= 10, Play Max
                            } else {
                                cardToPlay = getMin(pool); // < 10, Play Min
                            }
                        } else {
                            // Should be impossible if validCards > 0
                            cardToPlay = validCards[0];
                        }
                    } else {
                        // ATTACKER
                        if (trumps.length > 0) {
                            const maxTrump = getMax(trumps);
                            if (isHighCard(maxTrump.rank)) {
                                cardToPlay = maxTrump; // >= 10, Play Max Trump
                            } else {
                                cardToPlay = getMin(trumps); // < 10, Play Min Trump
                            }
                        } else {
                            // No trumps
                            const maxCard = getMax(validCards); // validCards == nonTrumps here
                            if (isHighCard(maxCard.rank)) {
                                cardToPlay = maxCard;
                            } else {
                                cardToPlay = getMin(validCards);
                            }
                        }
                    }

                } else {
                    // SCENARIO 2: FOLLOWING
                    // Identify Trick Winner so far
                    // Trick passed to getTrickWinner needs to be currentTrick
                    const currentWinnerPos = getTrickWinner(gameState.currentTrick, trumpSuit);

                    // We need the winning CARD value to compare
                    const getWinningCard = () => {
                        let bestIdx = 0;
                        gameState.currentTrick.forEach((tc, i) => {
                            if (tc.player === currentWinnerPos) bestIdx = i;
                        });
                        return gameState.currentTrick[bestIdx].card;
                    };

                    const winningCard = getWinningCard();
                    const winVal = getRankValue(winningCard.rank);

                    // Logic check: "Currently Largest" means taking into account suit/trump?
                    // "目前場上最大點數" usually implies the winning card's power.
                    // But requirement compares "Hand Max Valid Rank" vs "Table Max Rank".
                    // It simplifies to Rank comparison? Let's assume standard bridge power comparison.
                    // IF we can beat the current winner with a valid card, we might want to.

                    // Requirement specific phrasing:
                    // "If cannot play trump per rule" (Meaning: Not a trump game? Or no trumps in hand? Or following suit prevents playing trump?)
                    // Context: "Rule" usually means Following Suit.

                    const firstCard = gameState.currentTrick[0].card;
                    const canFollow = validCards.some(c => c.suit === firstCard.suit);

                    const canPlayTrump = isTrumpGame && validCards.some(c => c.suit === trumpSuit);
                    const leadIsTrump = isTrumpGame && firstCard.suit === trumpSuit;

                    // Case: Cannot Follow Lead Suit (and lead wasn't trump, or we are out of lead suit)
                    // If we can't follow suit, validCards contains either trumps (if any) or discards.

                    // Sub-logic: "If rule allows playing trump"
                    // In Bridge, if you can't follow suit, you CAN play trump.
                    // So if (!canFollow) and (hasTrump), we qualify for "Can Play Trump".

                    // Let's trace requirement strictly:

                    // "Not Leading"
                    // "If cannot play trump by rule" -> This implies either Game is NT, OR we have no Trumps, OR we Must Follow Suit (and suit is not trump).
                    // Actually, "validCards" already filters by rule.
                    // So "Cannot play trump" effectively means "We are not playing a trump card in this turn".
                    // BUT we are CHOOSING a card.

                    // INTERPRETATION:
                    // - Condition A: We CANNOT play a trump (No trumps in validCards, OR forced to follow non-trump).
                    // - Condition B: We CAN play a trump (We have trumps, and either Lead is Trump OR We are void in lead suit).

                    const hasTrumpInValid = isTrumpGame && validCards.some(c => c.suit === trumpSuit);

                    if (!hasTrumpInValid) {
                        // Case: No Trump involved in our decision
                        const maxValid = getMax(validCards);

                        // Compare MaxValid vs "Current Table Max"
                        // Note: If different suits, direct rank comparison is weird, but usually "Table Max" means the winning card's rank IF it dominates?
                        // If we are discarding, we can't win anyway.
                        // But let's follow the "Rank vs Rank" instruction literally.
                        const maxValidVal = getRankValue(maxValid.rank);
                        const tableMaxVal = winVal; // Determining "Table Max" is complex if trumps involved. Let's use winning card.

                        if (maxValidVal < tableMaxVal) {
                            cardToPlay = getMin(validCards);
                        } else {
                            cardToPlay = getMax(validCards);
                        }
                    } else {
                        // We HAVE trumps in validCards.
                        // Subcase: Lead was Trump?
                        if (leadIsTrump) {
                            // We MUST follow trump (since validCards has trumps).
                            const maxValid = getMax(validCards);
                            const maxValidVal = getRankValue(maxValid.rank);
                            const tableMaxVal = winVal;

                            if (maxValidVal < tableMaxVal) {
                                cardToPlay = getMin(validCards); // Min Trump
                            } else {
                                cardToPlay = getMax(validCards); // Max Trump
                            }
                        } else {
                            // Lead was NOT Trump, but we CAN play trump (so we are void in lead suit).
                            // Requirement: "If rule allows trump, and lead NOT trump -> Play Min Trump"
                            // (Wait, logic says "Play Min Trump" if lead not trump? Usually you ruff with min to win, or high to over-ruff?)
                            // User Req: "打出最小點數的王牌" (Play min rank trump).
                            const trumps = validCards.filter(c => c.suit === trumpSuit);
                            cardToPlay = getMin(trumps);
                        }
                    }
                }

                if (!cardToPlay) cardToPlay = validCards[0]; // Fallback
                sendAction({ type: NetworkActionType.PLAY, card: cardToPlay, position: botPosition });
            }
        };

        const timer = setTimeout(executeBotAction, 50); // Immediate
        return () => clearTimeout(timer);

    }, [gameState, isHost, sendAction]);
};
