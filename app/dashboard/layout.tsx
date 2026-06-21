"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/dashboard", label: "Overview", glyph: "▸" },
  { href: "/dashboard/sessions", label: "Sessions", glyph: "▤" },
  { href: "/dashboard/people", label: "People", glyph: "◴" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? path === href : path.startsWith(href);

  return (
    <div className="flex min-h-screen bg-obsidian text-chalk">
      <aside className="sticky top-0 flex h-screen w-[224px] flex-none flex-col border-r border-edge bg-[#EDF0F4] px-[13px] py-[16px]">
        <Link href="/" className="group flex items-center gap-[9px] px-2 pb-[18px] pt-1">
          <span className="flex h-[27px] w-[27px] items-center justify-center rounded-[8px] bg-brandlit transition-transform group-hover:scale-105">
            <span className="h-[10px] w-[10px] rounded-full bg-white" />
          </span>
          <span className="text-[15.5px] font-extrabold tracking-[-0.02em] text-chalk">
            Demoless
          </span>
        </Link>

        <span className="mb-[7px] px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ember">
          Workspace
        </span>
        <nav className="flex flex-col gap-[2px]">
          {NAV.map((n) => {
            const on = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={
                  "group relative flex items-center gap-[11px] rounded-[9px] px-[11px] py-[8px] text-[13px] transition-colors duration-150 " +
                  (on
                    ? "bg-slate2 font-semibold text-chalk"
                    : "text-ash hover:bg-slate hover:text-chalk")
                }
              >
                {on && (
                  <span className="absolute left-0 top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded-full bg-brandlit" />
                )}
                <span
                  className={
                    "font-mono text-[11px] " + (on ? "text-brandlit" : "text-ember group-hover:text-ash")
                  }
                >
                  {n.glyph}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-5 rounded-[10px] border border-edge bg-slate px-[12px] py-[11px]">
          <div className="flex items-center gap-[7px]">
            <span className="dl-live-dot h-[7px] w-[7px] flex-none rounded-full bg-livelit" />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ash">
              Agent live
            </span>
          </div>
          <p className="mt-[6px] text-[11.5px] leading-[1.4] text-ember">
            Demoing Browserbase · taking demos 24/7
          </p>
        </div>

        <div className="mt-auto flex items-center gap-[9px] rounded-[10px] px-2 py-2 transition-colors hover:bg-slate">
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
            AR
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-chalk">Alex Rivera</div>
            <div className="truncate font-mono text-[10.5px] text-ember">Browserbase · GTM</div>
          </div>
        </div>
      </aside>

      <main className="dl-grid dl-scroll min-w-0 flex-1 bg-obsidian">{children}</main>
    </div>
  );
}
