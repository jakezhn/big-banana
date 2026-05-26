const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 8
});

const integerFormatter = new Intl.NumberFormat("en-US");

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatNumber(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatNullableNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  return formatNumber(value);
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatEligible(value: boolean | null): string {
  if (value === null) {
    return "-";
  }

  return value ? "yes" : "no";
}

export function formatTokenUsage(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "usage unavailable";
  }

  const totalTokens = (value as { total_tokens?: unknown }).total_tokens;
  if (typeof totalTokens === "number") {
    return `${integerFormatter.format(totalTokens)} tokens`;
  }

  return "usage recorded";
}

export function shortenId(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}
