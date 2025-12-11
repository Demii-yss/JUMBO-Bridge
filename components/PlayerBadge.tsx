import React from 'react';
import { PlayerPosition, PlayerProfile, GamePhase } from '../types';
import { TEXT, ASSETS } from '../constants';

interface PlayerBadgeProps {
    pos: PlayerPosition;
    profile: PlayerProfile | undefined;
    isTurn: boolean;
    isActive: boolean;
    isDeclarer: boolean;
    isSideBadge: boolean;
    tricksWon: number;
    gamePhase: GamePhase;
    activeEmote: string | undefined;
    showInteractionHighlight: boolean;
    handleInteraction: (pos: PlayerPosition) => void;
    uniqueNames: Record<string, string>;
    isPortrait: boolean;
    slot: string;
    isReady?: boolean;
    onClickAction?: () => void;
}

const PlayerBadge: React.FC<PlayerBadgeProps> = ({
    pos,
    profile,
    isActive,
    isDeclarer,
    isSideBadge,
    tricksWon,
    gamePhase,
    activeEmote,
    showInteractionHighlight,
    handleInteraction,
    uniqueNames,
    isPortrait,
    slot,
    isReady,
    onClickAction
}) => {
    let badgeClass = 'pointer-events-auto z-50 text-white font-bold border-2 border-stone-600 shadow-xl backdrop-blur-md rounded-lg px-6 py-2 transition-all cursor-pointer relative';
    badgeClass += ` text-[2.5vmin]`; // Fluid Font Size

    if (isSideBadge) badgeClass += ' flex flex-col items-center justify-center gap-1';
    else badgeClass += ' flex items-center gap-2';

    if (isActive) badgeClass += ' ring-4 ring-amber-500 bg-stone-700 scale-110';
    else badgeClass += ' bg-stone-800/80';

    const displayName = profile ? uniqueNames[profile.id] : TEXT.EMPTY_SLOT;
    const nameColor = isDeclarer ? 'text-yellow-400' : 'text-white';

    const isHiddenSelf = isPortrait && slot === 'bottom';
    if (isHiddenSelf) badgeClass += ' invisible'; // Hide the badge itself but keep layout

    if (showInteractionHighlight) badgeClass += ' ring-4 ring-red-500 bg-red-900/50 scale-110 animate-pulse';

    // Offline Status Logic
    const isOffline = profile && profile.connected === false;
    let finalDisplayName = displayName;
    if (isOffline) {
        finalDisplayName += ' (Offline)';
        badgeClass += ' opacity-50 grayscale'; // Visual indication
    }

    // Emote Positioning Logic
    const isPartnerTop = isPortrait && slot === 'top';
    const emotePositionClass = isPartnerTop
        ? 'top-full'
        : 'bottom-full'; // Default: Above the badge (for self and others)

    const arrowPositionClass = isPartnerTop
        ? '-top-[16px] border-b-[16px] border-b-white'
        : 'bottom-[-16px] border-t-[16px] border-t-white';

    // Ready Status Indicator (GamePhase.Lobby or Finished)
    const showReadyStatus = (gamePhase === GamePhase.Lobby || gamePhase === GamePhase.Finished) && profile && profile.connected !== false;

    // Counter-Rotation for Tricks Won AND Emotes (to fix orientation when badge is rotated)
    let tricksRotationClass = '';
    let emoteRotationClass = '';

    if (slot === 'left') {
        tricksRotationClass = '-rotate-90';
        emoteRotationClass = '-rotate-90';
    }
    if (slot === 'right') {
        tricksRotationClass = 'rotate-90';
        emoteRotationClass = 'rotate-90';
    }

    return (
        <div className={badgeClass} onClick={(e) => {
            if (showInteractionHighlight && profile) {
                e.stopPropagation();
                handleInteraction(pos); // Prioritize Interaction
                return;
            }
            if (onClickAction) {
                e.stopPropagation();
                onClickAction(); // Trigger Action (e.g. Remove Bot)
            }
        }}>
            <div className={`whitespace-nowrap ${nameColor}`}>{finalDisplayName}</div>

            {/* Ready Status Badge */}
            {showReadyStatus && (
                <div className={`absolute ${isSideBadge || (slot === 'bottom' && !isPortrait) ? 'bottom-full mb-2' : 'left-full ml-3'} flex items-center justify-center`}>
                    {profile?.isHost ? (
                        <div className="px-3 py-1 rounded-full font-bold text-sm shadow-md border-2 border-white bg-amber-500 text-black">
                            👑 HOST
                        </div>
                    ) : (
                        <div className={`px-3 py-1 rounded-full font-bold text-sm shadow-md border-2 border-white ${isReady ? 'bg-green-600 text-white' : 'bg-gray-600/80 text-gray-200'}`}>
                            {isReady ? 'READY' : 'WAITING'}
                        </div>
                    )}
                </div>
            )}

            {tricksWon > 0 && gamePhase === GamePhase.Playing && (
                <div className={`bg-yellow-500 text-black font-bold w-[4vmin] h-[4vmin] rounded-full flex items-center justify-center border-2 border-white shadow-lg text-[2vmin] ${isSideBadge ? 'mt-1' : 'ml-3'} ${tricksRotationClass}`}>
                    {tricksWon}
                </div>
            )}


            {activeEmote && (
                <div className={`absolute left-1/2 -translate-x-1/2 z-50 visible flex flex-col items-center ${emotePositionClass} ${emoteRotationClass}`}>
                    <div className="bg-white rounded-2xl p-2 shadow-2xl border-4 border-blue-500 animate-bounce aspect-square w-[80px] h-[80px] flex items-center justify-center relative">
                        <img src={ASSETS.EMOTES[activeEmote]} className="w-full h-full object-contain" alt="emote" />
                        <div className={`absolute left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-transparent ${arrowPositionClass}`}></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerBadge;
