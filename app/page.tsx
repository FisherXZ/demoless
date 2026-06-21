"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDemoState } from "@/lib/useDemoState";
import Landing from "@/components/Landing";
import PreCallForm from "@/components/PreCallForm";
import DemoRoom from "@/components/DemoRoom";

export default function Page() {
  const vals = useDemoState();
  const router = useRouter();

  // The buyer flow (landing → form → room) stays on screen-state; "End call"
  // (goDashboard) routes into the real operator app.
  useEffect(() => {
    if (vals.screen === "dashboard") router.replace("/dashboard");
  }, [vals.screen, router]);

  return (
    <div className="min-h-screen bg-paper">
      {vals.screen === "landing" && <Landing vals={vals} />}
      {vals.screen === "form" && <PreCallForm vals={vals} />}
      {vals.screen === "room" && <DemoRoom vals={vals} />}
    </div>
  );
}
