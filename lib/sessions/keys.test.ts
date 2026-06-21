import { describe, it, expect } from "vitest";
import { NS, sessionKey, recapKey, SESSIONS_INDEX, replayUrl } from "./keys";

describe("sessions keys", () => {
  it("namespaces session and recap keys by id", () => {
    expect(NS).toBe("demoless");
    expect(sessionKey("s1")).toBe("demoless:session:s1");
    expect(recapKey("s1")).toBe("demoless:session:s1:recap");
    expect(SESSIONS_INDEX).toBe("demoless:sessions");
  });
  it("builds a browserbase replay url", () => {
    expect(replayUrl("s1")).toBe("https://www.browserbase.com/sessions/s1");
  });
});
