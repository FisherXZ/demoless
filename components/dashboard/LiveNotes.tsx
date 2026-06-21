"use client";

import { useEffect, useState } from "react";
import type { NoteAddedEvent } from "@/lib/memory/types";

interface Props {
  /** Filter to a specific buyer key (normalised email). Omit to see all notes. */
  buyerKey?: string;
}

/**
 * Subscribes to /api/notes/stream (SSE) and renders live notes as they arrive.
 * Drop this into any dashboard page that wants real-time buyer note updates.
 */
export function LiveNotes({ buyerKey }: Props) {
  const [notes, setNotes] = useState<NoteAddedEvent[]>([]);

  useEffect(() => {
    const es = new EventSource("/api/notes/stream");

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as NoteAddedEvent;
        if (buyerKey && event.buyerKey !== buyerKey) return;
        setNotes((prev) => [event, ...prev].slice(0, 50));
      } catch {
        // Ignore malformed payloads.
      }
    };

    return () => es.close();
  }, [buyerKey]);

  if (!notes.length) return null;

  return (
    <div className="mt-3 rounded-[10px] border border-edge bg-slate px-4 py-3">
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
        Live notes
      </span>
      <ul className="space-y-1">
        {notes.map((n, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-ash">
            <span className="mt-px font-mono text-[10px] text-ember">{n.note.type}</span>
            <span>{n.note.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
