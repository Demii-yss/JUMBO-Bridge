import { GameState, GamePhase, PlayerPosition, Bid, Card } from '../types';
import { NEXT_TURN, PARTNER } from '../constants';
import { getTrickWinner } from './bridgeLogic';

export const processReadyLogic = (prev: GameState, position: PlayerPosition): GameState => {
    // If logically we are in Finished phase, "Ready" means "Back to Room"
    if (prev.phase === GamePhase.Finished) {
        if (prev.readyPlayers.includes(position)) return prev;
        const newReady = [...prev.readyPlayers, position];
        return { ...prev, readyPlayers: newReady };
    }

    if (prev.phase !== GamePhase.Reviewing) return prev;
    if (prev.readyPlayers.includes(position)) return prev;

    const newReady = [...prev.readyPlayers, position];
    let nextPhase: GamePhase = prev.phase;

    if (newReady.length >= prev.players.length) {
        nextPhase = GamePhase.Bidding;
    }

    return { ...prev, readyPlayers: newReady, phase: nextPhase };
};

export const processBidLogic = (prev: GameState, bid: Bid): GameState => {
    if (bid.player !== prev.turn) return prev;

    const newHistory = [...prev.bidHistory, bid];
    let nextTurn = NEXT_TURN[prev.turn];
    let newLastBid = prev.lastBid;
    if (bid.type === 'Bid') newLastBid = bid;

    let nextPhase = prev.phase;
    let contract = prev.contract;
    let declarer = prev.declarer;

    let passCount = 0;
    for (let i = newHistory.length - 1; i >= 0; i--) {
        if (newHistory[i].type === 'Pass') passCount++;
        else break;
    }

    if (newHistory.length === 4 && passCount === 4) {
        nextTurn = prev.dealer;
        return { ...prev, bidHistory: newHistory, turn: nextTurn };
    }

    if (passCount === 3 && newHistory.length >= 4) {
        const lastBidObj = newHistory[newHistory.length - 4];
        if (lastBidObj && lastBidObj.type === 'Bid') {
            nextTurn = lastBidObj.player;
            return { ...prev, bidHistory: newHistory, turn: nextTurn };
        }
    }

    if (passCount === 4 && newHistory.length >= 5) {
        const winningBid = newHistory[newHistory.length - 5];

        if (winningBid && winningBid.type === 'Bid') {
            const winner = winningBid.player;
            const partner = PARTNER[winner];
            const winningSuit = winningBid.suit!;

            const firstBid = newHistory.find(b =>
                b.type === 'Bid' &&
                b.suit === winningSuit &&
                (b.player === winner || b.player === partner)
            );

            const dec = firstBid ? firstBid.player : winner;
            contract = { level: winningBid.level!, suit: winningBid.suit!, declarer: dec };
            declarer = contract.declarer;
            nextPhase = GamePhase.Playing;
            nextTurn = NEXT_TURN[dec];
        }
    }

    return {
        ...prev,
        bidHistory: newHistory,
        turn: nextTurn,
        lastBid: newLastBid,
        phase: nextPhase,
        contract,
        declarer
    };
};

