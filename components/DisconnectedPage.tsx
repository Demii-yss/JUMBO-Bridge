import React from 'react';

const DisconnectedPage: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[9999] bg-zinc-900 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 mb-8 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                <svg
                    className="w-12 h-12 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                </svg>
            </div>

            <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
                Connection Lost
            </h1>

            <p className="text-xl text-zinc-400 max-w-md mx-auto mb-8 leading-relaxed">
                The connection to the Game Hall Server has been lost. The game cannot proceed without the server.
            </p>

            <div className="bg-zinc-800 rounded-lg p-6 max-w-md w-full border border-zinc-700 shadow-xl">
                <div className="flex items-start gap-4 text-left">
                    <div className="mt-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white mb-1">Waiting for server...</h3>
                        <p className="text-sm text-zinc-500">
                            Please ensure <code className="bg-zinc-950 px-2 py-0.5 rounded text-zinc-300 font-mono text-xs border border-zinc-700">runGameHall.bat</code> is running.
                            <br />
                            The page will refresh automatically when connected.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DisconnectedPage;
