import { useCallback, useEffect, useRef, useState } from 'react';
import { HostGameState, TeamGameState, TimerState, UserSession } from '../types';

const CHANNEL_NAME = 'ops_fortune_realtime_sync';

export function formatCountdownMMSS(remainingMs: number): string {
  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.ceil(clamped / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function useSynchronizedTimer(timer: TimerState | null) {
  const serverOffsetRef = useRef<number>(0);
  const [remainingMs, setRemainingMs] = useState<number>(60000);

  useEffect(() => {
    if (!timer) return;
    if (typeof timer.serverNow === 'number') {
      serverOffsetRef.current = timer.serverNow - Date.now();
    }

    const computeRemaining = () => {
      if (timer.status === 'IDLE') {
        return timer.durationMs || 60000;
      }
      if (timer.status === 'ENDED' || !timer.endsAt) {
        return 0;
      }
      const syncedNow = Date.now() + serverOffsetRef.current;
      return Math.max(0, timer.endsAt - syncedNow);
    };

    setRemainingMs(computeRemaining());

    if (timer.status === 'RUNNING') {
      const interval = window.setInterval(() => {
        const rem = computeRemaining();
        setRemainingMs(rem);
      }, 100);
      return () => window.clearInterval(interval);
    }
  }, [timer]);

  const formatted = formatCountdownMMSS(remainingMs);
  const isTimeUp = timer?.status === 'ENDED' || (timer?.status === 'RUNNING' && remainingMs <= 0);

  return {
    remainingMs,
    formatted,
    isTimeUp,
    status: timer?.status ?? 'IDLE',
  };
}

export function useRealtimeGame(session: UserSession | null) {
  const [hostState, setHostState] = useState<HostGameState | null>(null);
  const [teamState, setTeamState] = useState<TeamGameState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  const applyIncomingState = useCallback((state: HostGameState | TeamGameState) => {
    if (state.role === 'HOST') {
      setHostState(state);
      setTeamState(null);
    } else if (state.role === 'TEAM') {
      setTeamState(state);
      setHostState(null);
    }
  }, []);

  const fetchState = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/state', {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch game state');
      }
      const data = await res.json();
      if (data.state) {
        applyIncomingState(data.state);
      }
    } catch (err) {
      console.error('State sync error:', err);
    }
  }, [session, applyIncomingState]);

  const notifyPeers = useCallback(() => {
    if (bcRef.current) {
      bcRef.current.postMessage({ type: 'refresh', ts: Date.now() });
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setHostState(null);
      setTeamState(null);
      return;
    }

    setLoading(true);
    fetchState().finally(() => setLoading(false));

    // Setup BroadcastChannel for instant multi-tab notification
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = () => {
        fetchState();
      };
      bcRef.current = bc;
    }

    // Setup WebSocket connection with automatic reconnect
    let isUnmounted = false;
    let reconnectTimer: number | undefined;

    const connectWs = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(
        session.token
      )}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state:sync' && msg.state) {
            applyIncomingState(msg.state);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          reconnectTimer = window.setTimeout(connectWs, 1500);
        }
      };
    };

    connectWs();

    // Poll fallback every 1.2 seconds so even if WebSocket proxies buffer, timer and submissions stay 100% live
    const pollInterval = window.setInterval(() => {
      fetchState();
    }, 1200);

    return () => {
      isUnmounted = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(pollInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (bcRef.current) {
        bcRef.current.close();
      }
    };
  }, [session, fetchState, applyIncomingState]);

  const apiCall = useCallback(
    async <T = unknown>(path: string, method: string = 'POST', body?: unknown): Promise<T | null> => {
      if (!session) return null;
      setError(null);
      try {
        const res = await fetch(path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Operation failed');
        }
        if (data.state) {
          applyIncomingState(data.state);
        }
        notifyPeers();
        return data as T;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Request failed';
        setError(msg);
        return null;
      }
    },
    [session, applyIncomingState, notifyPeers]
  );

  return {
    hostState,
    teamState,
    loading,
    error,
    apiCall,
    refresh: fetchState,
  };
}
