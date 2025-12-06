
import React from 'react';
import { Bid, PlayerPosition, Suit } from '../types';
import { isValidBid } from '../services/bridgeLogic';
import { SUIT_COLORS, SUIT_SYMBOLS, TEXT } from '../constants';

interface BiddingBoxProps {
  onBid: (bid: Bid) => void;
  history: Bid[];
  player: PlayerPosition;
  disabled?: boolean;
  forceBid?: boolean; // New prop to disable Pass button
}

const BiddingBox: React.FC<BiddingBoxProps> = ({ onBid, history, player, disabled = false, forceBid = false }) => {
  const levels = [1, 2, 3, 4, 5, 6, 7];
  const suits = [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades, 'NT'];

  const handleBidClick = (level: number, suit: Suit | 'NT') => {
    if (disabled) return;
    const bid = { type: 'Bid' as const, level, suit, player };
    if (isValidBid(bid, history)) {
        onBid(bid);
    }
  };

  const handlePass = () => {
      if (disabled || forceBid) return;
      onBid({ type: 'Pass', player });
  };

  const checkValidity = (partialBid: any) => {
      if (disabled) return false;
      return isValidBid({ ...partialBid, player }, history);
  };

  return (
    // Fixed width to sit nicely next to board
    <div className={`bg-stone-800 p-3 rounded-xl shadow-2xl border-2 border-stone-600 w-[400px] pointer-events-auto transition-opacity duration-300 ${disabled ? 'opacity-60 grayscale' : 'opacity-100'}`}>
      {/* Pass Button */}
      <div className="mb-3">
         <button
            onClick={handlePass}
            disabled={disabled || !checkValidity({ type: 'Pass' }) || forceBid}
            className="w-full bg-green-700 hover:bg-green-600 disabled:bg-stone-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg text-2xl tracking-wider shadow-lg"
        >
            {TEXT.PASS}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-1">
        {levels.map((level) => (
          <div key={level} className="grid grid-cols-5 gap-1">
             {suits.map((suit) => {
                 const isValid = checkValidity({ type: 'Bid', level, suit });
                 return (
                    <button
                        key={`${level}${suit}`}
                        onClick={() => handleBidClick(level, suit as Suit | 'NT')}
                        disabled={disabled || !isValid}
                        className={`
                            h-10 rounded flex items-center justify-center text-xl font-bold shadow
                            disabled:opacity-40 disabled:cursor-not-allowed
                            ${disabled && isValid ? 'bg-gray-200' : 'bg-gray-100 hover:bg-white'} 
                            ${!disabled && !isValid ? 'bg-gray-500 opacity-20' : ''}
                            ${SUIT_COLORS[suit as Suit | 'NT']}
                        `}
                    >
                        {level}{SUIT_SYMBOLS[suit as Suit | 'NT']}
                    </button>
                 );
             })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BiddingBox;