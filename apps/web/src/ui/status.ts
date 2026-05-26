export type StatusTone = "neutral" | "good" | "warn" | "bad" | "accent";

export type StatusMetadata = {
  label: string;
  tone: StatusTone;
  description: string;
};

const statusMetadataByValue: Record<string, StatusMetadata> = {
  failed: {
    label: "Failed",
    tone: "bad",
    description: "The agent run failed before producing a usable output."
  },
  invalid_output: {
    label: "Invalid Output",
    tone: "bad",
    description: "The agent run completed but returned an invalid output shape."
  },
  risk_rejected: {
    label: "Risk Rejected",
    tone: "bad",
    description: "The risk layer rejected this plan."
  },
  order_terminal: {
    label: "Order Terminal",
    tone: "good",
    description: "The latest order reached a terminal state."
  },
  success: {
    label: "Success",
    tone: "good",
    description: "The agent run completed successfully."
  },
  intent_ready: {
    label: "Intent Ready",
    tone: "accent",
    description: "An execution intent exists and is ready for order handling."
  },
  order_submitted: {
    label: "Order Submitted",
    tone: "accent",
    description: "An order has been submitted to the paper execution path."
  },
  normalized: {
    label: "Normalized",
    tone: "warn",
    description: "The webhook signal is normalized but no plan is ready yet."
  },
  plan_ready: {
    label: "Plan Ready",
    tone: "warn",
    description: "A trade plan exists and is waiting for downstream handling."
  },
  risk_approved: {
    label: "Risk Approved",
    tone: "warn",
    description: "Risk approved the plan, but order handling is not terminal."
  }
};

export function getStatusMetadata(value: string): StatusMetadata {
  return (
    statusMetadataByValue[value] ?? {
      label: humanizeStatus(value),
      tone: "neutral",
      description: "Unrecognized status from the current read model."
    }
  );
}

export function getStatusTone(value: string): StatusTone {
  return getStatusMetadata(value).tone;
}

function humanizeStatus(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
