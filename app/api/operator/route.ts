import { NextResponse } from "next/server";
import { latestLiveBuyer } from "@/lib/dashboard/source";

// Read live records at request time so a fresh demo updates the badge without a rebuild.
export const dynamic = "force-dynamic";

/**
 * Exposes the most recent buyer (the person who last filled out the pre-call
 * form) to the client-side dashboard sidebar, which can't read the server-only
 * session store directly. Returns null fields when there are no sessions yet.
 */
export async function GET() {
  try {
    const buyer = await latestLiveBuyer();
    if (buyer) {
      return NextResponse.json({ name: buyer.name, company: buyer.company, initials: buyer.initials });
    }
  } catch {
    // Store down — fall through to the empty payload; the client keeps its defaults.
  }
  return NextResponse.json({ name: null, company: null, initials: null });
}
