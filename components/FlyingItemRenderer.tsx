import React, { useState, useEffect } from 'react';
import { InteractionType } from '../types';
import { ASSETS } from '../constants';

export interface FlyingItem {
    id: number;
    type: InteractionType;
    fromSlot: string;
    toSlot: string;
}

export const FlyingItemRenderer: React.FC<{ item: FlyingItem; onComplete: () => void }> = ({ item, onComplete }) => {
    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'absolute',
        opacity: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        transition: 'none'
    });

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

        const timer1 = setTimeout(() => {
            setStyle(prev => ({
                ...prev,
                opacity: 1,
                transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
                transition: 'opacity 0.1s ease-out, transform 0.2s ease-out'
            }));
        }, 50);

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
        }, 300);

        const timer3 = setTimeout(() => {
            setStyle(prev => ({ ...prev, opacity: 0, transition: 'opacity 0.2s ease' }));
        }, 1300);

        const timer4 = setTimeout(onComplete, 1500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [item]);

    const imgSrc = ASSETS.INTERACTIONS[item.type];

    return (
        <div style={style}>
            {imgSrc ? <img src={imgSrc} alt={item.type} className="w-16 h-16 object-contain drop-shadow-lg" /> : '🎁'}
        </div>
    );
};
