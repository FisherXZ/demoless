"use client";

import { useEffect, useState } from "react";

/**
 * The agent's configured display name (derived from the selected voice model on
 * the server). Used by pre-call screens, which can't read the server-only voice
 * env directly. During a live session, prefer the `agentName` from
 * `useVoiceAgent`, which reflects the active language's voice.
 */
const FALLBACK = "Maya";

let cached: string | null = null;
let inflight: Promise<string> | null = null;

function loadAgentName(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/agent-name")
      .then((r) => r.json())
      .then((d: { agentName?: string }) => {
        cached = d.agentName?.trim() || FALLBACK;
        return cached;
      })
      .catch(() => FALLBACK)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useAgentName(): string {
  const [name, setName] = useState(cached ?? FALLBACK);

  useEffect(() => {
    let alive = true;
    void loadAgentName().then((n) => {
      if (alive) setName(n);
    });
    return () => {
      alive = false;
    };
  }, []);

  return name;
}
