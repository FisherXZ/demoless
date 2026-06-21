import { describe, it, expect } from "vitest";
import { NS, sessionKey, recapKey, SESSIONS_INDEX, buyerSessionsKey, replayUrl } from "./keys";

describe("sessions keys", () => {
  it("namespaces session and recap keys by id", () => {
    expect(NS).toBe("demoless");
    expect(sessionKey("s1")).toBe("demoless:session:s1");
    expect(recapKey("s1")).toBe("demoless:session:s1:recap");
    expect(SESSIONS_INDEX).toBe("demoless:sessions");
  });
  it("namespaces a buyer's session index by email", () => {
    expect(buyerSessionsKey("a@b.com")).toBe("demoless:buyer:a@b.com:sessions");
  });
  it("builds a browserbase replay url from the browserbase session id", () => {
    expect(replayUrl("bb1")).toBe("https://www.browserbase.com/sessions/bb1");
  });
});
