import React, { useState, useEffect } from 'react';
import { COLORS } from '../colors';
import { TEXT } from '../constants';

interface LobbyScreenProps {
    playerId: string;
    onLogout: () => void;
    onJoinRoom: (roomNumber: number) => void;
    playerName: string;
    setPlayerName: (name: string) => void;
    checkLobbyStats: () => void;
    roomCounts: Record<string, number>;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
    playerId,
    onLogout,
    onJoinRoom,
    playerName,
    setPlayerName,
    checkLobbyStats,
    roomCounts
}) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [localName, setLocalName] = useState(playerName);

    useEffect(() => {
        setLocalName(playerName);
    }, [playerName]);

    // Polling Effect
    useEffect(() => {
        checkLobbyStats(); // Initial check
        const interval = setInterval(() => {
            checkLobbyStats();
        }, 3000);

        return () => clearInterval(interval);
    }, [checkLobbyStats]);


    const handleSaveName = () => {
        if (localName.trim()) {
            setPlayerName(localName.trim());
            setIsEditingName(false);
        }
    };

    // Static Room List IDs
    const roomIds = [1, 2, 3, 4, 5];

    return (
        <div className={`fixed inset-0 ${COLORS.TABLE_BG} flex flex-col items-center text-white overflow-hidden`}>
            <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>

            {/* Top Bar */}
            <div className="w-full z-10 bg-black/60 backdrop-blur-md border-b border-gray-700 p-4 flex justify-between items-center px-8 shadow-xl">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">{TEXT.LOBBY_ID_LABEL}</span>
                        <span className="font-mono text-xl text-yellow-500 font-bold">{playerId}</span>
                    </div>

                    <div className="h-8 w-px bg-gray-600 mx-2"></div>

                    <div className="flex flex-col group relative">
                        <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">{TEXT.LOBBY_NAME_LABEL}</span>
                        {isEditingName ? (
                            <input
                                autoFocus
                                className="bg-transparent border-b-2 border-yellow-500 text-2xl font-bold outline-none w-48 text-white"
                                value={localName}
                                onChange={(e) => setLocalName(e.target.value)}
                                onBlur={handleSaveName}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            />
                        ) : (
                            <div
                                className="text-2xl font-bold cursor-pointer hover:text-yellow-200 transition-colors flex items-center gap-2"
                                onClick={() => setIsEditingName(true)}
                                title={TEXT.LOBBY_EDIT_TOOLTIP}
                            >
                                {playerName}
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={onLogout}
                    className="group bg-gray-800 hover:bg-red-600/80 p-3 rounded-lg transition-all shadow-lg active:scale-95"
                    title={TEXT.LOBBY_LOGOUT_TITLE}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>

            {/* Room List */}
            <div className="flex-1 w-full max-w-4xl p-8 z-10 overflow-y-auto custom-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <h2 className="text-3xl font-bold text-gray-300 mb-6 text-center">{TEXT.LOBBY_GAME_ROOMS}</h2>

                <div className="flex flex-col gap-4 pb-20">
                    {roomIds.map((id) => {
                        const count = roomCounts[`JUMBO-BRIDGE-ROOM-${id}`] || 0;
                        const isFull = count >= 4;
                        // const status = 'Waiting'; // We only query count for now

                        return (
                            <div
                                key={id}
                                className={`
                                    relative p-6 rounded-xl border-l-8 shadow-lg transition-all duration-200 group
                                    ${isFull
                                        ? 'bg-gray-900/80 border-red-500 grayscale opacity-80 cursor-not-allowed'
                                        : 'bg-gray-800/80 border-green-500 hover:bg-gray-700 cursor-pointer hover:shadow-green-500/10 hover:translate-x-2'}
                                `}
                                onClick={() => {
                                    if (!isFull) {
                                        onJoinRoom(id);
                                    }
                                }}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white group-hover:text-green-400 transition-colors">{TEXT.LOBBY_ROOM_PREFIX} {id}</h3>
                                        <p className="text-gray-400 text-sm mt-1">{TEXT.LOBBY_RULES}</p>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className={`text-right ${isFull ? 'text-red-400' : 'text-gray-300'}`}>
                                            <div className="font-bold text-xl">
                                                {isFull ? TEXT.LOBBY_FULL : `${count}/4 ${TEXT.LOBBY_PLAYERS_SUFFIX}`}
                                            </div>
                                            <div className="text-xs uppercase tracking-wider opacity-60">
                                                {isFull ? TEXT.LOBBY_LOCKED : TEXT.LOBBY_OPEN}
                                            </div>
                                        </div>

                                        {!isFull && (
                                            <div className="bg-green-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
