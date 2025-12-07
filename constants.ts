import { Rank, Suit, PlayerPosition } from './types';






export const RANK_ORDER = [
  Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
  Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace
];

export const SUIT_ORDER = [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades];

export const PLAYER_LABELS = {
  LEFT: '👈',
  RIGHT: '👉',
  PARTNER: '👆',
  ME: '👇'
};

export const NEXT_TURN: Record<PlayerPosition, PlayerPosition> = {
  [PlayerPosition.North]: PlayerPosition.East,
  [PlayerPosition.East]: PlayerPosition.South,
  [PlayerPosition.South]: PlayerPosition.West,
  [PlayerPosition.West]: PlayerPosition.North,
};

export const PARTNER: Record<PlayerPosition, PlayerPosition> = {
  [PlayerPosition.North]: PlayerPosition.South,
  [PlayerPosition.South]: PlayerPosition.North,
  [PlayerPosition.East]: PlayerPosition.West,
  [PlayerPosition.West]: PlayerPosition.East,
};

// Asset URLs (Twemoji)
export const ASSETS = {
  EMOTES: {
    '😀': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f600.png',
    '😂': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f602.png',
    '😎': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f60e.png',
    '😭': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f62d.png',
    '😡': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f621.png',
    '🤔': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f914.png',
  },
  INTERACTIONS: {
    'EGG': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f95a.png',
    'FLOWER': 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f339.png',
  }
};

// Localization
export const TEXT = {
  GAME_TITLE: "Jumbo Bridge",
  SUBTITLE: "多人 P2P 連線",
  NAME_LABEL: "您的暱稱",
  HOST_GAME: "建立房間",
  JOIN_GAME: "加入房間",
  CONNECTING: "連線中...",
  CONNECTED: "已連線！加入中...",
  ROOM_ID: "房主 ID",
  MY_ID: "ID",
  EMPTY_SLOT: "{空位}",
  PHASE: "階段",
  ME: "我",
  COPIED: "已複製!",
  CLICK_TO_COPY: "複製",

  // Actions
  DEAL_CARDS: "發牌",
  RE_DEAL: "重新發牌",
  REQUEST_REDEAL: "重洗",
  READY: "準備",
  PASS: "Pass",
  BID: "喊牌",
  SURRENDER: "🏳️ 投降",
  PLAY_AGAIN: "再來一局",
  DOWNLOAD_LOG: "下載紀錄",

  // Interactions
  CLICK_PLAYER_TO_SEND: "點擊一位玩家發送!",
  EGG: "雞蛋",
  FLOWER: "鮮花",

  // Game Info
  CONTRACT: "合約",
  DECLARER: "莊家",
  TRICKS: "墩數",
  CHECK_HANDS: "確認手牌",
  WAITING_FOR_OTHERS: "等待其他玩家...",
  REDEAL_REQUESTED: "申請重洗",
  REDEALING_IN: "秒後重新發牌...",
  POINTS: "點",

  // Game Over
  VICTORY: "勝利",
  DEFEAT: "失敗",
  GAME_FINISHED: "牌局結束",
  OPPONENT_SURRENDERED: "對手已投降",
  TEAM_NS: "南北家 (North/South)",
  TEAM_EW: "東西家 (East/West)",

  // Positions
  [PlayerPosition.North]: "北",
  [PlayerPosition.East]: "東",
  [PlayerPosition.South]: "南",
  [PlayerPosition.West]: "西",

  // Phases
  PHASE_LOBBY: "大廳",
  PHASE_IDLE: "等待中",
  PHASE_DEALING: "發牌中",
  PHASE_REVIEWING: "看牌",
  PHASE_BIDDING: "喊牌",
  PHASE_PLAYING: "打牌",
  PHASE_FINISHED: "結束",
};