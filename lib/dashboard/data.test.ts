import { describe, expect, it } from "vitest";
import {
  SESSIONS,
  SIGNAL_GLYPH,
  fmtDuration,
  getBuyerSession,
  getSession,
  intentColor,
  intentOf,
  kpis,
  scoreColor,
  split,
  timeline,
} from "./data";

describe("dashboard seed data", () => {
  it("contains Browserbase-flavored sessions with complete buyer and follow-up shape", () => {
    expect(SESSIONS.length).toBeGreaterThan(10);
    for (const session of SESSIONS) {
      expect(session.id).toMatch(/^s\d+$/);
      expect(session.buyer.email).toContain("@");
      expect(session.signals.length).toBeGreaterThan(0);
      expect(session.followUp.cta).not.toBe("");
    }
  });

  it("classifies intent and score colors at the documented thresholds", () => {
    expect(intentOf(75)).toBe("High");
    expect(intentOf(74)).toBe("Medium");
    expect(intentOf(55)).toBe("Medium");
    expect(intentOf(54)).toBe("Low");

    expect(scoreColor(80)).toBe("good");
    expect(scoreColor(65)).toBe("branddeep");
    expect(scoreColor(64)).toBe("warn");

    expect(intentColor(90)).toBe("good");
    expect(intentColor(60)).toBe("warn");
    expect(intentColor(10)).toBe("muted2");
  });

  it("derives aggregate KPIs from the session corpus", () => {
    const stats = kpis();
    const qualified = SESSIONS.filter((s) => s.qualified).length;

    expect(stats.total).toBe(SESSIONS.length);
    expect(stats.qualified).toBe(qualified);
    expect(stats.qualifiedPct).toBe(
      Math.round((qualified / SESSIONS.length) * 1000) / 10
    );
    expect(stats.highIntent).toBe(
      SESSIONS.filter((s) => intentOf(s.score) === "High").length
    );
    expect(stats.avgLabel).toMatch(/^\d+m \d{2}s$/);
  });

  it("formats durations and split buckets for charts", () => {
    expect(fmtDuration(188)).toBe("3:08");

    const byDevice = split((s) => s.device);
    expect(byDevice.reduce((sum, row) => sum + row.count, 0)).toBe(SESSIONS.length);
    expect(byDevice[0].count).toBeGreaterThanOrEqual(byDevice.at(-1)!.count);
    expect(byDevice.every((row) => row.pct > 0)).toBe(true);
  });

  it("builds the timeline series across all day buckets", () => {
    const t = timeline();

    expect(t.days).toBe(9);
    expect(t.all).toHaveLength(9);
    expect(t.qual).toHaveLength(9);
    expect(t.all.reduce((a, b) => a + b, 0)).toBe(SESSIONS.length);
    expect(t.qual.reduce((a, b) => a + b, 0)).toBe(
      SESSIONS.filter((s) => s.qualified).length
    );
  });

  it("looks up sessions by session id or buyer id", () => {
    expect(getSession("s1")?.buyer.name).toBe("Priya Menon");
    expect(getSession("missing")).toBeUndefined();

    expect(getBuyerSession("b1")?.id).toBe("s1");
    expect(getBuyerSession("missing")).toBeUndefined();
  });

  it("maps each signal type to a dashboard glyph", () => {
    expect(SIGNAL_GLYPH).toEqual({
      interest: { mark: "+", cls: "int" },
      objection: { mark: "!", cls: "obj" },
      role: { mark: "·", cls: "neu" },
      question: { mark: "?", cls: "neu" },
    });
  });
});
