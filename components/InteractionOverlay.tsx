import React, { memo } from 'react';
import { TEXT, ASSETS } from '../constants';
import { InteractionType } from '../types';

interface InteractionOverlayProps {
    isPortrait: boolean;
    showEmotePicker: boolean;
    setShowEmotePicker: (show: boolean) => void;
    showItemPicker: boolean;
    setShowItemPicker: (show: boolean) => void;
    selectedItemType: InteractionType | null;
    setSelectedItemType: (type: InteractionType | null) => void;
    handleEmote: (emoji: string) => void;
    activeInteractionType: InteractionType;
    setActiveInteractionType: (type: InteractionType) => void;
    onDropInteraction: (type: InteractionType, x: number, y: number) => void;
    isLocked: boolean;
}

const InteractionOverlay: React.FC<InteractionOverlayProps> = memo(({
    isPortrait,
    showEmotePicker,
    setShowEmotePicker,
    showItemPicker,
    setShowItemPicker,
    selectedItemType,
    setSelectedItemType,
    handleEmote,
    activeInteractionType,
    setActiveInteractionType,
    onDropInteraction,
    isLocked
}) => {
    // Drag State
    const [isDragging, setIsDragging] = React.useState(false); // Used for UI only (Ghost icon)
    const [dragPos, setDragPos] = React.useState({ x: 0, y: 0 });
    const dragStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const hasDraggedRef = React.useRef(false); // Used to differentiate click vs drag
    const isDraggingRef = React.useRef(false); // Used for event listener logic to avoid stale state

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isLocked) return;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        hasDraggedRef.current = false;
        isDraggingRef.current = false;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        // Local move (maybe not needed if global handles it?)
    };

    // Global pointer move/up handler
    React.useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (!dragStartRef.current) return;

            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;

            // Check threshold to start dragging
            // Note: We use isDraggingRef to avoid dependency churn in useEffect
            if (!isDraggingRef.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                isDraggingRef.current = true;
                hasDraggedRef.current = true;
                setIsDragging(true); // Trigger UI update (Ghost Icon)
            }

            if (isDraggingRef.current) {
                setDragPos({ x: e.clientX, y: e.clientY });
            }
        };

        const onUp = (e: PointerEvent) => {
            if (dragStartRef.current && isDraggingRef.current) {
                onDropInteraction(activeInteractionType, e.clientX, e.clientY);
            }

            // Cleanup
            isDraggingRef.current = false;
            setIsDragging(false);
            dragStartRef.current = null;

            // Allow click handler to run if it wasn't a drag
            // We don't reset hasDraggedRef here immediately because handleClick fires after onUp
            setTimeout(() => { hasDraggedRef.current = false; }, 50);
        };

        const onLeave = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
                setIsDragging(false);
            }
            dragStartRef.current = null;
            hasDraggedRef.current = false;
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        document.addEventListener('mouseleave', onLeave);

        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            document.removeEventListener('mouseleave', onLeave);
        };
    }, [activeInteractionType, onDropInteraction]); // Removed isDragging/state setters dependencies to keep Effect stable

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLocked) return;
        // If we strictly dragged, ignore the click
        if (hasDraggedRef.current) return;

        setShowItemPicker(!showItemPicker);
        setSelectedItemType(null);
        setShowEmotePicker(false);
    };

    return (
        <>
            {/* Ghost Icon for Dragging */}
            {isDragging && (
                <div
                    className="fixed z-[100] pointer-events-none opacity-80"
                    style={{ left: dragPos.x, top: dragPos.y, transform: 'translate(-50%, -50%)' }}
                >
                    <img src={ASSETS.INTERACTIONS[activeInteractionType]} className="w-16 h-16 object-contain" alt="drag-ghost" />
                </div>
            )}

            <div className={`absolute z-[60] flex gap-4 pointer-events-auto top-[2vmin] left-[2vmin] flex-row`}>
                {/* Blue Frame - Emotes */}
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowEmotePicker(!showEmotePicker);
                            setShowItemPicker(false);
                        }}
                        className="w-16 h-16 rounded-full bg-blue-600 border-4 border-white shadow-xl flex items-center justify-center hover:bg-blue-500 transition"
                    >
                        <img src={ASSETS.EMOTES['😀']} className="w-10 h-10 object-contain" alt="emote" />
                    </button>
                    {showEmotePicker && (
                        <div className={`absolute top-full mt-2 left-0 bg-white p-2 rounded-xl shadow-2xl grid grid-cols-3 gap-2 w-64 border-4 border-blue-600 animate-fade-in-up z-50`}>
                            {Object.keys(ASSETS.EMOTES).map(emoji => (
                                <button key={emoji} onClick={() => handleEmote(emoji)} className="p-2 hover:bg-gray-100 rounded flex justify-center">
                                    <img src={ASSETS.EMOTES[emoji]} className="w-12 h-12 object-contain" alt={emoji} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Red Frame - Interactions */}
                <div className="relative">
                    <div
                        onPointerDown={handlePointerDown}
                        onClick={handleClick}
                        className={`w-16 h-16 rounded-full border-4 border-white shadow-xl flex items-center justify-center transition cursor-pointer select-none touch-none 
                            ${selectedItemType ? 'bg-red-800 animate-pulse' : 'bg-red-600 hover:bg-red-500'}
                            ${isLocked ? 'grayscale opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        <img src={ASSETS.INTERACTIONS[activeInteractionType]} className="w-10 h-10 object-contain pointer-events-none" alt="gift" />
                    </div>
                    {showItemPicker && !selectedItemType && (
                        <div className={`absolute top-full mt-2 left-0 bg-white p-2 rounded-xl shadow-2xl flex flex-col gap-2 w-48 border-4 border-red-600 animate-fade-in-up z-50`}>
                            <button onClick={() => { setActiveInteractionType('EGG'); setSelectedItemType('EGG'); setShowItemPicker(false); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-4">
                                <img src={ASSETS.INTERACTIONS['EGG']} className="w-12 h-12" alt="egg" />
                                <span className="text-lg font-bold text-black">{TEXT.EGG}</span>
                            </button>
                            <button onClick={() => { setActiveInteractionType('FLOWER'); setSelectedItemType('FLOWER'); setShowItemPicker(false); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-4">
                                <img src={ASSETS.INTERACTIONS['FLOWER']} className="w-12 h-12" alt="flower" />
                                <span className="text-lg font-bold text-black">{TEXT.FLOWER}</span>
                            </button>
                        </div>
                    )}
                    {selectedItemType && (
                        <div className={`absolute top-full mt-2 left-0 bg-black/80 text-white p-2 rounded-lg whitespace-nowrap font-bold text-lg`}>
                            {TEXT.CLICK_PLAYER_TO_SEND}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
});

export default InteractionOverlay;
