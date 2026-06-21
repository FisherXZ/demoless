// Redis persistence for the post-demo packet + its extraction status. Keyed by
// session id under demoless:session:{id}:packet. Reuses the shared command
// client from lib/memory, exactly like lib/sessions/store.ts.
import { getRedis } from "../../memory/redis";
import { NS } from "../keys";
import type { ExtractionStatus, SessionPacket } from "./types";

export function packetKey(id: string): string {
  return `${NS}:session:${id}:packet`;
}

export async function setExtractionStatus(
  id: string,
  status: ExtractionStatus,
  error?: string,
): Promise<void> {
  const fields: Record<string, string> = { status };
  if (error) fields.error = error;
  await getRedis().hset(packetKey(id), fields);
}

export async function savePacket(id: string, packet: SessionPacket): Promise<void> {
  await getRedis().hset(packetKey(id), {
    status: "ready",
    packet: JSON.stringify(packet),
    generatedAt: String(packet.generatedAt),
  });
}

export async function loadPacket(
  id: string,
): Promise<{ status: ExtractionStatus; packet: SessionPacket | null }> {
  const h = await getRedis().hgetall(packetKey(id));
  if (!h || !h.status) return { status: "not_started", packet: null };
  if (h.status === "ready" && h.packet) {
    try {
      return { status: "ready", packet: JSON.parse(h.packet) as SessionPacket };
    } catch {
      return { status: "failed", packet: null };
    }
  }
  return { status: h.status as ExtractionStatus, packet: null };
}
