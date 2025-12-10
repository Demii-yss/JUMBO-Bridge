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

    // Pure helper to generate state (exported for Multiplayer use)
    const generateNewDealState = (currentState: GameState, isReplay: boolean): GameState => {
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

        return {
            ...currentState,
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
        };
    };

    const startNewDeal = useCallback((isReplay: boolean = false) => {
        const newState = generateNewDealState(gameStateRef.current, isReplay);
        setGameState(newState);

        // Check for Auto-Redeal (> 16 points)
        let autoRedealPos: PlayerPosition | null = null;
        let maxPoints = 0;

        Object.entries(newState.hands).forEach(([pos, hand]) => {
            const points = calculateHCP(hand);
            if (points > 16) {
                autoRedealPos = pos as PlayerPosition;
                maxPoints = points;
            }
        });

        if (autoRedealPos) {
            const player = newState.players.find(p => p.position === autoRedealPos);
            const name = player ? player.name : TEXT[autoRedealPos as PlayerPosition];

            setTimeout(() => {
                const msg = `${TEXT.REDEAL_REQUESTED}: ${name} (${maxPoints} ${TEXT.POINTS} > 16). ${TEXT.REDEALING_IN}`;
                setSystemMessage(msg);
                setTimeout(() => {
                    startNewDeal(isReplay);
                    setSystemMessage('');
                }, 4000);
            }, 1000);
            return;
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
        generateNewDealState,
        INITIAL_STATE
    };
};
