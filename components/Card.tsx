import React, { useState, useRef } from 'react';
import { Card as CardType } from '../types';
import { SUIT_COLORS, SUIT_SYMBOLS } from '../constants';

interface CardProps {
  card?: CardType;
  className?: string;
  onClick?: () => void;
  mini?: boolean;
  disabled?: boolean;     // For cards that cannot be played (darkened)
  highlighted?: boolean;  // For the winning card on the table
  isTrump?: boolean;      // For highlighting trump cards in hand
}

const Card: React.FC<CardProps> = ({
  card,
  className = '',
  onClick,
  mini = false,
  disabled = false,
  highlighted = false,
  isTrump = false
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Interaction Handlers for "Hold to confirm"
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || !onClick || !card) return;
    if (e.button !== 0) return; // Only left click
    setIsPressed(true);
  };

  const handleMouseUp = () => {
    if (isPressed && !disabled && onClick) {
      onClick();
    }
    setIsPressed(false);
  };

  const handleMouseLeave = () => {
    // Cancel action if mouse leaves the card before releasing
    setIsPressed(false);
  };

  if (!card) {
    // Card Back
    return (
      <div
        className={`bg-blue-800 rounded-xl border-4 border-white relative overflow-hidden shadow-md ${className} ${mini ? 'w-[8vmin] h-[11vmin]' : 'w-[14vmin] h-[20vmin]'}`}
      >
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]"></div>
      </div>
    );
  }

  const colorClass = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];

  // Style for "Dimmed" / Invalid
  const opacityClass = disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'opacity-100 cursor-pointer hover:z-50';

  // Style for "Pressed" (Holding down)
  const pressClass = isPressed ? 'scale-110 -translate-y-6 ring-4 ring-yellow-400 z-50' : 'hover:-translate-y-6';

  // Style for "Highlight" (Winning card on table)
  const highlightClass = highlighted ? 'ring-8 ring-yellow-400 scale-110 z-20 shadow-[0_0_30px_rgba(250,204,21,0.8)]' : '';

  // Style for Trump in hand
  const trumpClass = isTrump && !disabled ? 'border-yellow-400 border-4' : 'border-gray-300';

  if (mini) {
    return (
      <div className={`bg-white rounded border flex items-center justify-center ${colorClass} w-[8vmin] h-[10vmin] font-bold text-[3vmin] shadow-sm ${className}`}>
        {card.rank}{symbol}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`
        bg-white rounded-[1.5vmin] select-none transition-all duration-150 ease-out
        w-[14vmin] h-[20vmin]
        border-2 shadow-2xl
        relative
        ${colorClass}
        ${opacityClass}
        ${!disabled && !highlighted ? pressClass : ''}
        ${highlighted ? '' : 'hover:shadow-2xl'} 
        ${highlightClass}
        ${trumpClass}
        ${className}
      `}
    >
      {/* Corner Index (Top Left) */}
      <div className="absolute top-[1vmin] left-[1vmin] flex flex-col items-center leading-none p-1">
        <span className="text-[4vmin] font-bold tracking-tighter">{card.rank}</span>
        <span className="text-[4vmin] mt-1">{symbol}</span>
      </div>

      {/* Center Symbol (Decorative) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
        <span className="text-[12vmin]">{symbol}</span>
      </div>

      {/* Corner Index (Bottom Right - Inverted) */}
      <div className="absolute bottom-[1vmin] right-[1vmin] flex flex-col items-center leading-none p-1 rotate-180">
        <span className="text-[4vmin] font-bold tracking-tighter">{card.rank}</span>
        <span className="text-[4vmin] mt-1">{symbol}</span>
      </div>
    </div>
  );
};

export default React.memo(Card);