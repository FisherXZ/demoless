import { redirect } from "next/navigation";
import { SESSIONS } from "@/lib/dashboard/data";
import {
  listRecapSessions,
  resolveDashboardMode,
  dashboardHref,
  listLiveSessions,
} from "@/lib/dashboard/source";

// No empty "select a session" state in demo mode — open the most recent session
// directly. In live mode, open the most recent real session, or show an empty
// state when none exist. The list (left rail) stays visible for navigation.
export default async function SessionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const mode = resolveDashboardMode(await searchParams);

  if (mode === "live") {
    let targetId: string | undefined;
    try {
      const live = await listLiveSessions(1);
      targetId = live[0]?.id;
    } catch {
      // Redis down — fall through to the empty state.
    }
    // redirect() must run outside try/catch (it throws to signal).
    if (targetId) redirect(dashboardHref(`/dashboard/sessions/${targetId}`, "live"));
    return (
      <div className="flex h-screen flex-col text-chalk">
        <header className="flex flex-none items-center gap-[10px] border-b border-edge px-[34px] py-[14px]">
          <span className="font-serif text-[17px] font-medium tracking-[-0.01em]">Sessions</span>
          <span className="dl-num ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
            Live mode
          </span>
        </header>
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="max-w-[440px] rounded-[14px] border border-edge bg-slate p-6 text-center">
            <div className="font-serif text-[22px] font-medium text-chalk">No live sessions yet</div>
            <p className="mb-0 mt-2 text-[13px] leading-[1.6] text-ash">
              Start a demo with a verified work email, then return here with Live mode on.
            </p>
          </div>
        </div>
      </div>
    );
  }

  let target = SESSIONS[0].id;
  try {
    const real = await listRecapSessions(1);
    if (real.length > 0) target = real[0].id;
  } catch {
    // Redis down — fall back to the most recent mock session.
  }
  redirect(dashboardHref(`/dashboard/sessions/${target}`, "demo"));
}
