const WS_URL = import.meta.env.VITE_WS_URL || 'wss://deliveryapp-fxxl.onrender.com/ws';

type WebSocketEventType =
  | 'ORDER_CREATED'
  | 'ORDER_ASSIGNED'
  | 'ORDER_DELIVERED'
  | 'FORCE_LOGOUT';

interface WebSocketMessage {
  type: WebSocketEventType;
  order?: any;
  message?: string;
}

type EventCallback = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Map<WebSocketEventType, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private userId: string | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(userId: string) {
    this.userId = userId;

    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;

        // Register user
        if (this.userId) {
          this.send({ type: 'register', userId: this.userId });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.userId) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
      setTimeout(() => {
        this.connect(this.userId!);
      }, this.reconnectDelay);
    }
  }

  private handleMessage(data: WebSocketMessage) {
    const listeners = this.listeners.get(data.type);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  on(event: WebSocketEventType, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: WebSocketEventType, callback: EventCallback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.userId = null;
  }
}

export const wsClient = new WebSocketClient(WS_URL);
