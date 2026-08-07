import React from 'react';

interface MenuScreenProps {
  playerCount: number;
  onReady: () => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ playerCount, onReady }) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="notch-8 flex w-full max-w-[520px] flex-col items-center gap-6 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 text-center shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <div className="font-pixel text-2xl tracking-[0.28em] text-marquinhos-accent">
          TRIVIA QUIZ
        </div>
        <div className="text-sm text-marquinhos-text-dim">
          Players: <span className="font-semibold text-marquinhos-text">{playerCount} / 8</span>
        </div>
        <p className="max-w-[32ch] text-sm leading-6 text-marquinhos-text-dim">
          Waiting for other players to join... Be the fastest to get the highest score!
        </p>
        {playerCount >= 2 && (
          <button
            onClick={onReady}
            className="notch-6 border border-marquinhos-accent/60 bg-marquinhos-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-marquinhos-accent-hover"
          >
            Start Game
          </button>
        )}
      </div>
    </div>
  );
};
