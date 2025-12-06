import React from 'react';
import { Card as CardType, PlayerPosition, TrickCard, Suit } from '../types';
import { canPlayCard } from '../services/bridgeLogic';
import Card from './Card';

interface PlayerHandProps {
  cards: CardType[];
  position: PlayerPosition;
  isFaceUp: boolean;
  vertical?: boolean;
  // New props for playing phase
  currentTrick?: TrickCard[];
  isMyTurn?: boolean;
  onPlayCard?: (card: CardType) => void;
  trumpSuit?: Suit | 'NT';
  scale?: number; // Added scale prop support
}

const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  position,
  isFaceUp,
  vertical = false,
  currentTrick,
  isMyTurn,
  onPlayCard,
  trumpSuit,
  scale = 1
}) => {
  // FIX: Do not fall back to Array(13). If cards is empty [], it should render nothing.
  // We only default to empty array if cards is strictly undefined/null.
  const displayCards = cards || [];

  return (
    <div
      className={`flex justify-center items-center pointer-events-none relative
            ${vertical ? 'flex-col h-[70vmin] w-[20vmin]' : 'flex-row w-full h-[25vmin]'}
        `}
      style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}
    >
      {displayCards.map((card, index) => {
        const zIndex = index;

        // Validation Logic
        let isValid = true;
        let isTrump = false;

        if (isFaceUp && card) {
          // Highlight Trump
          if (trumpSuit && trumpSuit !== 'NT' && card.suit === trumpSuit) {
            isTrump = true;
          }

          // Check if play is valid
          if (currentTrick && isMyTurn) {
            isValid = canPlayCard(card, cards, currentTrick);
          }
        }

        let style: React.CSSProperties = {
          position: 'absolute',
          zIndex: zIndex,
          transition: 'all 0.3s ease-out'
        };

        // Layout calculations
        const count = displayCards.length;
        const cardSize = vertical ? 17.5 : 14;

        let overlap = vertical ? 3.5 : 5.5;

        // Squeeze logic (Width)
        const maxW = 90;
        const requiredW = cardSize + (count - 1) * overlap;

        if (!vertical && requiredW > maxW) {
          overlap = (maxW - cardSize) / (count - 1);
        }

        // Vertical Squeeze Logic (Height constraint)
        const maxH = 65;
        if (vertical) {
          // Check if vertical stack exceeds height
          // For rotated cards (side hands), the effective height is the card's width (8vmin)
          // Wait, card width is 14vmin for normal card? No.
          // Card.tsx: mini ? 'w-[8vmin] h-[11vmin]' : 'w-[14vmin] h-[20vmin]'
          // If !isFaceUp (hidden side hand), it is mini=true?
          // PlayerHand line 131: mini={vertical && !isFaceUp}
          // If vertical side hand, it is `mini`. So `w-[8vmin]`.
          // Rotated 90deg, the visual height is 8vmin. Correct.

          const cardEffectiveHeight = 8;
          const requiredH = (count - 1) * overlap + cardEffectiveHeight;
          if (requiredH > maxH) {
            overlap = (maxH - cardEffectiveHeight) / (count - 1);
          }
        }

        if (vertical) {
          style.top = `${index * overlap}vmin`;
          style.left = '50%';
          // Rotate 90 degrees for side cards so they lie horizontally
          style.transform = 'translateX(-50%) rotate(90deg)';
        } else {
          // Horizontal centering
          style.left = `calc(50% - ${cardSize}vmin / 2 - ${(count - 1) * overlap}vmin / 2 + ${index * overlap}vmin)`;
        }

        return (
          <div key={card?.id || index} style={style} className="pointer-events-auto origin-center hover:scale-110 transition-transform">
            <Card
              card={isFaceUp ? card : undefined}
              mini={vertical && !isFaceUp}
              disabled={isFaceUp && isMyTurn && !isValid}
              isTrump={isTrump}
              onClick={isFaceUp && isMyTurn && isValid && onPlayCard ? () => onPlayCard(card) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
};

export default PlayerHand;