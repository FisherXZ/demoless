"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMsg, ServerMsg, TurnSnapshot } from "@/shared/wire";
import { ServerMsg as ServerMsgSchema } from "@/shared/wire";
import { createMockServer } from "./mockServer";

export type Mode = "mock" | "live";
export type Status = "connecting" | "open" | "closed" | "error";

export interface ChatItem {
  id: number;
  role: "user" | "agent";
  text: string;
  at: string;
}

export interface TraceItem {
  id: number;
  dir: "out" | "in";
  kind: string; // e.g. "user_said", "command:say", "turn", "error"
  payload: unknown;
  at: string;
}

interface Transport {
  send(msg: ClientMsg): void;
  close(): void;
}

export interface Harness {
  mode: Mode;
  setMode: (m: Mode) => void;
  url: string;
  setUrl: (u: string) => void;
  status: Status;

  chat: ChatItem[];
  trace: TraceItem[];
  snapshot: TurnSnapshot | null;

  buyerId: string;
  setBuyerId: (s: string) => void;

  start: () => void;
  send: (text: string) => void;
  reset: (wipeBuyer: boolean) => void;
}

const DEFAULT_URL = "ws://localhost:8787";

export function useHarness(): Harness {
  const [mode, setMode] = useState<Mode>("mock");
  const [url, setUrl] = useState(DEFAULT_URL);
  const [status, setStatus] = useState<Status>("closed");

  const [chat, setChat] = useState<ChatItem[]>([]);
  const [trace, setTrace] = useState<TraceItem[]>([]);
  const [snapshot, setSnapshot] = useState<TurnSnapshot | null>(null);
  const [buyerId, setBuyerId] = useState("acme-jordan");

  const transport = useRef<Transport | null>(null);
  const seq = useRef(0);
  const nextId = () => (seq.current += 1);

  const addTrace = useCallback((dir: "out" | "in", kind: string, payload: unknown) => {
    setTrace((t) => [...t, { id: nextId(), dir, kind, payload, at: new Date().toISOString() }]);
  }, []);

  // Route every server-bound message through one handler (mock + live share it).
  const onServer = useCallback(
    (msg: ServerMsg) => {
      switch (msg.t) {
        case "command":
          addTrace("in", `command:${msg.cmd.kind}`, msg.cmd);
          if (msg.cmd.kind === "say") {
            const text = msg.cmd.text;
            setChat((c) => [...c, { id: nextId(), role: "agent", text, at: new Date().toISOString() }]);
          }
          break;
        case "incoming":
          addTrace("in", `incoming:${msg.msg.kind}`, msg.msg);
          break;
        case "turn":
          addTrace("in", "turn", msg.snapshot);
          setSnapshot(msg.snapshot);
          break;
        case "error":
          addTrace("in", "error", msg.message);
          break;
      }
    },
    [addTrace],
  );

  // (Re)build the transport whenever mode/url changes.
  useEffect(() => {
    transport.current?.close();

    if (mode === "mock") {
      const mock = createMockServer(onServer);
      transport.current = { send: (m) => mock.handle(m), close: () => {} };
      setStatus("open");
      return () => transport.current?.close();
    }

    // live
    setStatus("connecting");
    const ws = new WebSocket(url);
    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
      let raw: unknown;
      try {
        raw = JSON.parse(ev.data as string);
      } catch {
        addTrace("in", "error", `non-JSON frame: ${String(ev.data).slice(0, 200)}`);
        return;
      }
      const parsed = ServerMsgSchema.safeParse(raw);
      if (!parsed.success) {
        addTrace("in", "error", { reason: "schema mismatch", raw, issues: parsed.error.issues });
        return;
      }
      onServer(parsed.data);
    };
    transport.current = { send: (m) => ws.send(JSON.stringify(m)), close: () => ws.close() };
    return () => ws.close();
  }, [mode, url, onServer, addTrace]);

  const dispatch = useCallback(
    (msg: ClientMsg) => {
      addTrace("out", msg.t, msg);
      transport.current?.send(msg);
    },
    [addTrace],
  );

  const start = useCallback(() => {
    if (!buyerId.trim()) return;
    dispatch({ t: "start", buyerId: buyerId.trim() });
  }, [buyerId, dispatch]);

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setChat((c) => [...c, { id: nextId(), role: "user", text: t, at: new Date().toISOString() }]);
      dispatch({ t: "user_said", text: t, final: true });
    },
    [dispatch],
  );

  const reset = useCallback(
    (wipeBuyer: boolean) => {
      setChat([]);
      setSnapshot(null);
      addTrace("out", "reset", { wipeBuyer });
      transport.current?.send({ t: "reset", wipeBuyer });
    },
    [addTrace],
  );

  return {
    mode, setMode, url, setUrl, status,
    chat, trace, snapshot,
    buyerId, setBuyerId,
    start, send, reset,
  };
}
