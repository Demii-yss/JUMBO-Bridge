import React, { memo } from 'react';
import { PlayerPosition, GamePhase } from '../types';
import { TEXT } from '../constants';

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
        <div className="h-screen w-screen bg-stone-900 flex justify-center items-center text-white font-sans">
            <div className="w-full max-w-md p-8 bg-stone-800 rounded-xl shadow-2xl border border-stone-700">
                <h1 className="text-4xl font-bold text-center text-yellow-500 mb-8">{TEXT.GAME_TITLE}</h1>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 text-gray-300">{TEXT.NAME_LABEL}</label>
                        <input
                            type="text"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="w-full bg-stone-900 border border-stone-700 rounded p-2 text-white focus:outline-none focus:border-yellow-500"
                        />
                    </div>
                    <div className="border-t border-stone-700 my-4 pt-4">
                        <button
                            onClick={() => {
                                setMyPosition(PlayerPosition.North);
                                setGameState((prev: any) => ({
                                    ...prev,
                                    phase: GamePhase.Idle,
                                    players: [{ id: myPeerId, name: playerName, position: PlayerPosition.North, isHost: true }]
                                }));
                            }}
                            className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded mb-4 transition"
                        >
                            {TEXT.HOST_GAME}
                        </button>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={TEXT.ROOM_ID}
                                value={hostPeerId}
                                onChange={(e) => setHostPeerId(e.target.value)}
                                className="flex-1 bg-stone-900 border border-stone-700 rounded p-2 text-white"
                            />
                            <button
                                onClick={() => connectToHost(hostPeerId)}
                                disabled={!hostPeerId}
                                className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-2 px-4 rounded"
                            >
                                {TEXT.JOIN_GAME}
                            </button>
                        </div>
                    </div>
                    {statusMsg && <div className="text-center text-yellow-300 animate-pulse">{statusMsg}</div>}
                    <div
                        className={`text-xs text-center mt-4 transition ${myPeerId ? 'cursor-pointer hover:text-white text-gray-500' : 'cursor-not-allowed text-gray-600'}`}
                        onClick={() => myPeerId && copyRoomId(myPeerId)}
                    >
                        {TEXT.MY_ID}: <span className="select-all font-mono text-gray-300 border-b border-dotted border-gray-500">{myPeerId || 'Initializing...'}</span>
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
