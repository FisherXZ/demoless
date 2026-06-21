// Shared presentation helpers for rendering real recorded sessions on the
// dashboard (overview "recent" list + sessions rail). Pure, import-anywhere.
import type { RecapLabel } from "@/lib/sessions";

export const LABEL_TEXT: Record<RecapLabel, string> = {
  hot: "Hot",
  follow_up_needed: "Follow-up",
  nurture: "Nurture",
};

export const LABEL_CLASS: Record<RecapLabel, string> = {
  hot: "bg-[#E6F4EA] text-goodlit",
  follow_up_needed: "bg-[#FCF3E6] text-warnlit",
  nurture: "bg-slate2 text-ash",
};

/** "just now" / "5m ago" / "3h ago" / "2d ago" from an epoch-ms timestamp. */
export function relativeTime(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
