import { createNotesSubscriber } from "@/lib/memory/pubsub";
import type { NoteAddedEvent, PhaseChangedEvent } from "@/lib/memory/types";

export const dynamic = "force-dynamic";

type LiveEvent = NoteAddedEvent | PhaseChangedEvent;

/**
 * SSE endpoint — bridges Redis pub/sub live notes and phase changes to the browser.
 * GET /api/notes/stream
 *
 * Emits `data: <JSON LiveEvent>\n\n` for every note saved or phase change.
 * The client closes the connection to stop receiving events.
 */
export async function GET() {
  let unsub: (() => Promise<void>) | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: LiveEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller already closed (client disconnected).
        }
      };

      unsub = await createNotesSubscriber(send);
    },
    async cancel() {
      await unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
