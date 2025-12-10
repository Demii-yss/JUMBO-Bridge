import React, { memo } from 'react';
import { GameState, NetworkActionType, PlayerPosition } from '../types';
import { TEXT } from '../constants';

interface GameOverModalProps {
    gameState: GameState;
    myPosition: PlayerPosition;
    isHost: boolean;
    sendAction: (action: any) => void;
    downloadHistory: () => void;
    onClose: () => void; // Local Close
}

const GameOverModal: React.FC<GameOverModalProps> = memo(({
    gameState,
    myPosition,
    isHost,
    sendAction,
    downloadHistory,
    onClose
}) => {
    // Visibility controlled by Parent (App.tsx) via conditional rendering


    return (
        <div className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center">
            <div className={`p-10 rounded-2xl shadow-2xl max-w-4xl w-full border-4 ${gameState.winningTeam === (['North', 'South'].includes(myPosition!) ? 'NS' : 'EW') ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-500'}`}>
                <h1 className="text-6xl font-bold text-center text-white mb-4">
                    {gameState.winningTeam === (['North', 'South'].includes(myPosition!) ? 'NS' : 'EW') ? TEXT.VICTORY : TEXT.DEFEAT}
                </h1>
                <h2 className="text-3xl text-center text-gray-300 mb-8">
                    {gameState.surrendered ? TEXT.OPPONENT_SURRENDERED : TEXT.GAME_FINISHED}
                </h2>

                <div className="flex justify-around mb-8 text-2xl">
                    <div className="text-center p-4 bg-black/30 rounded">
                        <div className="text-blue-400 font-bold mb-2">{TEXT.TEAM_NS}</div>
                        <div className="text-4xl">{(gameState.tricksWon[PlayerPosition.North] || 0) + (gameState.tricksWon[PlayerPosition.South] || 0)}</div>
                    </div>
                    <div className="text-center p-4 bg-black/30 rounded">
                        <div className="text-red-400 font-bold mb-2">{TEXT.TEAM_EW}</div>
                        <div className="text-4xl">{(gameState.tricksWon[PlayerPosition.East] || 0) + (gameState.tricksWon[PlayerPosition.West] || 0)}</div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center">
                    <button onClick={downloadHistory} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl text-2xl">
                        {TEXT.DOWNLOAD_LOG}
                    </button>

                    <button
                        onClick={onClose}
                        className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-xl text-2xl"
                    >
                        {TEXT.BACK_TO_ROOM || 'Back to Room'}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default GameOverModal;
