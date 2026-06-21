// Fake P3 (browser). Subscribes to navigate/click_or_type, logs the move, and
// reports back a faked screen_is_on — which triggers a narrate-only turn (Q5).
// Later: Browserbase + Stagehand. Same subscription + send() seam.

import type { Loop } from "../loop";

export function registerBrowserFake(loop: Loop) {
  loop.onCommand((c) => {
    if (c.kind === "navigate") {
      console.log(`\n  🖥️  NAVIGATE → ${c.target}`);
      loop.send({
        kind: "screen_is_on",
        url: `/${c.target}`,
        summary: `(fake) now showing ${c.target}`,
      });
    } else if (c.kind === "click_or_type") {
      console.log(`\n  🖱️  ACTION: ${c.instruction}`);
      loop.send({
        kind: "screen_is_on",
        url: loop.getState().screen?.url ?? "/",
        summary: `(fake) did: ${c.instruction}`,
      });
    }
  });
}
