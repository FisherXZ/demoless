import { describe, expect, it } from "vitest";
import { speechGateway } from "./speechGateway";

describe("speechGateway", () => {
  // DROP: pure stage directions the visitor can already see on screen.
  it.each([
    "Let me click into this.",
    "Let me click into the playground here.",
    "I'm going to click into this.",
    "I'll pull that up.",
    "Let me pull this up.",
    "Let me take a look.",
    "Let me take a look at the sessions page.",
    "Let me look at here.",
    "Let me navigate to the playground.",
    "I'm going to navigate there.",
    "Let me open this up.",
    "Let me go to sessions.",
    "Let me jump over to the dashboard.",
    "Let me scroll down here.",
  ])("drops the stage direction %j", (input) => {
    expect(speechGateway(input)).toBe("");
  });

  // DROP: bare interjections / waiting filler with no payoff.
  it.each([
    "Okay.",
    "Alright.",
    "Right.",
    "Sure.",
    "Perfect.",
    "Great.",
    "Got it.",
    "Here we go.",
    "Let's see.",
    "Let me see.",
    "One sec.",
    "One second.",
    "Give me a second.",
    "Hang on.",
    "Hold on.",
    "There we go.",
  ])("drops the filler interjection %j", (input) => {
    expect(speechGateway(input)).toBe("");
  });

  // STRIP: leading discourse markers, keep the substantive remainder (recased).
  it.each([
    ["Okay, so this is where your sessions live.", "This is where your sessions live."],
    ["So this one logged in once and it's still going.", "This one logged in once and it's still going."],
    ["Now, this kills the babysitting.", "This kills the babysitting."],
    ["Alright, you write the script, we run the browser.", "You write the script, we run the browser."],
    ["Well, that's the part that saves you the afternoon.", "That's the part that saves you the afternoon."],
  ])("strips the lead-in from %j", (input, expected) => {
    expect(speechGateway(input)).toBe(expected);
  });

  // PASS: real value lines must survive untouched, even when they open with a
  // lead-in verb. Eating these is the failure mode we most want to avoid.
  it.each([
    "Cloud browsers your agents drive, and they don't get blocked.",
    "You're losing an afternoon a week keeping these from breaking.",
    "This one logged in once and it's still going, so the babysitting is gone.",
    "Let me show you what this saves you over a week.",
    "Let me pull up sessions, because this is where your runs actually live.",
    "Stealth and proxies are on by default, so this never gets flagged.",
  ])("passes the value line %j unchanged", (input) => {
    expect(speechGateway(input)).toBe(input);
  });

  // Edge cases.
  it("returns empty for empty / whitespace input", () => {
    expect(speechGateway("")).toBe("");
    expect(speechGateway("   ")).toBe("");
  });

  it("drops a sentence that is only a lead-in marker", () => {
    expect(speechGateway("Okay, so.")).toBe("");
    expect(speechGateway("Now.")).toBe("");
  });
});
