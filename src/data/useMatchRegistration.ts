import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MatchRecord, PlayerIdentity } from './contracts';
import { registerMatch } from './api';
import { recordKeys } from './queries';
import {
  enqueuePendingMatch,
  loadPendingMatches,
  markPendingAttempt,
  migrateLegacyMatches,
  removePendingMatch,
  saveLastCompletedMatch,
  PENDING_MATCHES_CHANGE_EVENT,
} from '../matchRecords';

export type RegistrationStatus = 'idle' | 'saving' | 'saved' | 'failed';

export const useMatchRegistration = (player: PlayerIdentity) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RegistrationStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const currentMatchIdRef = useRef<string | null>(null);
  const flushRunningRef = useRef(false);
  const autoFlushStartedRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async (match: MatchRecord) => {
      markPendingAttempt(match.matchId);
      return registerMatch(match);
    },
    onSuccess: (_response, match) => {
      removePendingMatch(match.matchId);
      setPendingCount(loadPendingMatches().length);
      if (currentMatchIdRef.current === match.matchId) setStatus('saved');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: recordKeys.rankings() }),
        queryClient.invalidateQueries({ queryKey: recordKeys.histories() }),
      ]);
    },
  });
  const mutateAsync = mutation.mutateAsync;

  const processMatch = useCallback(async (match: MatchRecord, showStatus: boolean) => {
    if (showStatus) setStatus('saving');
    try {
      await mutateAsync(match);
      if (showStatus && currentMatchIdRef.current === match.matchId) setStatus('saved');
      return true;
    } catch {
      setPendingCount(loadPendingMatches().length);
      if (showStatus && currentMatchIdRef.current === match.matchId) setStatus('failed');
      return false;
    }
  }, [mutateAsync]);

  const flushPending = useCallback(async () => {
    if (flushRunningRef.current) return;
    flushRunningRef.current = true;
    try {
      for (const pending of loadPendingMatches()) await processMatch(pending.match, false);
    } finally {
      flushRunningRef.current = false;
      setPendingCount(loadPendingMatches().length);
    }
  }, [processMatch]);

  useEffect(() => {
    if (autoFlushStartedRef.current) return;
    autoFlushStartedRef.current = true;
    migrateLegacyMatches(player);
    setPendingCount(loadPendingMatches().length);
    void flushPending();
  }, [flushPending, player]);

  useEffect(() => {
    const onOnline = () => { void flushPending(); };
    const onPendingChange = () => setPendingCount(loadPendingMatches().length);
    window.addEventListener('online', onOnline);
    window.addEventListener(PENDING_MATCHES_CHANGE_EVENT, onPendingChange);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener(PENDING_MATCHES_CHANGE_EVENT, onPendingChange);
    };
  }, [flushPending]);

  const registerCompletedMatch = useCallback((match: MatchRecord) => {
    currentMatchIdRef.current = match.matchId;
    saveLastCompletedMatch(match);
    const queued = enqueuePendingMatch(match);
    setPendingCount(loadPendingMatches().length);
    if (!queued) setStatus('failed');
    void processMatch(match, true);
  }, [processMatch]);

  const retryCurrent = useCallback(() => {
    const matchId = currentMatchIdRef.current;
    const pending = loadPendingMatches().find((item) => item.match.matchId === matchId);
    if (pending) void processMatch(pending.match, true);
  }, [processMatch]);

  const resetStatus = useCallback(() => {
    currentMatchIdRef.current = null;
    setStatus('idle');
  }, []);

  return { status, pendingCount, registerCompletedMatch, retryCurrent, flushPending, resetStatus };
};
