import { useState, useRef, useCallback, useEffect } from 'react';
import { GameState, GamePhase, PlayerPosition } from '../types';
import { generateDeck, shuffleDeck, dealCards, calculateHCP } from '../services/bridgeLogic';
import { TEXT } from '../constants';

const INITIAL_STATE: GameState = {
    phase: GamePhase.Lobby,
    hands: {
        [PlayerPosition.North]: [],
        [PlayerPosition.East]: [],
        [PlayerPosition.South]: [],
        [PlayerPosition.West]: [],
    },
    dealer: PlayerPosition.North,
    turn: PlayerPosition.North,
    vulnerability: { ns: false, ew: false },
    bidHistory: [],
    lastBid: null,
    contract: null,
    declarer: null,
    players: [],
    readyPlayers: [],
    currentTrick: [],
    tricksWon: {
        [PlayerPosition.North]: 0,
        [PlayerPosition.East]: 0,
        [PlayerPosition.South]: 0,
        [PlayerPosition.West]: 0,
    },
    playHistory: [],
    winningTeam: undefined,
    surrendered: false
};

export const useGameLogic = () => {
    const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
    const gameStateRef = useRef<GameState>(INITIAL_STATE);
    const [hasRequestedRedeal, setHasRequestedRedeal] = useState(false);

    useEffect(() => {
        gameStateRef.current = gameState;
        // Fix: Reset re-deal request state when phase resets (e.g. after a redeal happens)
        if (gameState.phase === GamePhase.Reviewing || gameState.phase === GamePhase.Bidding) {
            setHasRequestedRedeal(false);
        }
    }, [gameState]);

    const startNewDeal = useCallback((isReplay: boolean = false) => {
        const currentState = gameStateRef.current;

        setHasRequestedRedeal(false);

        let nextDealer = currentState.dealer;
        let nextTurn = currentState.turn;

        if (isReplay && currentState.winningTeam) {
            const losers = currentState.winningTeam === 'NS'
                ? [PlayerPosition.East, PlayerPosition.West]
                : [PlayerPosition.North, PlayerPosition.South];
            const randomLoser = losers[Math.floor(Math.random() * losers.length)];
            nextDealer = randomLoser;
            nextTurn = randomLoser;
        } else if (!isReplay) {
            // First Game: Dealer/Turn is always Host (North)
            nextDealer = PlayerPosition.North;
            nextTurn = nextDealer;
        }

        const deck = shuffleDeck(generateDeck());
        const hands = dealCards(deck);

        setGameState(prev => ({
            ...prev,
            phase: GamePhase.Dealing,
            hands,
            dealer: nextDealer,
            turn: nextTurn,
            vulnerability: { ns: Math.random() > 0.5, ew: Math.random() > 0.5 },
            bidHistory: [],
            lastBid: null,
            contract: null,
            declarer: null,
            readyPlayers: [],
            currentTrick: [],
            tricksWon: { [PlayerPosition.North]: 0, [PlayerPosition.East]: 0, [PlayerPosition.South]: 0, [PlayerPosition.West]: 0 },
            playHistory: [],
            winningTeam: undefined,
            surrendered: false
        }));

        // Check for Auto-Redeal (> 16 points)
        let autoRedealPos: PlayerPosition | null = null;
        let maxPoints = 0;

        Object.entries(hands).forEach(([pos, hand]) => {
            const points = calculateHCP(hand);
            if (points > 16) {
                autoRedealPos = pos as PlayerPosition;
                maxPoints = points;
            }
        });

        if (autoRedealPos) {
            const player = currentState.players.find(p => p.position === autoRedealPos);
            const name = player ? player.name : TEXT[autoRedealPos as PlayerPosition];

            setTimeout(() => {
                const msg = `${TEXT.REDEAL_REQUESTED}: ${name} (${maxPoints} ${TEXT.POINTS} > 16). ${TEXT.REDEALING_IN}`;
                setSystemMessage(msg);
                // We need to access broadcast from here... ensure systemMessage triggers effect? 
                // Actually startNewDeal is local/Host only. Host sees message.
                // We should ideally broadcast this message. But we don't have broadcast here.
                // `systemMessage` state is returned. App can see it. 
                // But we need to Sync this with `handleRedealRequest` logic.
                // Simplest: just wait and call startNewDeal again. Host drives game state.
                // Does Host App component respond to systemMessage change by broadcasting? 
                // Currently App.tsx: setSystemMessage -> sendAction(MESSAGE)? No.
                // But `processPlayLogic` etc happen.

                // Let's just set timeout to re-deal.
                setTimeout(() => {
                    startNewDeal(isReplay);
                    setSystemMessage('');
                }, 4000);
            }, 1000);

            return; // Don't proceed to Reviewing phase yet? 
            // Phase is Dealing. UI shows Dealing.
            // If we don't switch to Reviewing, players won't see cards?
            // Maybe we WANT them to see cards briefly?
            // "Dealing" phase usually covers the animation.
        }

        setTimeout(() => {
            setGameState(prev => ({ ...prev, phase: GamePhase.Reviewing }));
        }, 1000);
    }, []);

    // --- Redeal Logic (Moved from useMultiplayer) ---
    const [systemMessage, setSystemMessage] = useState<string>('');
    const isRedealingRef = useRef<boolean>(false);

    const handleRedealRequest = useCallback((
        data: { position: PlayerPosition; points?: number },
        broadcastMessage: (msg: string) => void
    ) => {
        if (gameState.phase !== GamePhase.Reviewing) return;
        if (isRedealingRef.current) return;

        isRedealingRef.current = true;
        const player = gameState.players.find(p => p.position === data.position);
        const name = player ? player.name : TEXT[data.position];

        let countdown = 5;
        const tick = () => {
            if (countdown > 0) {
                const msg = `${TEXT.REDEAL_REQUESTED}: ${name} (${data.points} ${TEXT.POINTS}). ${countdown} ${TEXT.REDEALING_IN}`;
                setSystemMessage(msg);
                broadcastMessage(msg);
                countdown--;
                setTimeout(tick, 1000);
            } else {
                startNewDeal(false);
                setSystemMessage('');
                broadcastMessage('');
                isRedealingRef.current = false;
            }
        };
        tick();
    }, [gameState.phase, gameState.players, startNewDeal]);

    return {
        gameState,
        setGameState,
        gameStateRef,
        hasRequestedRedeal,
        setHasRequestedRedeal,
        startNewDeal,
        systemMessage,
        setSystemMessage,
        handleRedealRequest,
        INITIAL_STATE
    };
};
