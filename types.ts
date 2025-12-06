
export enum Suit {
  Clubs = 'C',
  Diamonds = 'D',
  Hearts = 'H',
  Spades = 'S',
}

export enum Rank {
  Two = '2', Three = '3', Four = '4', Five = '5', Six = '6', Seven = '7',
  Eight = '8', Nine = '9', Ten = 'T', Jack = 'J', Queen = 'Q', King = 'K', Ace = 'A',
}

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // Unique ID for React keys
}

export enum PlayerPosition {
  North = 'North',
  East = 'East',
  South = 'South',
  West = 'West',
}

export enum GamePhase {
  Lobby = 'Lobby',
  Idle = 'Idle',
  Dealing = 'Dealing',
  Reviewing = 'Reviewing',
  Bidding = 'Bidding',
  Playing = 'Playing',
  Finished = 'Finished',
}

export interface Bid {
  level?: number;
  suit?: Suit | 'NT';
  type: 'Bid' | 'Pass';
  player: PlayerPosition;
  alert?: boolean;
  explanation?: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  position: PlayerPosition;
  isHost: boolean;
}

export interface TrickCard {
  card: Card;
  player: PlayerPosition;
}

export interface PlayLog {
    trickNumber: number;
    cards: TrickCard[];
    winner: PlayerPosition;
    lead: PlayerPosition;
}

export interface GameState {
  phase: GamePhase;
  hands: Record<PlayerPosition, Card[]>;
  dealer: PlayerPosition;
  turn: PlayerPosition;
  vulnerability: { ns: boolean; ew: boolean };
  bidHistory: Bid[];
  lastBid: Bid | null;
  contract: { level: number; suit: Suit | 'NT'; declarer: PlayerPosition } | null;
  declarer: PlayerPosition | null;
  players: PlayerProfile[];
  readyPlayers: PlayerPosition[];
  
  // Playing Phase State
  currentTrick: TrickCard[];
  tricksWon: Record<PlayerPosition, number>; 
  playHistory: PlayLog[]; // For End Game Summary
  
  // End Game State
  winningTeam?: 'NS' | 'EW';
  surrendered?: boolean;
}

export type InteractionType = 'EGG' | 'FLOWER';

// Network Messages
export type NetworkMessage = 
  | { type: 'JOIN_REQUEST'; name: string }
  | { type: 'JOIN_ACCEPT'; state: GameState; yourPosition: PlayerPosition }
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'ACTION_BID'; bid: Bid }
  | { type: 'ACTION_DEAL' }
  | { type: 'ACTION_REQUEST_REDEAL'; position: PlayerPosition; points?: number }
  | { type: 'ACTION_MESSAGE'; message: string }
  | { type: 'ACTION_READY'; position: PlayerPosition }
  | { type: 'ACTION_PLAY'; card: Card; position: PlayerPosition }
  | { type: 'ACTION_SURRENDER'; position: PlayerPosition }
  | { type: 'ACTION_RESTART' }
  // Interactions (Not part of game state/history)
  | { type: 'ACTION_EMOTE'; emoji: string; position: PlayerPosition }
  | { type: 'ACTION_INTERACTION'; interactionType: InteractionType; from: PlayerPosition; to: PlayerPosition };