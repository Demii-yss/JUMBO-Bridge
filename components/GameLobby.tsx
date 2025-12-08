import React, { memo } from 'react';
import { PlayerPosition, GamePhase } from '../types';
import { TEXT } from '../constants';
import { COLORS } from '../colors';

interface GameLobbyProps {
    playerName: string;
    setPlayerName: (name: string) => void;
    setMyPosition: (pos: PlayerPosition) => void;
    setGameState: React.Dispatch<React.SetStateAction<any>>;
    myPeerId: string;
    hostPeerId: string;
    setHostPeerId: (id: string) => void;
    connectToHost: (id: string) => void;
    copyRoomId: (id: string) => void;
    statusMsg: string;
    debugLogs: string[];
}

const GameLobby: React.FC<GameLobbyProps> = memo(({
    playerName,
    setPlayerName,
    setMyPosition,
    setGameState,
    myPeerId,
    hostPeerId,
    setHostPeerId,
    connectToHost,
    copyRoomId,
    statusMsg,
    debugLogs
}) => {
    return (
        <div className={`fixed inset-0 overflow-hidden ${COLORS.LOBBY_BG} flex justify-center items-center ${COLORS.TEXT_PRIMARY} font-sans`}>
            <div className={`w-full max-w-md p-8 ${COLORS.PANEL_BG} rounded-xl shadow-2xl border ${COLORS.BORDER_MAIN}`}>
                <h1 className={`text-4xl font-bold text-center ${COLORS.GAME_TITLE} mb-8`}>{TEXT.GAME_TITLE}</h1>
                <div className="space-y-4">
                    <div>
                        <label className={`block text-sm font-bold mb-1 ${COLORS.TEXT_SECONDARY}`}>{TEXT.NAME_LABEL}</label>
                        <input
                            type="text"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className={`w-full ${COLORS.INPUT_BG} border ${COLORS.BORDER_MAIN} rounded p-2 ${COLORS.TEXT_PRIMARY} focus:outline-none focus:border-yellow-500`}
                        />
                    </div>
                    <div className={`border-t ${COLORS.BORDER_MAIN} my-4 pt-4`}>
                        <button
                            onClick={() => {
                                setMyPosition(PlayerPosition.North);
                                setGameState((prev: any) => ({
                                    ...prev,
                                    phase: GamePhase.Idle,
                                    players: [{ id: myPeerId, name: playerName, position: PlayerPosition.North, isHost: true }]
                                }));
                            }}
                            className={`w-full ${COLORS.BTN_PRIMARY} font-bold py-3 rounded mb-4 transition`}
                        >
                            {TEXT.HOST_GAME}
                        </button>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={TEXT.ROOM_ID}
                                value={hostPeerId}
                                onChange={(e) => setHostPeerId(e.target.value)}
                                className={`flex-1 ${COLORS.INPUT_BG} border ${COLORS.BORDER_MAIN} rounded p-2 ${COLORS.TEXT_PRIMARY}`}
                            />
                            <button
                                onClick={() => connectToHost(hostPeerId)}
                                disabled={!hostPeerId}
                                className={`${COLORS.BTN_SECONDARY} disabled:opacity-50 font-bold py-2 px-4 rounded`}
                            >
                                {TEXT.JOIN_GAME}
                            </button>
                        </div>
                    </div>
                    {statusMsg && <div className={`text-center ${COLORS.TEXT_ACCENT} animate-pulse`}>{statusMsg}</div>}
                    <div
                        className={`text-xs text-center mt-4 transition ${myPeerId ? `cursor-pointer hover:text-white ${COLORS.TEXT_MUTED}` : `cursor-not-allowed ${COLORS.TEXT_MUTED}`}`}
                        onClick={() => myPeerId && copyRoomId(myPeerId)}
                    >
                        {TEXT.MY_ID}: <span className={`select-all font-mono ${COLORS.TEXT_SECONDARY} border-b border-dotted border-gray-500`}>{myPeerId || 'Initializing...'}</span>
                        {myPeerId && <span className="ml-2 text-[10px] bg-stone-700 px-1 rounded">📋</span>}
                    </div>
                </div>
            </div>

            {/* Debug Logs Overlay */}
            <div className="fixed bottom-0 left-0 w-full bg-black/80 text-green-400 font-mono text-xs p-2 pointer-events-none z-50">
                <div className="font-bold text-white mb-1">Debug Logs (Latests):</div>
                {debugLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </div>
        </div>
    );
});

export default GameLobby;
