import { EngineEvent } from '../types';

type EventCallback = (event: EngineEvent) => void;
type StatusCallback = (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED') => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private eventListeners: Set<EventCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private reconnectTimeout: number | null = null;
  private status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' = 'DISCONNECTED';

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('CONNECTING');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/events`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (message) => {
        try {
          const data: EngineEvent = JSON.parse(message.data);
          this.eventListeners.forEach((callback) => callback(data));
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('DISCONNECTED');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error encountered:', err);
        if (this.ws) this.ws.close();
      };
    } catch (e) {
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimeout) {
      this.reconnectTimeout = window.setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
      }, 2000);
    }
  }

  private setStatus(status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED') {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  getStatus() {
    return this.status;
  }

  subscribeEvents(cb: EventCallback) {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  subscribeStatus(cb: StatusCallback) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }
}

export const wsService = new WebSocketService();
