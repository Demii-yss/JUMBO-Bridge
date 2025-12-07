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
}

const InteractionOverlay: React.FC<InteractionOverlayProps> = memo(({
    isPortrait,
    showEmotePicker,
    setShowEmotePicker,
    showItemPicker,
    setShowItemPicker,
    selectedItemType,
    setSelectedItemType,
    handleEmote
}) => {
    return (
        <div className={`absolute z-50 flex gap-4 pointer-events-auto ${isPortrait ? 'top-[2vmin] left-[2vmin] flex-col' : 'bottom-[2vmin] right-[2vmin] flex-row'}`}>
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
                    <div className={`absolute ${isPortrait ? 'top-full mt-2 left-0' : 'bottom-20 right-0'} bg-white p-2 rounded-xl shadow-2xl grid grid-cols-3 gap-2 w-64 border-4 border-blue-600 animate-fade-in-up z-50`}>
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
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowItemPicker(!showItemPicker);
                        setSelectedItemType(null);
                        setShowEmotePicker(false);
                    }}
                    className={`w-16 h-16 rounded-full border-4 border-white shadow-xl flex items-center justify-center transition ${selectedItemType ? 'bg-red-800 animate-pulse' : 'bg-red-600 hover:bg-red-500'}`}
                >
                    <img src={ASSETS.INTERACTIONS['FLOWER']} className="w-10 h-10 object-contain" alt="gift" />
                </button>
                {showItemPicker && !selectedItemType && (
                    <div className={`absolute ${isPortrait ? 'top-full mt-2 left-0' : 'bottom-20 right-0'} bg-white p-2 rounded-xl shadow-2xl flex flex-col gap-2 w-48 border-4 border-red-600 animate-fade-in-up z-50`}>
                        <button onClick={() => { setSelectedItemType('EGG'); setShowItemPicker(false); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-4">
                            <img src={ASSETS.INTERACTIONS['EGG']} className="w-12 h-12" alt="egg" />
                            <span className="text-lg font-bold text-black">{TEXT.EGG}</span>
                        </button>
                        <button onClick={() => { setSelectedItemType('FLOWER'); setShowItemPicker(false); }} className="p-2 hover:bg-gray-100 rounded flex items-center gap-4">
                            <img src={ASSETS.INTERACTIONS['FLOWER']} className="w-12 h-12" alt="flower" />
                            <span className="text-lg font-bold text-black">{TEXT.FLOWER}</span>
                        </button>
                    </div>
                )}
                {selectedItemType && (
                    <div className={`absolute ${isPortrait ? 'top-full mt-2 left-0' : 'bottom-20 right-0'} bg-black/80 text-white p-2 rounded-lg whitespace-nowrap font-bold text-lg`}>
                        {TEXT.CLICK_PLAYER_TO_SEND}
                    </div>
                )}
            </div>
        </div>
    );
});

export default InteractionOverlay;
