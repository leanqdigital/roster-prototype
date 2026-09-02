"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchBreakEntries, fetchClockEntries } from "./queries";
import type { BreakEntry, ClockEntry } from "./types";

// Fallback poll interval — realtime subscription is primary, this just covers
// missed events / dropped connections.
const FALLBACK_POLL_MS = 120000;

interface LiveEntriesState {
  clockEntries: ClockEntry[];
  breakEntries: BreakEntry[];
  loading: boolean;
  lastUpdated: Date | null;
}

/**
 * Company-wide clock/break entries, kept fresh via Supabase Realtime with a
 * slow polling fallback. Pauses polling while the tab is hidden and does an
 * immediate refetch on refocus.
 */
export function useLiveEntries(): LiveEntriesState {
  const [state, setState] = useState<LiveEntriesState>({
    clockEntries: [],
    breakEntries: [],
    loading: true,
    lastUpdated: null,
  });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const load = async () => {
      try {
        const [clocks, breaks] = await Promise.all([fetchClockEntries(), fetchBreakEntries()]);
        if (!cancelledRef.current) {
          setState({ clockEntries: clocks, breakEntries: breaks, loading: false, lastUpdated: new Date() });
        }
      } catch {
        if (!cancelledRef.current) setState((s) => ({ ...s, loading: false }));
      }
    };

    load();

    const supabase = createClient();
    const channel = supabase
      .channel("live-entries")
      .on("postgres_changes", { event: "*", schema: "public", table: "clock_entries" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "break_entries" }, load)
      .subscribe();

    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(load, FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        load();
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
