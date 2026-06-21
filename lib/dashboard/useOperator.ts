"use client";

import { useEffect, useState } from "react";

/**
 * The most recent buyer (the person who last filled out the pre-call form),
 * for the dashboard sidebar badge. The client can't read the server-only
 * session store, so this fetches it. Falls back to the seeded operator until a
 * real buyer exists, so the prototype always renders a sensible identity.
 */
export interface Operator {
  name: string;
  company: string;
  initials: string;
}

const FALLBACK: Operator = { name: "Alex Rivera", company: "Browserbase · GTM", initials: "AR" };

let cached: Operator | null = null;
let inflight: Promise<Operator> | null = null;

function loadOperator(): Promise<Operator> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/operator")
      .then((r) => r.json())
      .then((d: Partial<Operator>) => {
        cached = d.name
          ? { name: d.name, company: d.company || FALLBACK.company, initials: d.initials || FALLBACK.initials }
          : FALLBACK;
        return cached;
      })
      .catch(() => FALLBACK)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useOperator(): Operator {
  const [op, setOp] = useState(cached ?? FALLBACK);

  useEffect(() => {
    let alive = true;
    void loadOperator().then((o) => {
      if (alive) setOp(o);
    });
    return () => {
      alive = false;
    };
  }, []);

  return op;
}
