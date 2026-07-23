export const DELIVERY_STATUS = {
  PENDING: "pending",
  SCHEDULED: "scheduled",
  QUEUED: "queued",
  SENDING: "sending",
  SENT: "sent",
  DELIVERED: "delivered",
  OPENED: "opened",
  CLICKED: "clicked",
  FAILED: "failed",
  BOUNCED: "bounced",
  BLOCKED: "blocked",
  CANCELLED: "cancelled",
  SKIPPED: "skipped"
};

export const DELIVERY_STATUS_LABELS = {
  pending: "Pending",
  scheduled: "Scheduled",
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "Clicked",
  failed: "Failed",
  bounced: "Bounced",
  blocked: "Blocked",
  cancelled: "Cancelled",
  skipped: "Skipped"
};

export const DELIVERY_SUCCESS_STATES = new Set(["sent", "delivered", "opened", "clicked"]);
export const DELIVERY_ATTENTION_STATES = new Set(["failed", "bounced", "blocked"]);

export function normaliseDeliveryStatus(value = "") {
  const status = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  const aliases = {
    request: "sent",
    unique_opened: "opened",
    uniqueopened: "opened",
    first_opening: "opened",
    hard_bounce: "bounced",
    hardbounce: "bounced",
    soft_bounce: "bounced",
    softbounce: "bounced",
    invalid: "failed",
    error: "failed",
    deferred: "queued",
    not_requested: "pending",
    spam: "blocked",
    unsubscribe: "blocked",
    unsubscribed: "blocked",
    click: "clicked"
  };
  return aliases[status] || status || DELIVERY_STATUS.PENDING;
}
