import React, { useState, useEffect } from 'react';
import { COLORS } from '../colors'; // Ensure you have this or similar for styles

interface HomeScreenProps {
    onLogin: (id: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onLogin }) => {
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const storedId = localStorage.getItem('jumbo_player_id');
        if (storedId) {
            setInputValue(storedId);
        }
    }, []);

    const handleLogin = () => {
        const id = inputValue.trim();
        if (!/^\d{5}$/.test(id)) {
            setError('ID must be exactly 5 digits.');
            return;
        }
        localStorage.setItem('jumbo_player_id', id);
        onLogin(id);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleLogin();
    };

    return (
        <div className={`fixed inset-0 ${COLORS.TABLE_BG} flex flex-col justify-center items-center text-white`}>
            <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>

            <div className="z-10 bg-black/50 p-12 rounded-2xl shadow-2xl backdrop-blur-sm border border-yellow-500/30 flex flex-col gap-6 w-[400px]">
                <h1 className="text-4xl font-bold text-center text-yellow-400 mb-4">JUMBO Bridge</h1>

                <div className="flex flex-col gap-2">
                    <label className="text-gray-300 font-bold uppercase tracking-wider text-sm">Player ID</label>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                            setInputValue(val);
                            setError('');
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="12345"
                        className="bg-black/40 border-2 border-gray-600 focus:border-yellow-500 rounded-lg p-4 text-center text-3xl font-mono tracking-[0.5em] text-white outline-none transition-colors placeholder-gray-700"
                        autoFocus
                    />
                    {error && <p className="text-red-400 text-sm mt-1 text-center font-bold animate-pulse">{error}</p>}
                    <p className="text-gray-500 text-xs text-center mt-1">Enter a 5-digit number to identify yourself.</p>
                </div>

                <button
                    onClick={handleLogin}
                    disabled={inputValue.length !== 5}
                    className={`mt-4 py-4 rounded-xl font-bold text-xl uppercase tracking-widest transition-all
                        ${inputValue.length === 5
                            ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black shadow-lg hover:shadow-yellow-500/20 transform hover:-translate-y-1'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                    `}
                >
                    Login
                </button>
            </div>

            <div className="absolute bottom-8 text-gray-500 text-sm">
                JUMBO Bridge v2.0
            </div>
        </div>
    );
};
