export type RealtimeEventType =
  'booking_created' | 'conversation_escalated' | 'conversation_message';

export type RealtimeEvent = {
  type: RealtimeEventType;
  data: Record<string, unknown>;
};

type Subscriber = (event: RealtimeEvent) => void;

/** In-process SSE fan-out per stylist (Ch.17.5). Single API instance MVP. */
class RealtimeHub {
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  subscribe(stylistId: string, handler: Subscriber): () => void {
    const set = this.subscribers.get(stylistId) ?? new Set<Subscriber>();
    set.add(handler);
    this.subscribers.set(stylistId, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.subscribers.delete(stylistId);
      }
    };
  }

  publish(stylistId: string, event: RealtimeEvent): void {
    const set = this.subscribers.get(stylistId);
    if (!set) return;
    for (const handler of set) {
      handler(event);
    }
  }

  resetForTests(): void {
    this.subscribers.clear();
  }
}

export const realtimeHub = new RealtimeHub();
