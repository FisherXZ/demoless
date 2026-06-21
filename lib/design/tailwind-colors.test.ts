import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";

type ColorMap = Record<string, string>;

function colors(): ColorMap {
  return (config.theme?.extend?.colors ?? {}) as ColorMap;
}

function channel(hex: string, start: number): number {
  return parseInt(hex.slice(start, start + 2), 16) / 255;
}

function linear(value: number): number {
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = linear(channel(clean, 0));
  const g = linear(channel(clean, 2));
  const b = linear(channel(clean, 4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("dashboard text color contrast", () => {
  it("keeps small light-surface UI text at WCAG AA contrast", () => {
    const c = colors();

    expect(contrastRatio(c.ember, c.slate)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.ember, c.obsidian)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.faint, c.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.ash, c.slate)).toBeGreaterThanOrEqual(4.5);
  });
});
