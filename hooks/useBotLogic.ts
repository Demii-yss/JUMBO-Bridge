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
    // 2=0, 3=1... 9=7, 10=8... A=12
    return RANK_ORDER.indexOf(rank);
};

const getHCP = (rank: Rank): number => {
    if (rank === 'A') return 4;
    if (rank === 'K') return 3;
    if (rank === 'Q') return 2;
    if (rank === 'J') return 1;
    return 0;
};

const isHighCard = (rank: Rank): boolean => {
    return getRankValue(rank) >= 8; // Index 8 is '10'
};

export const useBotLogic = ({ gameState, isHost, myPosition, sendAction }: UseBotLogicProps) => {

    const botTurnState = useRef<{ turn: PlayerPosition | null, targetTime: number }>({ turn: null, targetTime: 0 });

    useEffect(() => {
        if (!isHost) return;

        // --- CONCURRENT PHASES (Reviewing) ---
        if (gameState.phase === GamePhase.Reviewing) {
            const bots = gameState.players.filter(p => p.isBot);
            const pendingBots = bots.filter(p => !gameState.readyPlayers.includes(p.position));

            if (pendingBots.length > 0) {
                const timer = setTimeout(() => {
                    const botToReady = pendingBots[0];
                    // Always confirm hand (No Redeal)
                    sendAction({ type: NetworkActionType.READY, position: botToReady.position });
                }, 500);
                return () => clearTimeout(timer);
            }
            return;
        }

        // --- TURN-BASED PHASES (Bidding, Playing) ---
        const currentPlayerProfile = gameState.players.find(p => p.position === gameState.turn);
        if (!currentPlayerProfile || !currentPlayerProfile.isBot) {
            if (botTurnState.current.turn !== null) {
                botTurnState.current = { turn: null, targetTime: 0 };
            }
            return;
        }

        const botPosition = currentPlayerProfile.position;
        const hand = gameState.hands[botPosition];

        // --- 1. Delay Logic ---
        let delay = 0;
        if (botTurnState.current.turn !== botPosition) {
            let minDelay = 1000;
            let maxDelay = 2500;
            // Rule: Leading -> 2.5s - 4.0s
            if (gameState.phase === GamePhase.Playing && gameState.currentTrick.length === 0) {
                minDelay = 2500;
                maxDelay = 4000;
            }
            delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
            botTurnState.current = { turn: botPosition, targetTime: Date.now() + delay };
        } else {
            delay = Math.max(0, botTurnState.current.targetTime - Date.now());
        }

        const executeBotAction = () => {
            // --- 2. Bidding Logic ---
            if (gameState.phase === GamePhase.Bidding) {
                // Calculate Stats
                const suits: Suit[] = [Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs];
                const stats = suits.map(suit => {
                    const suitCards = hand.filter(c => c.suit === suit);
                    const ai = suitCards.reduce((sum, c) => sum + getHCP(c.rank), 0);
                    const bi = suitCards.length;
                    return { suit, ai, bi };
                });

                const totalHCP = stats.reduce((sum, s) => sum + s.ai, 0);
                const isBalanced = stats.every(s => s.bi <= 5);

                // Select Candidate Suit s
                // Max ai, then Max bi
                const sortedStats = [...stats].sort((a, b) => {
                    if (b.ai !== a.ai) return b.ai - a.ai;
                    return b.bi - a.bi;
                });
                const candidate = sortedStats[0];

                let bidType: string = 'Pass';

                // Decision Tree
                if (isBalanced && totalHCP >= 14) {
                    bidType = candidate.suit;
                } else if (totalHCP >= 12 && candidate.bi >= 5) {
                    bidType = candidate.suit;
                } else if (candidate.bi >= 6 && totalHCP >= 9) {
                    bidType = candidate.suit;
                }

                // --- Auto-Pass if we are the current highest bidder ---
                // (Safeguard: In standard bridge this shouldn't happen, but if turn returns to us, we must pass)
                if (gameState.lastBid && gameState.lastBid.player === botPosition) {
                    bidType = 'Pass';
                }

                if (bidType !== 'Pass') {
                    const suitRank = { 'C': 0, 'D': 1, 'H': 2, 'S': 3, 'NT': 4 };
                    let currentLevel = 0;
                    let currentSuitRank = -1;

                    // Use lastBid for comparison if available (more accurate than contract which might be unset or old)
                    if (gameState.lastBid && gameState.lastBid.type === 'Bid') {
                        currentLevel = gameState.lastBid.level!;
                        currentSuitRank = suitRank[gameState.lastBid.suit as Suit | 'NT'];
                    }
                    else if (gameState.contract) {
                        currentLevel = gameState.contract.level;
                        currentSuitRank = suitRank[gameState.contract.suit];
                    }

                    const mySuitRank = suitRank[candidate.suit as Suit];
                    let bidLevel = 1;

                    if (currentLevel === 0) {
                        bidLevel = 1; // Open
                    } else {
                        // Fix: Strictly check rank at current level
                        if (mySuitRank > currentSuitRank) {
                            bidLevel = currentLevel;
                        } else {
                            bidLevel = currentLevel + 1;
                        }
                    }

                    // FIX: Ensure we don't bid same level with lower/equal rank (redundant check but safe)
                    if (bidLevel === currentLevel && mySuitRank <= currentSuitRank) {
                        bidLevel++;
                    }

                    // FIX: Cap at Level 3
                    if (bidLevel <= 3) {
                        sendAction({ type: NetworkActionType.BID, bid: { type: 'Bid', suit: candidate.suit, level: bidLevel, player: botPosition } });
                    } else {
                        sendAction({ type: NetworkActionType.BID, bid: { type: 'Pass', player: botPosition } });
                    }

                } else {
                    sendAction({ type: NetworkActionType.BID, bid: { type: 'Pass', player: botPosition } });
                }
            }
            // --- 3. Playing Logic ---
            else if (gameState.phase === GamePhase.Playing) {
                const validCards = hand.filter(card => canPlayCard(card, hand, gameState.currentTrick));

                if (validCards.length === 0) {
                    console.error("BOT has no valid cards!");
                    return;
                }

                let cardToPlay: Card | null = null;
                const trumpSuit = gameState.contract?.suit;
                const isTrumpGame = trumpSuit && trumpSuit !== 'NT';

                // Helpers
                const sortByRankAsc = (cards: Card[]) => [...cards].sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
                const sortByRankDesc = (cards: Card[]) => [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
                const getMin = (cards: Card[]) => sortByRankAsc(cards)[0];
                const getMax = (cards: Card[]) => sortByRankDesc(cards)[0];

                // SCENARIO 1: LEADING (Trick is empty)
                if (gameState.currentTrick.length === 0) {
                    const declarer = gameState.contract!.declarer;
                    const partner = PARTNER[declarer];
                    const isAttacker = (botPosition === declarer || botPosition === partner);

                    const trumps = isTrumpGame ? validCards.filter(c => c.suit === trumpSuit) : [];
                    const nonTrumps = isTrumpGame ? validCards.filter(c => c.suit !== trumpSuit) : validCards;

                    if (!isAttacker) {
                        // DEFENDER (Different Team)
                        // Priority: Non-Trump -> Trump
                        const pool = nonTrumps.length > 0 ? nonTrumps : trumps;
                        // Logic:
                        // If Max < 10 -> Play Min
                        // If Max >= 10 -> Play Max
                        if (pool.length > 0) {
                            const maxCard = getMax(pool);
                            if (isHighCard(maxCard.rank)) {
                                cardToPlay = maxCard;
                            } else {
                                cardToPlay = getMin(pool);
                            }
                        } else {
                            cardToPlay = validCards[0];
                        }
                    } else {
                        // ATTACKER (Same Team)
                        if (trumps.length > 0) {
                            // Have Trumps
                            const maxTrump = getMax(trumps);
                            if (isHighCard(maxTrump.rank)) {
                                cardToPlay = maxTrump; // >=10 Play Max
                            } else {
                                cardToPlay = getMin(trumps); // <10 Play Min
                            }
                        } else {
                            // No Trumps
                            const maxCard = getMax(validCards);
                            if (isHighCard(maxCard.rank)) {
                                cardToPlay = maxCard;
                            } else {
                                cardToPlay = getMin(validCards);
                            }
                        }
                    }

                } else {
                    // SCENARIO 2: FOLLOWING
                    const firstCard = gameState.currentTrick[0].card;
                    const leadIsTrump = isTrumpGame && firstCard.suit === trumpSuit;

                    const hasTrumpInValid = isTrumpGame && validCards.some(c => c.suit === trumpSuit);

                    // IMPORTANT: Determine "Can Play Trump Per Rule"
                    // Current Table Max
                    const currentWinnerPos = getTrickWinner(gameState.currentTrick, trumpSuit);
                    const getWinningCard = () => {
                        let bestIdx = 0;
                        gameState.currentTrick.forEach((tc, i) => { if (tc.player === currentWinnerPos) bestIdx = i; });
                        return gameState.currentTrick[bestIdx].card;
                    };
                    const winningCard = getWinningCard();
                    const winVal = getRankValue(winningCard.rank);

                    if (!hasTrumpInValid) {
                        // --- Cannot Play Trump (Must follow non-trump, or discarding non-trump) ---

                        let shouldUseMin = false;

                        // Check Partner status
                        // Logic: If Partner played & Partner is Winning & (Partner Card Rank >= 11 OR Partner Card is Trump) -> Play Min
                        const partnerPos = PARTNER[botPosition];
                        const partnerPlayed = gameState.currentTrick.some(tc => tc.player === partnerPos);

                        if (partnerPlayed && currentWinnerPos === partnerPos) {
                            const partnerCard = winningCard; // Since partner is winner, winningCard IS partnerCard
                            const isPartnerTrump = isTrumpGame && partnerCard.suit === trumpSuit;
                            const partnerRankVal = getRankValue(partnerCard.rank);

                            // Rank >= 11 (Jack or higher). IndexMap: 10->8, J->9. So index >= 9.
                            const isStrongRank = partnerRankVal >= 9;

                            if (isPartnerTrump || isStrongRank) {
                                shouldUseMin = true;
                            }
                        }

                        if (shouldUseMin) {
                            cardToPlay = getMin(validCards);
                        } else {
                            // Standard Max vs Table Max logic
                            const maxValid = getMax(validCards);
                            const maxVal = getRankValue(maxValid.rank);

                            if (maxVal < winVal) {
                                cardToPlay = getMin(validCards);
                            } else {
                                cardToPlay = getMax(validCards);
                            }
                        }

                    } else {
                        // --- Can Play Trump --- (We have trumps in valid set)

                        if (leadIsTrump) {
                            // Case: Lead was Trump (Standard follow)
                            const maxValid = getMax(validCards); // Trumps
                            const maxVal = getRankValue(maxValid.rank);

                            if (maxVal < winVal) {
                                cardToPlay = getMin(validCards);
                            } else {
                                cardToPlay = getMax(validCards);
                            }
                        } else {
                            // Case: Lead NOT Trump, but we are playing Trump (Cutting/Ruffing)
                            const partnerPos = PARTNER[botPosition];
                            const partnerPlayed = gameState.currentTrick.some(tc => tc.player === partnerPos);

                            if (!partnerPlayed) {
                                // Partner hasn't played -> Play Min Trump
                                const trumps = validCards.filter(c => c.suit === trumpSuit);
                                cardToPlay = getMin(trumps);
                            } else {
                                // Partner Played. Is Partner winning?
                                if (currentWinnerPos === partnerPos) {
                                    // Partner is Max (Winning) -> Play Min NON-Trump (Discard)
                                    const nonTrumps = validCards.filter(c => c.suit !== trumpSuit);
                                    if (nonTrumps.length > 0) {
                                        cardToPlay = getMin(nonTrumps);
                                    } else {
                                        const trumps = validCards.filter(c => c.suit === trumpSuit);
                                        cardToPlay = getMin(trumps);
                                    }
                                } else {
                                    // Partner NOT Max -> Play Min Trump
                                    const trumps = validCards.filter(c => c.suit === trumpSuit);
                                    cardToPlay = getMin(trumps);
                                }
                            }
                        }
                    }
                }

                if (!cardToPlay) cardToPlay = validCards[0];
                sendAction({ type: NetworkActionType.PLAY, card: cardToPlay, position: botPosition });
            }
        };

        const timer = setTimeout(executeBotAction, delay);
        return () => clearTimeout(timer);

    }, [gameState, isHost, sendAction]);
};
