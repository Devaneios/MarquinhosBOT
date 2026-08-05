import { useCallback, useEffect, useRef } from 'react';
import { wsUrl } from '../../lib/apiBase';
import { ActivitySocket, type ActivityMessage } from '../../lib/ws';

// For games with no PixiJS/binary-snapshot concerns (turn-based, JSON-only)
// — connects on mount, tears down (with the 'leave' farewell) on unmount,
// same lifecycle Pong's ActivitySocket usage follows, without any of its
// canvas/rendering specifics.
export function useActivitySocket(
  wsToken: string | null,
  onMessage: (message: ActivityMessage) => void,
) {
  const socketRef = useRef<ActivitySocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!wsToken) return;
    const socket = new ActivitySocket(
      `${wsUrl('/ws/activity')}?token=${encodeURIComponent(wsToken)}`,
    );
    socketRef.current = socket;
    const unsubscribe = socket.onMessage((message) =>
      onMessageRef.current(message),
    );
    socket.connect();

    return () => {
      unsubscribe();
      socket.close({ type: 'leave' });
      socketRef.current = null;
    };
  }, [wsToken]);

  const send = useCallback((message: ActivityMessage) => {
    socketRef.current?.send(message);
  }, []);

  return { send };
}
