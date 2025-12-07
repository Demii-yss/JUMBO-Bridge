import React, { useState, useEffect } from 'react';
import { InteractionType } from '../types';
import { ASSETS } from '../constants';

export interface FlyingItem {
    id: number;
    type: InteractionType;
    fromSlot: string;
    toSlot: string;
    fromPlayer: string; // Add source player ID/Position to track lock
}

export const FlyingItemRenderer: React.FC<{ item: FlyingItem; onComplete: () => void }> = ({ item, onComplete }) => {
    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'absolute',
        opacity: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        transition: 'none'
    });
    const [showEffect, setShowEffect] = useState(false);

    const getCoords = (slot: string) => {
        if (slot === 'bottom') return { top: '85%', left: '50%' };
        if (slot === 'top') return { top: '15%', left: '50%' };
        if (slot === 'left') return { top: '50%', left: '15%' };
        if (slot === 'right') return { top: '50%', left: '85%' };
        return { top: '50%', left: '50%' };
    };

    useEffect(() => {
        const start = getCoords(item.fromSlot);
        const end = getCoords(item.toSlot);

        // Initial State
        setStyle({
            position: 'absolute',
            left: start.left,
            top: start.top,
            transform: 'translate(-50%, -50%) scale(0.5) rotate(0deg)',
            opacity: 0,
            zIndex: 9999,
            pointerEvents: 'none',
            transition: 'none'
        });

        // 1. Fade In
        const timer1 = setTimeout(() => {
            setStyle(prev => ({
                ...prev,
                opacity: 1,
                transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
                transition: 'opacity 0.1s ease-out, transform 0.2s ease-out'
            }));
        }, 50);

        // 2. Fly to Destination
        const timer2 = setTimeout(() => {
            setStyle({
                position: 'absolute',
                left: end.left,
                top: end.top,
                transform: 'translate(-50%, -50%) scale(1.5) rotate(720deg)',
                opacity: 1,
                zIndex: 9999,
                pointerEvents: 'none',
                transition: 'left 1s ease-in-out, top 1s ease-in-out, transform 1s ease-in-out'
            });

            // Just before landing, orient correctly if needed? No, rotation is fine.
        }, 300);

        // 3. Trigger Effect (Landing)
        const timer3 = setTimeout(() => {
            setShowEffect(true);
        }, 1300);

        // 4. Fade Out
        const timer4 = setTimeout(() => {
            setStyle(prev => ({ ...prev, opacity: 0, transition: 'opacity 0.5s ease' }));
        }, 2000);

        // 5. Complete
        const timer5 = setTimeout(onComplete, 2500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
            clearTimeout(timer5);
        };
    }, [item]);

    // Render logic
    const isEgg = item.type === 'EGG';
    const isFlower = item.type === 'FLOWER';

    // Default image
    let mainImg = ASSETS.INTERACTIONS[item.type];

    // If effect is shown and it's an egg, switch to cracked egg
    if (showEffect && isEgg) {
        mainImg = ASSETS.INTERACTIONS['CRACKED_EGG'] || mainImg;
    }

    return (
        <div style={style}>
            <div className="relative">
                {mainImg ? (
                    <img
                        src={mainImg}
                        alt={item.type}
                        className={`w-16 h-16 object-contain drop-shadow-lg transition-transform duration-200 ${showEffect && isEgg ? 'scale-125' : ''}`}
                    />
                ) : '🎁'}

                {/* Flower Sparkles Effect */}
                {showEffect && isFlower && (
                    <div className="absolute inset-0 pointer-events-none">
                        <img src={ASSETS.INTERACTIONS['SPARKLES']} className="absolute -top-4 -left-4 w-8 h-8 animate-ping" style={{ animationDuration: '1s' }} />
                        <img src={ASSETS.INTERACTIONS['SPARKLES']} className="absolute -top-6 left-8 w-6 h-6 animate-pulse" style={{ animationDelay: '0.1s' }} />
                        <img src={ASSETS.INTERACTIONS['SPARKLES']} className="absolute bottom-0 -right-6 w-8 h-8 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                )}
            </div>
        </div>
    );
};
