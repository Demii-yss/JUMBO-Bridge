import { Suit } from './types';

export const SUIT_SYMBOLS: Record<Suit | 'NT', string> = {
    [Suit.Clubs]: '♣',
    [Suit.Diamonds]: '♦',
    [Suit.Hearts]: '♥',
    [Suit.Spades]: '♠',
    'NT': 'NT'
};

export const SUIT_COLORS: Record<Suit | 'NT', string> = {
    [Suit.Clubs]: 'text-slate-900',
    [Suit.Diamonds]: 'text-red-600',
    [Suit.Hearts]: 'text-red-600',
    [Suit.Spades]: 'text-slate-900',
    'NT': 'text-blue-800'
};

export const SUIT_COLORS_LIGHT: Record<Suit | 'NT', string> = {
    [Suit.Clubs]: 'text-gray-200',
    [Suit.Diamonds]: 'text-red-400',
    [Suit.Hearts]: 'text-red-400',
    [Suit.Spades]: 'text-white',
    'NT': 'text-cyan-300'
};



export const COLORS = {
    // Backgrounds
    TABLE_BG: 'bg-[#1a472a]',
    LOBBY_BG: 'bg-stone-900',
    PANEL_BG: 'bg-stone-800',
    INPUT_BG: 'bg-stone-900',

    // Text
    TEXT_PRIMARY: 'text-white',
    TEXT_SECONDARY: 'text-gray-300',
    TEXT_MUTED: 'text-gray-500',
    TEXT_ACCENT: 'text-yellow-500',
    TEXT_ERROR: 'text-red-500',
    TEXT_DISABLED_RED: 'text-[#d46666]', // Desaturated reddish text for disabled hearts/diamonds
    TEXT_DISABLED_BLACK: 'text-gray-600',   // Gray text for disabled clubs/spades


    // Borders
    BORDER_MAIN: 'border-stone-700',
    BORDER_ACCENT: 'border-yellow-500',

    // Buttons
    BTN_PRIMARY: 'bg-yellow-600 hover:bg-yellow-500 text-black',
    BTN_SECONDARY: 'bg-blue-700 hover:bg-blue-600 text-white',
    BTN_SUCCESS: 'bg-green-700 hover:bg-green-600 text-white',
    BTN_DANGER: 'bg-red-600 hover:bg-red-700 text-white',
    BTN_DISABLED: 'disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed',

    // UI Elements
    GAME_TITLE: 'text-yellow-500',

    // Card Styles
    CARD: {
        BACK_BG: 'bg-[#dbdcff]',
        BACK_BORDER: 'border-[#9596ba]',
        FRONT_BG: 'bg-[#ffffff]',
        BORDER_NORMAL: 'border-[#d1d5db]',
        BORDER_TRUMP: 'border-[#4f46e5] bg-[#ffffff]',
        RING_HIGHLIGHT: 'ring-[#facc15] border-[#ffffff]',
        SHADOW_HIGHLIGHT: '',
        DISABLED_STYLE: 'bg-gray-300 cursor-not-allowed', // Fallback
        DISABLED_RED: 'bg-gray-300 cursor-not-allowed', // Solid gray, Red text applied via text color class
        DISABLED_BLACK: 'bg-gray-300 cursor-not-allowed', // Solid gray, Gray text applied via text color class
        DISABLED_BG: 'bg-gray-300' // Shared Constant
    }
};
