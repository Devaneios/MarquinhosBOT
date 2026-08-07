import React from 'react';
import type { DiscordIdentity } from '../../hooks/useDiscordIdentity';
import { SnakeCanvas } from './SnakeCanvas';
import { useSnakeSession } from './useSnakeSession';

interface SnakeGameContainerProps {
  identity: DiscordIdentity;
  onAuthInvalid: () => void;
}

export const SnakeGameContainer: React.FC<SnakeGameContainerProps> = ({
  identity,
  onAuthInvalid,
}) => {
  const {
    sessionState,
    selectMode,
    backToMenu,
    sendDirection,
    leave,
    connectionState,
  } = useSnakeSession(identity, onAuthInvalid);

  if (sessionState.status === 'selecting-mode') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          gap: '20px',
          background: '#000',
          color: '#fff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <h1>SNAKE GAME</h1>
        <div style={{ display: 'flex', gap: '20px' }}>
          <button
            onClick={() => selectMode('single')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Single Player
          </button>
          <button
            onClick={() => selectMode('multi')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Two Player
          </button>
        </div>
      </div>
    );
  }

  if (sessionState.status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#000',
          color: '#f00',
          fontSize: '18px',
          gap: '20px',
        }}
      >
        <div>Error: {sessionState.error}</div>
        <button
          onClick={backToMenu}
          style={{
            padding: '8px 16px',
            backgroundColor: '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
      </div>
    );
  }

  if (
    sessionState.status === 'connecting' ||
    connectionState === 'connecting'
  ) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#000',
          color: '#fff',
          fontSize: '18px',
        }}
      >
        Connecting to game...
      </div>
    );
  }

  if (connectionState === 'error' || connectionState === 'disconnected') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#000',
          color: '#f00',
          fontSize: '18px',
          gap: '20px',
        }}
      >
        <div>Connection {connectionState}</div>
        <button
          onClick={backToMenu}
          style={{
            padding: '8px 16px',
            backgroundColor: '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <SnakeCanvas
        state={sessionState.gameState || null}
        onDirection={sendDirection}
      />
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: '14px',
          textShadow: '0 0 5px #0f0',
        }}
      >
        {sessionState.gameState && (
          <>
            <div>Player 1: {sessionState.gameState.scores?.player1 ?? 0}</div>
            {sessionState.gameState.snakes?.player2 && (
              <div>Player 2: {sessionState.gameState.scores?.player2 ?? 0}</div>
            )}
            {sessionState.gameState.winner && (
              <div style={{ marginTop: '20px', fontSize: '18px' }}>
                Winner: {sessionState.gameState.winner}
              </div>
            )}
          </>
        )}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
        }}
      >
        <button
          onClick={leave}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f44336',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Leave Game
        </button>
      </div>
    </div>
  );
};
