
import React, { useEffect, useRef } from 'react';
import { Bid, PlayerPosition } from '../types';
import { SUIT_COLORS, SUIT_SYMBOLS, TEXT } from '../constants';

interface AuctionBoardProps {
  history: Bid[];
  dealer: PlayerPosition;
}

const AuctionBoard: React.FC<AuctionBoardProps> = ({ history, dealer }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const positions = [PlayerPosition.West, PlayerPosition.North, PlayerPosition.East, PlayerPosition.South];
  const dealerIdx = positions.indexOf(dealer);
  
  const cells: (Bid | null)[] = Array(dealerIdx).fill(null); 
  history.forEach(bid => cells.push(bid));

  return (
    // Width adjusted to fit side-by-side with BiddingBox
    <div className="bg-white/95 rounded-xl shadow-2xl border-4 border-yellow-600 p-2 w-[400px] h-[400px] flex flex-col pointer-events-auto">
      <div className="grid grid-cols-4 gap-1 mb-2 border-b-2 border-gray-300 pb-1 text-center font-bold text-gray-800 text-2xl">
        <div>{TEXT[PlayerPosition.West]}</div>
        <div>{TEXT[PlayerPosition.North]}</div>
        <div>{TEXT[PlayerPosition.East]}</div>
        <div>{TEXT[PlayerPosition.South]}</div>
      </div>
      <div ref={scrollRef} className="overflow-y-auto scrollbar-hide flex-1">
        <div className="grid grid-cols-4 gap-2 text-center text-2xl">
          {cells.map((bid, i) => (
            <div key={i} className="h-12 flex items-center justify-center rounded bg-gray-50 border border-gray-200 shadow-sm">
              {!bid ? (
                <span className="text-gray-300">-</span>
              ) : (
                <span className="font-bold">
                  {bid.type === 'Pass' && <span className="text-green-700">{TEXT.PASS}</span>}
                  {bid.type === 'Bid' && (
                    <span className="flex items-center gap-1">
                      {bid.level}
                      <span className={SUIT_COLORS[bid.suit!]}>
                        {SUIT_SYMBOLS[bid.suit!]}
                      </span>
                    </span>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuctionBoard;
