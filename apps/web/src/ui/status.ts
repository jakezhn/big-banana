export type StatusTone = "neutral" | "good" | "warn" | "bad" | "accent";

const statusToneByValue: Record<string, StatusTone> = {
  failed: "bad",
  invalid_output: "bad",
  risk_rejected: "bad",
  order_terminal: "good",
  success: "good",
  intent_ready: "accent",
  order_submitted: "accent",
  normalized: "warn",
  plan_ready: "warn",
  risk_approved: "warn"
};

export function getStatusTone(value: string): StatusTone {
  return statusToneByValue[value] ?? "neutral";
}
