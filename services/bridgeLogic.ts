import { Card, Suit, Rank, PlayerPosition, Bid, TrickCard } from '../types';
import { RANK_ORDER, SUIT_ORDER } from '../constants';

export const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  SUIT_ORDER.forEach((suit) => {
    RANK_ORDER.forEach((rank) => {
      deck.push({ suit, rank, id: `${rank}${suit}` });
    });
  });
  return deck;
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const dealCards = (deck: Card[]): Record<PlayerPosition, Card[]> => {
  const hands: Record<PlayerPosition, Card[]> = {
    [PlayerPosition.North]: [],
    [PlayerPosition.East]: [],
    [PlayerPosition.South]: [],
    [PlayerPosition.West]: [],
  };
  
  deck.forEach((card, index) => {
    if (index % 4 === 0) hands[PlayerPosition.North].push(card);
    else if (index % 4 === 1) hands[PlayerPosition.East].push(card);
    else if (index % 4 === 2) hands[PlayerPosition.South].push(card);
    else hands[PlayerPosition.West].push(card);
  });

  // Sort hands
  Object.keys(hands).forEach((key) => {
    const p = key as PlayerPosition;
    hands[p].sort((a, b) => {
      const suitDiff = SUIT_ORDER.indexOf(b.suit) - SUIT_ORDER.indexOf(a.suit);
      if (suitDiff !== 0) return suitDiff;
      return RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank);
    });
  });

  return hands;
};

export const calculateHCP = (hand: Card[]): number => {
  let points = 0;
  hand.forEach(card => {
    if (card.rank === Rank.Jack) points += 1;
    if (card.rank === Rank.Queen) points += 2;
    if (card.rank === Rank.King) points += 3;
    if (card.rank === Rank.Ace) points += 4;
  });
  return points;
};

export const isValidBid = (
  potentialBid: { level?: number; suit?: Suit | 'NT'; type: 'Bid' | 'Pass' },
  history: Bid[]
): boolean => {
  const lastRealBid = [...history].reverse().find(b => b.type === 'Bid');
  
  if (potentialBid.type === 'Pass') return true;

  if (potentialBid.type === 'Bid') {
    if (!potentialBid.level || !potentialBid.suit) return false;
    if (!lastRealBid) return true; // Opening bid
    
    if (potentialBid.level > lastRealBid.level!) return true;
    if (potentialBid.level === lastRealBid.level!) {
      const suits = [...SUIT_ORDER, 'NT'];
      const currentSuitIdx = suits.indexOf(potentialBid.suit as any);
      const lastSuitIdx = suits.indexOf(lastRealBid.suit as any);
      return currentSuitIdx > lastSuitIdx;
    }
    return false;
  }

  return false;
};

export const isAuctionFinished = (history: Bid[]): boolean => {
  if (history.length < 4) return false;
  const lastThree = history.slice(-3);
  return lastThree.every(b => b.type === 'Pass');
};

export const formatHandForAI = (hand: Card[]): string => {
    const suits: Record<string, string[]> = { S: [], H: [], D: [], C: [] };
    hand.forEach(card => suits[card.suit].push(card.rank));
    return `Spades: ${suits['S'].join(',') || '-'} | Hearts: ${suits['H'].join(',') || '-'} | Diamonds: ${suits['D'].join(',') || '-'} | Clubs: ${suits['C'].join(',') || '-'}`;
};

// --- Playing Phase Logic ---

const getRankValue = (rank: Rank): number => {
    return RANK_ORDER.indexOf(rank);
};

export const canPlayCard = (
    card: Card, 
    hand: Card[], 
    currentTrick: TrickCard[]
): boolean => {
    // CRITICAL FIX: If trick is full (4 cards), it is effectively empty because
    // the winner is about to clear it and lead a NEW trick.
    if (currentTrick.length === 0 || currentTrick.length === 4) return true;

    const leadCard = currentTrick[0].card;
    const leadSuit = leadCard.suit;

    // If card follows suit, it's valid
    if (card.suit === leadSuit) return true;

    // If card doesn't follow suit, check if player HAS the lead suit
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    
    // If they have the suit, they MUST play it (so this card is invalid)
    if (hasLeadSuit) return false;

    // If they don't have the suit, they can play anything (slough or trump)
    return true;
};

export const getTrickWinner = (
    trick: TrickCard[], 
    trumpSuit: Suit | 'NT' | undefined
): PlayerPosition | null => {
    if (!trick || trick.length === 0) return null;

    const leadSuit = trick[0].card.suit;
    let bestCard = trick[0];
    
    for (let i = 1; i < trick.length; i++) {
        const current = trick[i];
        
        // Check if current beats best
        const isTrump = trumpSuit !== 'NT' && current.card.suit === trumpSuit;
        const isBestTrump = trumpSuit !== 'NT' && bestCard.card.suit === trumpSuit;
        
        if (isTrump && !isBestTrump) {
            bestCard = current;
        } else if (isTrump && isBestTrump) {
            if (getRankValue(current.card.rank) > getRankValue(bestCard.card.rank)) {
                bestCard = current;
            }
        } else if (!isBestTrump && current.card.suit === leadSuit) {
             if (getRankValue(current.card.rank) > getRankValue(bestCard.card.rank)) {
                bestCard = current;
            }
        }
    }

    return bestCard.player;
};