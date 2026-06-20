// The tagged demo-step catalog (Q7). Each step is tagged with the pains it
// addresses; DISCOVERY filters this into the walkthrough subset. Placeholder
// product = Demoless demoing itself. Swap for the real target's steps later.

export interface DemoStep {
  id: string;
  addresses: string[]; // pain phrases this step speaks to
  navigate: string; // target the agent navigates to
  say: string; // talking point
}

export const CATALOG: DemoStep[] = [
  {
    id: "automation",
    addresses: ["manual prep", "wasting time", "hours preparing"],
    navigate: "campaigns/new",
    say: "Here's how a demo gets built automatically — no manual prep.",
  },
  {
    id: "personalization",
    addresses: ["generic demos", "one-size-fits-all", "same thing to everyone"],
    navigate: "dashboard",
    say: "Watch how the walkthrough adapts to each prospect's profile.",
  },
  {
    id: "analytics",
    addresses: ["no visibility", "can't measure", "no insight"],
    navigate: "analytics",
    say: "This is where every conversation's signals show up.",
  },
  {
    id: "memory",
    addresses: ["repeat visitors", "context loss", "starting over"],
    navigate: "buyers",
    say: "And it remembers each buyer across visits — here's the buyer view.",
  },
];
