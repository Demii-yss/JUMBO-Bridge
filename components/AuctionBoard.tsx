import React, { useEffect, useRef } from 'react';
import { Bid, PlayerPosition } from '../types';
import { TEXT, PLAYER_LABELS } from '../constants';
import { SUIT_COLORS, SUIT_SYMBOLS, COLORS } from '../colors';

interface AuctionBoardProps {
  history: Bid[];
  dealer: PlayerPosition;
  myPosition: PlayerPosition | null;
  isPortrait?: boolean;
}

const AuctionBoard: React.FC<AuctionBoardProps> = ({ history, dealer, myPosition, isPortrait }) => {
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

  const getArrowForColumn = (colIdx: number) => {
    if (!myPosition) return '−'; // Fallback
    const targetPos = positions[colIdx];

    const nextOf: Record<string, PlayerPosition> = {
      [PlayerPosition.North]: PlayerPosition.East,
      [PlayerPosition.East]: PlayerPosition.South,
      [PlayerPosition.South]: PlayerPosition.West,
      [PlayerPosition.West]: PlayerPosition.North,
    };

    if (targetPos === myPosition) return PLAYER_LABELS.ME;
    // Visual Left (Clockwise Next)
    if (nextOf[myPosition] === targetPos) return PLAYER_LABELS.LEFT;
    // Partner (Opposite)
    if (nextOf[nextOf[myPosition]] === targetPos) return PLAYER_LABELS.PARTNER;
    // Visual Right (Counter-Clockwise Next)
    return PLAYER_LABELS.RIGHT;
  };

  // Portrait: 28vh
  // Landscape: 320px (80% of previous 400px)
  const heightClass = isPortrait ? 'h-[28vh]' : 'h-[320px]';

  return (
    // Width adjusted to fit side-by-side with BiddingBox, Height dynamic
    <div className={`bg-white/95 rounded-xl shadow-2xl border-4 border-yellow-600 p-2 ${isPortrait ? 'w-[90vw] max-w-[400px]' : 'w-[300px]'} ${heightClass} flex flex-col pointer-events-auto transition-all duration-300`}>
      <div className="grid grid-cols-4 gap-1 mb-2 border-b-2 border-gray-300 pb-1 text-center font-bold text-gray-800 text-2xl">
        {positions.map((_, i) => (
          <div key={i}>{getArrowForColumn(i)}</div>
        ))}
      </div>
      <div ref={scrollRef} className="overflow-y-auto scrollbar-hide flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                      <span className="text-slate-900 font-bold">{bid.level}</span>
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
