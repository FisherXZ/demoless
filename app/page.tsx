"use client";

import { useDemoState } from "@/lib/useDemoState";
import PrototypeNav from "@/components/PrototypeNav";
import Landing from "@/components/Landing";
import PreCallForm from "@/components/PreCallForm";
import DemoRoom from "@/components/DemoRoom";
import Dashboard from "@/components/Dashboard";

export default function Page() {
  const vals = useDemoState();

  return (
    <div className="min-h-screen bg-paper">
      {vals.screen === "landing" && <Landing vals={vals} />}
      {vals.screen === "form" && <PreCallForm vals={vals} />}
      {vals.screen === "room" && <DemoRoom vals={vals} />}
      {vals.screen === "dashboard" && <Dashboard vals={vals} />}
      <PrototypeNav vals={vals} />
    </div>
  );
}
