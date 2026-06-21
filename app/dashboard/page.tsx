import Link from "next/link";
import AskBar from "@/components/dashboard/AskBar";
import { kpis, split, timeline, SESSIONS, intentOf } from "@/lib/dashboard/data";
import {
  listRecapSessions,
  resolveDashboardMode,
  dashboardHref,
  listLiveSessions,
  listLivePeople,
  liveKpis,
  type LiveSessionView,
  type LivePersonView,
} from "@/lib/dashboard/source";
import type { SessionSummary } from "@/lib/sessions";
import { LABEL_TEXT, LABEL_CLASS, relativeTime } from "@/lib/dashboard/recapFormat";

// ── chart geometry helpers ───────────────────────────────────────────────

/** Catmull-Rom → cubic-bezier smoothing for a premium curve. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  const d = [`M ${pts[0][0]},${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`);
  }
  return d.join(" ");
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 72;
  const h = 22;
  const max = Math.max(...data, 1);
  const pts = data.map(
    (v, i) => [(i / (data.length - 1)) * w, h - 2 - (v / max) * (h - 4)] as [number, number]
  );
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="1.8" fill={color} />
    </svg>
  );
}

// ── donut ─────────────────────────────────────────────────────────────────

function conic(slices: { count: number }[], colors: string[]): string {
  const total = slices.reduce((a, s) => a + s.count, 0) || 1;
  let acc = 0;
  const stops = slices.map((s, i) => {
    const start = (acc / total) * 100;
    acc += s.count;
    const end = (acc / total) * 100;
    return `${colors[i % colors.length]} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(",")})`;
}

function Donut({
  title,
  data,
  colors,
}: {
  title: string;
  data: { label: string; count: number; pct: number }[];
  colors: string[];
}) {
  const total = data.reduce((a, s) => a + s.count, 0);
  return (
    <div className="rounded-[14px] border border-edge bg-slate p-[18px]">
      <div className="mb-[16px] flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-chalk">{title}</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ember">30d</span>
      </div>
      <div className="flex items-center gap-[22px]">
        <div
          className="flex h-[92px] w-[92px] flex-none items-center justify-center rounded-full"
          style={{ background: conic(data, colors) }}
        >
          <div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-slate">
            <b className="dl-num text-[19px] font-semibold text-chalk">{total}</b>
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ember">total</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-[10px] text-[13px]">
          {data.map((d, i) => (
            <div key={d.label} className="flex items-center gap-2 text-ash">
              <span
                className="h-[9px] w-[9px] flex-none rounded-[3px]"
                style={{ background: colors[i % colors.length] }}
              />
              {d.label}
              <span className="dl-num ml-auto pl-3 font-mono text-chalk">{d.count}</span>
              <span className="dl-num w-9 text-right font-mono text-ember">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── timeline ────────────────────────────────────────────────────────────────

function Timeline() {
  const { all, qual, days } = timeline();
  const W = 660;
  const H = 168;
  const PAD_L = 26;
  const PAD_B = 22;
  const PAD_T = 10;
  const max = Math.max(...all, 1);
  const innerW = W - PAD_L;
  const innerH = H - PAD_B - PAD_T;
  const x = (i: number) => PAD_L + (i / (days - 1)) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
  const series = (arr: number[]) => arr.map((v, i) => [x(i), y(v)] as [number, number]);
  const allPts = series(all);
  const qualPts = series(qual);
  const ticks = [0, Math.round(max / 2), max];

  return (
    <div className="rounded-[14px] border border-edge bg-slate p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-chalk">Demo volume</h3>
          <div className="mt-[7px] flex gap-4 font-mono text-[11px]">
            <span className="inline-flex items-center gap-[6px] text-ash">
              <i className="inline-block h-[2px] w-[16px] rounded bg-ash" />
              All sessions
            </span>
            <span className="inline-flex items-center gap-[6px] text-ash">
              <i className="inline-block h-[2px] w-[16px] rounded bg-brandlit" />
              Qualified
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 rounded-[9px] border border-edge bg-obsidian p-[3px]">
          {["7d", "1m", "3m", "1y"].map((t) => (
            <span
              key={t}
              className={
                "rounded-[6px] px-[10px] py-[3px] font-mono text-[11px] " +
                (t === "1m" ? "bg-slate2 text-chalk" : "text-ember")
              }
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        <defs>
          <linearGradient id="qualFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A41D6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3A41D6" stopOpacity="0" />
          </linearGradient>
          <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* gridlines + y ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} y1={y(t)} x2={W} y2={y(t)} stroke="#E3E7EC" strokeWidth="1" />
            <text
              x={PAD_L - 8}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-ember font-mono"
              style={{ fontSize: 9 }}
            >
              {t}
            </text>
          </g>
        ))}

        {/* qualified area + glowing line */}
        <path
          d={`${smoothPath(qualPts)} L ${x(days - 1)},${PAD_T + innerH} L ${PAD_L},${PAD_T + innerH} Z`}
          fill="url(#qualFill)"
        />
        <path
          d={smoothPath(allPts)}
          fill="none"
          stroke="#8A94A2"
          strokeWidth="1.6"
          strokeOpacity="0.65"
          strokeLinecap="round"
        />
        <path
          d={smoothPath(qualPts)}
          fill="none"
          stroke="#3A41D6"
          strokeWidth="2.4"
          strokeLinecap="round"
          filter="url(#lineGlow)"
        />
        {qualPts.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2.4" fill="#FFFFFF" stroke="#3A41D6" strokeWidth="1.6" />
        ))}

        {/* x axis ticks */}
        {["9d", "6d", "3d", "now"].map((lbl, i) => (
          <text
            key={lbl}
            x={PAD_L + (i / 3) * innerW}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}
            className="fill-ember font-mono"
            style={{ fontSize: 9 }}
          >
            {lbl}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── real sessions ─────────────────────────────────────────────────────────

/** Real recorded demo sessions, newest first — each links to its recap. */
function RecentSessions({ sessions, now }: { sessions: SessionSummary[]; now: number }) {
  return (
    <div className="mt-[18px] rounded-[12px] border border-edge bg-slate p-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ember">
          Recent demo sessions
        </span>
        <span className="font-mono text-[10px] text-ember">{sessions.length} recorded</span>
      </div>
      <div className="flex flex-col">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/sessions/${s.id}`}
            className="group flex items-center gap-3 rounded-[9px] px-2 py-[10px] transition-colors hover:bg-slate2"
          >
            <span
              className={
                "flex-none rounded-[5px] px-[7px] py-px font-mono text-[9px] font-semibold uppercase tracking-[0.05em] " +
                (s.label ? LABEL_CLASS[s.label] : "bg-slate2 text-ember")
              }
            >
              {s.label ? LABEL_TEXT[s.label] : "Analyzing"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-chalk">{s.summary || "Recap pending…"}</div>
              <div className="truncate text-[11px] text-ember">{s.company}</div>
            </div>
            <span className="flex-none font-mono text-[11px] text-ember">
              {relativeTime(s.endedAt ?? s.startedAt ?? s.createdAt, now)}
            </span>
            <span className="flex-none font-mono text-[13px] text-ember transition-transform group-hover:translate-x-0.5 group-hover:text-brandlit">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────

const DEVICE_COLORS = ["#3A41D6", "#E3E7EC"]; // brandlit, edge
const SOURCE_COLORS = ["#16A34A", "#15803D", "#E3E7EC"]; // goodlit, deep green, edge

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const mode = resolveDashboardMode(await searchParams);
  if (mode === "live") return <LiveOverviewPage />;
  return <DemoOverviewPage />;
}

// ── live overview — factual only (no scores / intent / qualification) ───────

async function LiveOverviewPage() {
  let sessions: LiveSessionView[] = [];
  let people: LivePersonView[] = [];
  try {
    [sessions, people] = await Promise.all([listLiveSessions(50), listLivePeople(100)]);
  } catch {
    // Redis down — render the empty state below.
  }
  const k = liveKpis(sessions);
  const now = Date.now();
  const latest = sessions[0];

  const cards = [
    { label: "Sessions", value: String(k.total), sub: "recorded" },
    { label: "Live now", value: String(k.live), sub: "in progress" },
    { label: "Ended", value: String(k.ended), sub: "completed" },
    { label: "With replay", value: String(k.withReplay), sub: "Browserbase" },
  ];

  return (
    <div className="dl-page px-[34px] py-[26px]">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-medium tracking-[-0.015em] text-chalk">
            Live sessions
          </h1>
          <p className="mt-[3px] text-[13px] text-ash">
            Real recorded demos — buyer, transcript, trace, and replay. Facts only.
          </p>
        </div>
        <div className="flex items-center gap-[7px] rounded-full border border-edge bg-slate px-[11px] py-[5px]">
          <span className="dl-live-dot h-[6px] w-[6px] rounded-full bg-livelit" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ash">
            Live datastore
          </span>
        </div>
      </div>

      {latest ? (
        <Link
          href={dashboardHref(`/dashboard/sessions/${latest.id}`, "live")}
          className="group mt-[18px] flex items-center gap-4 rounded-[12px] border border-edge bg-slate px-4 py-[13px] transition-colors hover:border-ember"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ember">Latest</span>
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] bg-[#EDF0F4] font-mono text-[11px] font-bold text-[#2A2FA8]">
            {latest.buyer.initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-semibold text-chalk">
                {latest.buyer.email}
              </span>
              <span
                className={
                  "flex-none rounded-[5px] px-[6px] py-px font-mono text-[9px] font-semibold uppercase tracking-[0.05em] " +
                  (latest.isLive ? "bg-[#E6F4EA] text-goodlit" : "bg-slate2 text-ash")
                }
              >
                {latest.isLive ? "Live" : latest.status}
              </span>
            </div>
            <div className="truncate text-[12px] text-ember">{latest.buyer.company}</div>
          </div>
          <span className="ml-auto font-mono text-[11px] text-ember">
            {latest.isLive ? "now" : relativeTime(latest.whenTs, now)}
          </span>
          <span className="font-mono text-[14px] text-ember transition-transform group-hover:translate-x-0.5 group-hover:text-brandlit">
            →
          </span>
        </Link>
      ) : (
        <div className="mt-[18px] rounded-[12px] border border-edge bg-slate p-6 text-center">
          <div className="font-serif text-[21px] font-medium text-chalk">No live sessions yet</div>
          <p className="mb-0 mt-2 text-[13px] leading-[1.6] text-ash">
            Start a demo with a verified work email, then return here in Live mode.
          </p>
        </div>
      )}

      <div className="my-5 grid grid-cols-1 gap-[12px] md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="flex flex-col rounded-[14px] border border-edge bg-slate p-[18px]">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ember">{c.label}</span>
            <span className="dl-num mt-[10px] font-mono text-[30px] font-semibold leading-none text-chalk">
              {c.value}
            </span>
            <span className="mt-auto pt-[14px] font-mono text-[11px] text-ember">{c.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[12px] lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[14px] border border-edge bg-slate p-[18px]">
          <div className="mb-[14px] flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-chalk">Recent sessions</h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ember">
              {sessions.length} total
            </span>
          </div>
          <div className="flex flex-col">
            {sessions.slice(0, 7).map((s) => (
              <Link
                key={s.id}
                href={dashboardHref(`/dashboard/sessions/${s.id}`, "live")}
                className="flex items-center gap-3 border-t border-edge2 py-[11px] first:border-t-0"
              >
                <span className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[7px] bg-slate2 font-mono text-[10px] font-bold text-brandlit2">
                  {s.buyer.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-chalk">{s.buyer.email}</div>
                  <div className="truncate font-mono text-[10px] text-ember">{s.buyer.company}</div>
                </div>
                <span className="font-mono text-[10px] text-ember">
                  {s.isLive ? "now" : relativeTime(s.whenTs, now)}
                </span>
              </Link>
            ))}
            {sessions.length === 0 && (
              <p className="m-0 text-[13px] text-ash">No recorded sessions to show.</p>
            )}
          </div>
        </div>

        <div className="rounded-[14px] border border-edge bg-slate p-[18px]">
          <div className="mb-[14px] flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-chalk">People</h3>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ember">
              {people.length} buyers
            </span>
          </div>
          <div className="flex flex-col">
            {people.slice(0, 7).map((p) => (
              <Link
                key={p.id}
                href={dashboardHref(`/dashboard/people/${p.id}`, "live")}
                className="flex items-center gap-3 border-t border-edge2 py-[11px] first:border-t-0"
              >
                <span className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[7px] bg-slate2 font-mono text-[10px] font-bold text-brandlit2">
                  {p.initials}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-chalk">
                  {p.email}
                </span>
                <span className="font-mono text-[10px] text-ember">{p.sessionCount}</span>
              </Link>
            ))}
            {people.length === 0 && (
              <p className="m-0 text-[13px] text-ash">No buyers to show.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── demo overview — the existing seeded dashboard (unchanged) ───────────────

async function DemoOverviewPage() {
  const k = kpis();
  const { all, qual } = timeline();
  const devices = split((s) => s.device);
  const sources = split((s) => s.source);
  const latest = SESSIONS[0];

  // Real recorded sessions (newest first). Falls back to the mock "Latest" hero
  // when Redis is empty or unavailable, so the prototype still renders.
  let recent: SessionSummary[] = [];
  try {
    recent = await listRecapSessions(8);
  } catch {
    // Redis down — keep recent empty and render the mock hero below.
  }
  const now = Date.now();

  const cards = [
    { label: "Sessions", value: String(k.total), delta: "+18%", sub: "vs prev 30d", up: true, spark: all },
    { label: "Avg length", value: k.avgLabel, delta: "+43%", sub: "engaged time", up: true },
    { label: "High intent", value: String(k.highIntent), delta: `of ${k.total}`, sub: "strong signals", up: null },
  ];

  return (
    <div className="dl-page px-[34px] py-[26px]">
      {/* header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-medium tracking-[-0.015em] text-chalk">
            Good evening, Alex
          </h1>
          <p className="mt-[3px] text-[13px] text-ash">
            Every demo, scored and summarized — automatically.
          </p>
        </div>
        <div className="flex items-center gap-[7px] rounded-full border border-edge bg-slate px-[11px] py-[5px]">
          <span className="dl-live-dot h-[6px] w-[6px] rounded-full bg-livelit" />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ash">
            Live · last 30d
          </span>
        </div>
      </div>

      {/* recorded sessions — real demos when present, else the mock hero */}
      {recent.length > 0 ? (
        <RecentSessions sessions={recent} now={now} />
      ) : (
      <Link
        href={`/dashboard/sessions/${latest.id}`}
        className="group mt-[18px] flex items-center gap-4 rounded-[12px] border border-edge bg-slate px-4 py-[13px] transition-colors hover:border-ember"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ember">Latest</span>
        <span
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] font-mono text-[11px] font-bold"
          style={{ background: "#EDF0F4", color: "#2A2FA8" }}
        >
          {latest.buyer.initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-chalk">{latest.buyer.company}</span>
            {latest.qualified && (
              <span className="rounded-[5px] bg-[#E6F4EA] px-[6px] py-px font-mono text-[9px] font-semibold uppercase tracking-[0.05em] text-goodlit">
                Qualified
              </span>
            )}
          </div>
          <div className="truncate text-[12px] text-ember">
            {latest.buyer.role} · {intentOf(latest.score)} intent
          </div>
        </div>
        <div className="ml-auto flex items-center gap-5">
          <div className="text-right">
            <div className="dl-num font-mono text-[19px] font-semibold text-goodlit">{latest.score}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-ember">score</div>
          </div>
          <span className="font-mono text-[11px] text-ember">{latest.startedLabel}</span>
          <span className="font-mono text-[14px] text-ember transition-transform group-hover:translate-x-0.5 group-hover:text-brandlit">
            →
          </span>
        </div>
      </Link>
      )}

      <AskBar />

      {/* KPI row — featured Qualified card + secondary metrics */}
      <div className="my-5 grid grid-cols-1 gap-[12px] md:grid-cols-2 lg:grid-cols-4">
        {/* hero metric */}
        <div className="rounded-[14px] border border-brandlit/40 bg-accentsoft p-[18px] lg:row-span-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-brandlit2">
              Qualified rate
            </span>
            <span className="font-mono text-[11px] font-semibold text-goodlit">▲ 11 pts</span>
          </div>
          <div className="dl-num mt-[10px] font-mono text-[34px] font-bold leading-none tracking-[-0.02em] text-chalk">
            {k.qualifiedPct}
            <span className="text-[20px] text-ash">%</span>
          </div>
          <div className="mt-[14px] h-[5px] w-full overflow-hidden rounded-full bg-slate">
            <div
              className="h-full rounded-full bg-brandlit"
              style={{ width: `${k.qualifiedPct}%` }}
            />
          </div>
          <div className="mt-[8px] font-mono text-[11px] text-ember">
            {k.qualified} of {k.total} demos qualified
          </div>
        </div>

        {/* secondary metrics */}
        {cards.map((c) => (
          <div
            key={c.label}
            className="flex flex-col rounded-[14px] border border-edge bg-slate p-[18px] transition-colors hover:border-ember"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
              {c.label}
            </span>
            <div className="mt-[10px] flex items-end justify-between">
              <span className="dl-num font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] text-chalk">
                {c.value}
              </span>
              {c.spark && <Sparkline data={c.spark} color="#3A41D6" />}
            </div>
            <div className="mt-auto flex items-center gap-[7px] pt-[14px]">
              <span
                className={
                  "font-mono text-[11.5px] font-semibold " +
                  (c.up === true ? "text-goodlit" : c.up === false ? "text-dangerlit" : "text-ash")
                }
              >
                {c.up === true ? "▲ " : c.up === false ? "▼ " : ""}
                {c.delta}
              </span>
              <span className="font-mono text-[11px] text-ember">{c.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* charts */}
      <div className="mb-[14px]">
        <Timeline />
      </div>
      <div className="grid grid-cols-1 gap-[12px] lg:grid-cols-2">
        <Donut title="Device breakdown" data={devices} colors={DEVICE_COLORS} />
        <Donut title="Top sources" data={sources} colors={SOURCE_COLORS} />
      </div>
    </div>
  );
}
