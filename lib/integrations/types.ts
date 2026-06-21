// Outbound integration layer: routes a finished session's evidence-backed
// SessionPacket out to the seller's tech stack. The SEND is mocked (no real
// HubSpot/Clay/Linear round-trip), but every action's CONTENT is derived from
// the real packet — the only fake part is the network call.

/** The three connected tools we mock. */
export type ConnectorId = "hubspot" | "clay" | "linear";

/** One label/value row shown in an action's expandable payload. */
export interface ActionField {
  label: string;
  value: string;
}

/** An integration action before it is persisted (id/ts stamped on write). */
export interface DraftAction {
  connector: ConnectorId;
  sessionId: string;
  company: string;
  buyer: string;
  /** Feed headline, e.g. "Deal updated → Hot — Demo Qualified". */
  title: string;
  /** One-line subline under the headline. */
  detail: string;
  /** Mock external link/id (HubSpot deal URL, "DEM-142", …). */
  externalRef?: string;
  /** The connector-specific payload, rendered in the expandable card. */
  fields: ActionField[];
}

/** A persisted integration action (what the dashboard feed reads). */
export interface IntegrationAction extends DraftAction {
  id: string;
  ts: number;
}

/** Per-connector rollup for the "Connected" cards. */
export interface ConnectorStatus {
  connector: ConnectorId;
  lastSyncTs: number | null;
  count: number;
}
