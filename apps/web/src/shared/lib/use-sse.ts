'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getWebEnv } from '@/env';
import { getAccessToken } from './auth-storage';

export type StylistRealtimeEventType =
  'booking_created' | 'conversation_escalated' | 'conversation_message';

export type UseStylistRealtimeOptions = {
  enabled?: boolean;
  onEvent: (type: StylistRealtimeEventType, data: Record<string, unknown>) => void;
  onReconnect?: () => void;
};

/**
 * Ch.17.5 — fetch-based SSE client (supports Authorization header; EventSource cannot).
 * Reconnects with backoff and calls onReconnect for reconciliation refetch.
 */
export function useStylistRealtime({
  enabled = true,
  onEvent,
  onReconnect,
}: UseStylistRealtimeOptions): void {
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  onEventRef.current = onEvent;
  onReconnectRef.current = onReconnect;

  const connect = useCallback(async (signal: AbortSignal, attempt: number) => {
    const token = getAccessToken();
    if (!token) return;

    const baseUrl = getWebEnv().NEXT_PUBLIC_API_URL;
    const response = await fetch(`${baseUrl}/api/v1/realtime/stylist/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        'X-Client-Type': 'web',
      },
      credentials: 'include',
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    if (attempt > 0) {
      onReconnectRef.current?.();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType: StylistRealtimeEventType | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim() as StylistRealtimeEventType;
        } else if (line.startsWith('data: ') && eventType) {
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            onEventRef.current(eventType, data);
          } catch {
            // ignore malformed chunks
          }
          eventType = null;
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let cancelled = false;
    let attempt = 0;

    const run = async () => {
      while (!cancelled) {
        try {
          await connect(controller.signal, attempt);
          attempt += 1;
        } catch {
          if (cancelled) break;
          attempt += 1;
          const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [connect, enabled]);
}