export const processPlayLogic = (prev: GameState, card: Card, position: PlayerPosition): GameState => {
    if (prev.phase !== GamePhase.Playing) return prev;

    let currentTrick = [...prev.currentTrick];
    // Explicitly clone tricksWon to ensure React state updates trigger correctly
    let tricksWon: Record<PlayerPosition, number> = { ...prev.tricksWon };
    let playHistory = [...prev.playHistory];
    let newPhase: GamePhase = prev.phase;
    let winningTeam = prev.winningTeam;

    // LOGIC FIX: If the table is full (4 cards), this "play" action is the Winner of that trick leading the NEXT trick.
    // We must clear the previous trick and update scores BEFORE processing the new card.
    if (currentTrick.length === 4) {
        const winner = getTrickWinner(currentTrick, prev.contract?.suit);
        if (winner) {
            tricksWon[winner] = (tricksWon[winner] || 0) + 1;
            playHistory.push({
                trickNumber: playHistory.length + 1,
                cards: currentTrick,
                winner: winner,
                lead: currentTrick[0].player
            });
        }

        // CRITICAL: Check for game over *immediately* after score update, before new card is placed.
        const totalTricks = Object.values(tricksWon).reduce((a: number, b: number) => a + b, 0);
        if (totalTricks === 13) {
            // This shouldn't typically happen here (13th trick ends in the bottom block), but valid as safety.
            newPhase = GamePhase.Finished;
            const nsTricks = ((tricksWon[PlayerPosition.North] as number) || 0) + ((tricksWon[PlayerPosition.South] as number) || 0);
            const ewTricks = ((tricksWon[PlayerPosition.East] as number) || 0) + ((tricksWon[PlayerPosition.West] as number) || 0);
            const declarerIsNS = [PlayerPosition.North, PlayerPosition.South].includes(prev.contract!.declarer as PlayerPosition);
            const target = 6 + Number(prev.contract!.level);

            if (declarerIsNS) {
                winningTeam = nsTricks >= target ? 'NS' : 'EW';
            } else {
                winningTeam = ewTricks >= target ? 'EW' : 'NS';
            }

            return {
                ...(prev as GameState),
                tricksWon,
                currentTrick: [],
                playHistory,
                phase: newPhase,
                winningTeam,
                readyPlayers: [] // Reset Ready Players
            };
        }

        // If not game over, Clear the table for the new trick
        currentTrick = [];

        // Validation: Ensure the person clearing (playing next) is the winner
        if (position !== winner) return prev;
    } else {
        if (prev.turn !== position) return prev;
    }

    // NOW: Process the new card being played
    const newHand = prev.hands[position].filter(c => c.id !== card.id);
    const newHands = { ...prev.hands, [position]: newHand };
    const newTrick = [...currentTrick, { card, player: position }];

    let nextTurn = NEXT_TURN[position];

    // End of Trick Logic (Standard & Final Trick)
    if (newTrick.length === 4) {
        const winner = getTrickWinner(newTrick, prev.contract?.suit);
        nextTurn = winner!;

        // Logic for the 13th Trick (Game End)
        // Since no one plays a 14th card, we must handle the game end HERE.
        const totalPlayed = playHistory.length + 1;
        if (totalPlayed === 13) {
            // Update score for the final trick immediately
            tricksWon[winner!] = (tricksWon[winner!] || 0) + 1;

            const finalHistory = [...playHistory, {
                trickNumber: 13,
                cards: newTrick,
                winner: winner!,
                lead: newTrick[0].player
            }];

            const nsTricks = ((tricksWon[PlayerPosition.North] as number) || 0) + ((tricksWon[PlayerPosition.South] as number) || 0);
            const ewTricks = ((tricksWon[PlayerPosition.East] as number) || 0) + ((tricksWon[PlayerPosition.West] as number) || 0);
            const declarerIsNS = [PlayerPosition.North, PlayerPosition.South].includes(prev.contract!.declarer as PlayerPosition);
            const target = 6 + Number(prev.contract!.level);
            let wTeam: 'NS' | 'EW' = 'NS';

            if (declarerIsNS) wTeam = nsTricks >= target ? 'NS' : 'EW';
            else wTeam = ewTricks >= target ? 'EW' : 'NS';

            return {
                ...(prev as GameState),
                hands: newHands,
                currentTrick: [], // Clear table immediately for end screen
                tricksWon: tricksWon, // Return updated scores
                playHistory: finalHistory,
                phase: GamePhase.Finished,
                winningTeam: wTeam,
                readyPlayers: [] // Reset Ready Players
            };
        }
    }

    return {
        ...prev,
        hands: newHands,
        currentTrick: newTrick,
        tricksWon: tricksWon, // Ensure updated scores persist
        playHistory: playHistory, // Ensure history persists
        turn: nextTurn
    };
};

export const processSurrender = (prev: GameState, position: PlayerPosition): GameState => {
    const isNS = [PlayerPosition.North, PlayerPosition.South].includes(position);
    const winningTeam = isNS ? 'EW' : 'NS';
    return {
        ...prev,
        phase: GamePhase.Finished,
        winningTeam,
        surrendered: true,
        readyPlayers: [] // Reset Ready Players
    };
};
