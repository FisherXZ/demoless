import { getDemoConfig as defaultGetDemoConfig, type DemoConfig } from "../config/demoConfig";
import {
  createOrchestrator as defaultCreateOrchestrator,
  type Orchestrator,
} from "../orchestrator";
import {
  startSession as defaultStartSession,
  type ScreenState,
} from "../../lib/browser/session";
import { loadBuyer as defaultLoadBuyer } from "../../lib/memory/store";
import type { BuyerMemory } from "../../lib/memory/types";
import {
  buildLearningsContext as defaultBuildLearningsContext,
  getLearnings as defaultGetLearnings,
} from "../../lib/learnings";
import type { Learning } from "../../lib/learnings/types";

type StartedBrowserSession = { liveViewUrl: string } & ScreenState;

export type StartBrowserSession = (
  url: string,
  onLiveView?: (liveViewUrl: string, sessionId: string) => void
) => Promise<StartedBrowserSession>;

export type CreateOrchestrator = (args: {
  sessionId: string;
  buyerId: string;
  company: string;
}) => Orchestrator;

export interface DemoSessionStartupDeps {
  startSession?: StartBrowserSession;
  createOrchestrator?: CreateOrchestrator;
  loadBuyer?: (buyerId: string) => Promise<BuyerMemory>;
  getLearnings?: (company: string) => Promise<Learning[]>;
  buildLearningsContext?: (learnings: Learning[]) => string;
  /**
   * Inject cross-session demo learnings into the prompt. Defaults to the
   * DEMO_LEARNINGS env flag (off unless set to on/1/true) — kept off by default
   * while learning quality is unproven. When off, the connect-time Redis read
   * and the per-turn prompt tokens are both skipped.
   */
  learningsEnabled?: boolean;
  /**
   * Fetch the buyer's prior-session memory (profile + notes) and let the agent
   * reference it — the "welcome back…" recall line and the notes injected into
   * the prompt. Defaults to the DEMO_MEMORY env flag (off unless set to
   * on/1/true) — kept off by default so the agent treats every visitor as new.
   * When off, the connect-time loadBuyer read is skipped entirely.
   */
  memoryEnabled?: boolean;
  getDemoConfig?: (company?: string) => DemoConfig;
  now?: () => number;
  log?: (message: string) => void;
}

export interface PrepareDemoSessionArgs {
  buyerId: string;
  /** Which product to demo (selected on the landing page). Defaults to the
   *  Browserbase config when absent or unknown. */
  company?: string;
  onLiveView: (liveViewUrl: string, sessionId: string) => void;
}

export interface PreparedDemoSession {
  sessionId: string;
  liveViewUrl: string;
  company: string;
  orchestrator: Orchestrator;
  buyer?: BuyerMemory;
  buyerNotes: string[];
  learningsContext: string;
}

export interface DemoSessionStartup {
  prewarm(company?: string): Promise<void>;
  prepare(args: PrepareDemoSessionArgs): Promise<PreparedDemoSession>;
}

interface WarmSession {
  sessionId: string;
  liveViewUrl: string;
  company: string;
  at: number;
}

const WARM_TTL_MS = 120_000;

export function createDemoSessionStartup(
  deps: DemoSessionStartupDeps = {}
): DemoSessionStartup {
  const startSession = deps.startSession ?? defaultStartSession;
  const createOrchestrator = deps.createOrchestrator ?? defaultCreateOrchestrator;
  const loadBuyer = deps.loadBuyer ?? defaultLoadBuyer;
  const getLearnings = deps.getLearnings ?? defaultGetLearnings;
  const buildLearningsContext =
    deps.buildLearningsContext ?? defaultBuildLearningsContext;
  const learningsEnabled =
    deps.learningsEnabled ??
    /^(on|1|true)$/i.test(process.env.DEMO_LEARNINGS ?? "");
  const memoryEnabled =
    deps.memoryEnabled ??
    /^(on|1|true)$/i.test(process.env.DEMO_MEMORY ?? "");
  const getDemoConfig = deps.getDemoConfig ?? defaultGetDemoConfig;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? console.log;
  let warmSession: WarmSession | null = null;

  const takeWarmSession = (
    company: string
  ): Omit<WarmSession, "at"> | null => {
    // Only reuse a warm browser that was opened for the SAME product — its tab
    // is parked on that product's URL, so handing it to another demo is wrong.
    if (
      warmSession &&
      warmSession.company === company &&
      now() - warmSession.at < WARM_TTL_MS
    ) {
      const { sessionId, liveViewUrl } = warmSession;
      warmSession = null;
      return { sessionId, liveViewUrl, company };
    }
    warmSession = null;
    return null;
  };

  return {
    async prewarm(company) {
      // Resolve the requested product (fall back to default for an unknown
      // slug) so the warm browser opens THAT product's URL.
      let cfg: DemoConfig;
      try {
        cfg = getDemoConfig(company);
      } catch {
        cfg = getDemoConfig();
      }
      // Already have a fresh warm browser for this product — nothing to do.
      if (
        warmSession &&
        warmSession.company === cfg.company &&
        now() - warmSession.at < WARM_TTL_MS
      ) {
        return;
      }
      try {
        const session = await startSession(cfg.browseTargetUrl);
        warmSession = {
          sessionId: session.sessionId,
          liveViewUrl: session.liveViewUrl,
          company: cfg.company,
          at: now(),
        };
      } catch {
        // Best-effort: warm-up never blocks the real start path.
      }
    },

    async prepare(args) {
      // Resolve the requested product; fall back to the default for an unknown
      // slug so a malformed query never crashes a live session.
      let cfg: DemoConfig;
      try {
        cfg = getDemoConfig(args.company);
      } catch {
        cfg = getDemoConfig();
      }
      const warm = takeWarmSession(cfg.company);
      let sessionId: string;
      let liveViewUrl: string;

      if (warm) {
        sessionId = warm.sessionId;
        liveViewUrl = warm.liveViewUrl;
      } else {
        const started = await startSession(cfg.browseTargetUrl, (url, sessionId) => {
          args.onLiveView(url, sessionId);
        });
        sessionId = started.sessionId;
        liveViewUrl = started.liveViewUrl;
      }

      const orchestrator = createOrchestrator({
        sessionId,
        buyerId: args.buyerId,
        company: cfg.company,
      });

      let buyer: BuyerMemory | undefined;
      let buyerNotes: string[] = [];
      if (memoryEnabled) {
        try {
          buyer = await loadBuyer(args.buyerId);
          buyerNotes = buyer.notes.map((note) => note.text);
        } catch {
          // Degrade gracefully: no buyer notes injected.
        }
      }

      let learningsContext = "";
      if (learningsEnabled) {
        try {
          learningsContext = buildLearningsContext(await getLearnings(cfg.company));
          if (learningsContext) {
            const count = learningsContext.split("\n").length - 1;
            log(
              `[learnings] loaded ${count} past-demo learning(s) for ${cfg.company} into this session's prompt`
            );
          }
        } catch {
          // Degrade gracefully: no cross-session learnings injected.
        }
      }

      return {
        sessionId,
        liveViewUrl,
        company: cfg.company,
        orchestrator,
        buyer,
        buyerNotes,
        learningsContext,
      };
    },
  };
}

export const defaultDemoSessionStartup = createDemoSessionStartup();
