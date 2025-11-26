import { useEffect } from 'react';
import { wsClient } from '@/lib/websocket';

type WebSocketEventType =
  | 'ORDER_CREATED'
  | 'ORDER_ASSIGNED'
  | 'ORDER_DELIVERED'
  | 'FORCE_LOGOUT';

export function useWebSocket(
  event: WebSocketEventType,
  callback: (data: any) => void
) {
  useEffect(() => {
    wsClient.on(event, callback);

    return () => {
      wsClient.off(event, callback);
    };
  }, [event, callback]);
}
