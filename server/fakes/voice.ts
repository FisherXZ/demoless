// Fake P2 (voice). Subscribes to `say` and logs it. Later: Deepgram TTS in the
// browser. Same onCommand subscription point — swap the body, nothing else.

import type { Loop } from "../loop";

export function registerVoiceFake(loop: Loop) {
  loop.onCommand((c) => {
    if (c.kind === "say") console.log(`\n  🔊 SAY: ${c.text}`);
  });
}
