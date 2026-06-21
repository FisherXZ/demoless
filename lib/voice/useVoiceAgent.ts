"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PcmChunkDecoder, PcmPlayer } from "./audioPlayback";
import {
  AUDIO_SAMPLE_RATE,
  DEFAULT_LANGUAGE,
  type BuyerIdentity,
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
  /** The agent's display name, derived from the active voice model. */
  agentName: string;
  language: Language;
  error: string | null;
  /** Send a text message to the agent over the existing socket. */
  sendText: (text: string) => void;
  /** Embeddable live-view URL for the server-driven cloud browser; null before connect. */
  liveViewUrl: string | null;
  /** Most recent screen page label from the agent; null until first screen_is_on event. */
  lastScreen: { page: string } | null;
  /** Mic is gated off — session stays connected. */
  muted: boolean;
  toggleMute: () => void;
  start: () => Promise<void>;
  stop: () => void;
  setLanguage: (language: Language) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL ?? "ws://localhost:3001";

/** Options for {@link useVoiceAgent}. */
export interface VoiceAgentOptions {
  /** Verified identity for this demo session; gates connection and records the
   *  session under the right buyer. */
  buyer?: BuyerIdentity;
  /** Language the visitor chose on the form; seeds the session so the first
   *  utterance is transcribed and answered in it (no Whisper auto-detect). */
  language?: Language;
  /** Visitor's self-reported role (from the pre-call form). Sent to the gateway
   *  so it can pick an audience persona (technical vs non-technical). */
  role?: string;
  /** Product to demo, picked on the landing page (e.g. "browserbase", "clay").
   *  Sent to the gateway so it loads that product's config. */
  company?: string;
}

export function useVoiceAgent(options: VoiceAgentOptions = {}): VoiceAgent {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [active, setActive] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [lastCaption, setLastCaption] = useState("");
  const [agentName, setAgentName] = useState("");
  const [language, setLanguageState] = useState<Language>(
    options.language ?? DEFAULT_LANGUAGE
  );
  const [error, setError] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [lastScreen, setLastScreen] = useState<{ page: string } | null>(null);
  const [muted, setMutedState] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const node = useRef<AudioWorkletNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const player = useRef<PcmPlayer | null>(null);
  const decoder = useRef<PcmChunkDecoder | null>(null);
  const languageRef = useRef<Language>(language);
  const buyerRef = useRef<BuyerIdentity | undefined>(options.buyer);
  const roleRef = useRef<string | undefined>(options.role);
  const companyRef = useRef<string | undefined>(options.company);
  const mutedRef = useRef(false);

  languageRef.current = language;
  buyerRef.current = options.buyer;
  roleRef.current = options.role;
  companyRef.current = options.company;

  const teardown = useCallback(() => {
    node.current?.port.close();
    node.current?.disconnect();
    node.current = null;

    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;

    player.current?.stop();
    player.current = null;
    decoder.current?.reset();
    decoder.current = null;

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
        setAgentName(ev.agentName);
        break;
      case "user_said":
        setPartialTranscript(ev.text);
        // Local barge-in: the prospect started talking over the agent.
        if (player.current?.isPlaying) {
          player.current.stop();
          decoder.current?.reset();
          setAgentSpeaking(false);
        }
        break;
      case "say":
        setLastCaption(ev.text);
        setAgentSpeaking(true);
        break;
      case "tts_chunk":
        player.current?.enqueue(
          decoder.current?.decode(ev.b64) ?? new Int16Array()
        );
        setAgentSpeaking(true);
        break;
      case "tts_end":
        decoder.current?.reset();
        break;
      case "agent_state":
        setStatus(ev.state);
        setAgentSpeaking(ev.state === "speaking");
        break;
      case "barge_in":
        player.current?.stop();
        decoder.current?.reset();
        setAgentSpeaking(false);
        break;
      case "live_view":
        setLiveViewUrl(ev.url);
        break;
      case "screen_is_on":
        setLastScreen({ page: ev.page });
        break;
      case "error":
        setError(ev.message);
        break;
      default:
        break;
    }
  }, []);

  const applyMuted = useCallback((next: boolean) => {
    mutedRef.current = next;
    setMutedState(next);
    stream.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    applyMuted(!mutedRef.current);
  }, [applyMuted]);

  const sendText = useCallback((text: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          t: "text_input",
          text,
          buyer: buyerRef.current,
          role: roleRef.current,
          company: companyRef.current,
        })
      );
    }
  }, []);

  const start = useCallback(async () => {
    if (active) return;
    setError(null);
    setStatus("connecting");
    if (!buyerRef.current) {
      setError("Missing demo session identity");
      setStatus("error");
      return;
    }
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
      decoder.current = new PcmChunkDecoder();

      const source = audioCtx.createMediaStreamSource(media);
      const worklet = new AudioWorkletNode(audioCtx, "pcm-capture");
      node.current = worklet;
      // Capture only - do NOT connect to destination (would echo the mic).
      source.connect(worklet);

      const socket = new WebSocket(WS_URL);
      socket.binaryType = "arraybuffer";
      ws.current = socket;

      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (mutedRef.current) return;
        if (socket.readyState === WebSocket.OPEN) socket.send(e.data);
      };

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            t: "audio_start",
            sampleRate: AUDIO_SAMPLE_RATE,
            language: languageRef.current,
            buyer: buyerRef.current,
            role: roleRef.current,
            company: companyRef.current,
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
    decoder.current?.reset();
    applyMuted(false);
  }, [applyMuted, teardown]);

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
    agentName,
    language,
    error,
    sendText,
    liveViewUrl,
    lastScreen,
    muted,
    toggleMute,
    start,
    stop,
    setLanguage,
  };
}
