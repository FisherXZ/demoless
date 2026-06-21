import { redirect } from "next/navigation";
import { SESSIONS } from "@/lib/dashboard/data";
import { listRecapSessions } from "@/lib/dashboard/source";

// No empty "select a session" state — open the most recent session directly.
// Prefer the newest real recorded session; fall back to the mock corpus when
// Redis is empty/unavailable. The list (left rail) stays visible for navigation.
export default async function SessionsPage() {
  let target = SESSIONS[0].id;
  try {
    const real = await listRecapSessions(1);
    if (real.length > 0) target = real[0].id;
  } catch {
    // Redis down — fall back to the most recent mock session.
  }
  // redirect() must be called outside try/catch (it signals via a thrown value).
  redirect(`/dashboard/sessions/${target}`);
}
