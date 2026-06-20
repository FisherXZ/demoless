"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { base64ToInt16, PcmPlayer } from "./audioPlayback";
import {
  AUDIO_SAMPLE_RATE,
  DEFAULT_LANGUAGE,
  type Language,
  parseServerEvent,
} from "./messages";

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export interface VoiceAgent {
  status: VoiceStatus;
  active: boolean;
  agentSpeaking: boolean;
  /** Live transcript of what the prospect is saying. */
  partialTranscript: string;
  /** The agent's most recent spoken line (for captions). */
  lastCaption: string;
  language: Language;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  setLanguage: (language: Language) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL ?? "ws://localhost:3001";

export function useVoiceAgent(): VoiceAgent {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [active, setActive] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [lastCaption, setLastCaption] = useState("");
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [error, setError] = useState<string | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const node = useRef<AudioWorkletNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const player = useRef<PcmPlayer | null>(null);
  const languageRef = useRef<Language>(language);

  languageRef.current = language;

  const teardown = useCallback(() => {
    node.current?.port.close();
    node.current?.disconnect();
    node.current = null;

    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;

    player.current?.stop();
    player.current = null;

    if (ctx.current && ctx.current.state !== "closed") {
      void ctx.current.close();
    }
    ctx.current = null;

    if (ws.current) {
      ws.current.onclose = null;
      ws.current.onmessage = null;
      ws.current.onerror = null;
      try {
        ws.current.close();
      } catch {
        /* ignore */
      }
      ws.current = null;
    }
  }, []);

  const handleEvent = useCallback((raw: string) => {
    const ev = parseServerEvent(raw);
    if (!ev) return;
    switch (ev.t) {
      case "ready":
        setStatus("listening");
        break;
      case "user_said":
        setPartialTranscript(ev.text);
        // Local barge-in: the prospect started talking over Maya.
        if (player.current?.isPlaying) {
          player.current.stop();
          setAgentSpeaking(false);
        }
        break;
      case "say":
        setLastCaption(ev.text);
        setAgentSpeaking(true);
        break;
      case "tts_chunk":
        player.current?.enqueue(base64ToInt16(ev.b64));
        setAgentSpeaking(true);
        break;
      case "tts_end":
        break;
      case "agent_state":
        setStatus(ev.state);
        setAgentSpeaking(ev.state === "speaking");
        break;
      case "barge_in":
        player.current?.stop();
        setAgentSpeaking(false);
        break;
      case "error":
        setError(ev.message);
        break;
      default:
        break;
    }
  }, []);

  const start = useCallback(async () => {
    if (active) return;
    setError(null);
    setStatus("connecting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.current = media;

      const audioCtx = new AudioContext();
      ctx.current = audioCtx;
      if (audioCtx.state === "suspended") await audioCtx.resume();
      await audioCtx.audioWorklet.addModule("/worklets/pcm-capture.js");

      player.current = new PcmPlayer(audioCtx, AUDIO_SAMPLE_RATE);

      const source = audioCtx.createMediaStreamSource(media);
      const worklet = new AudioWorkletNode(audioCtx, "pcm-capture");
      node.current = worklet;
      // Capture only - do NOT connect to destination (would echo the mic).
      source.connect(worklet);

      const socket = new WebSocket(WS_URL);
      socket.binaryType = "arraybuffer";
      ws.current = socket;

      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(e.data);
      };

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            t: "audio_start",
            sampleRate: AUDIO_SAMPLE_RATE,
            language: languageRef.current,
          })
        );
      };
      socket.onmessage = (e) => handleEvent(String(e.data));
      socket.onerror = () => setError("Voice connection error");
      socket.onclose = () => {
        if (active) setStatus("idle");
      };

      setActive(true);
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
      teardown();
    }
  }, [active, handleEvent, teardown]);

  const stop = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ t: "audio_stop" }));
    }
    teardown();
    setActive(false);
    setAgentSpeaking(false);
    setStatus("idle");
    setPartialTranscript("");
  }, [teardown]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ t: "set_language", language: lang }));
    }
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  return {
    status,
    active,
    agentSpeaking,
    partialTranscript,
    lastCaption,
    language,
    error,
    start,
    stop,
    setLanguage,
  };
}
