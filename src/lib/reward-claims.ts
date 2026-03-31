export const REWARD_CLAIM_PREFIX = "simplify-reward:";

export function buildRewardClaimPayload(claimToken: string): string {
  return `${REWARD_CLAIM_PREFIX}${claimToken}`;
}

export function extractRewardClaimToken(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;

  if (value.startsWith(REWARD_CLAIM_PREFIX)) {
    const token = value.slice(REWARD_CLAIM_PREFIX.length).trim();
    return token || null;
  }

  try {
    const parsed = new URL(value);
    const token = parsed.searchParams.get("token")?.trim();
    if (token) return token;
  } catch {
    // Not a URL - continue to other token formats.
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }

  return null;
}

export function isRewardPending(status: string | null | undefined): boolean {
  return (status ?? "pending") === "pending";
}

export function isRewardCollected(status: string | null | undefined): boolean {
  return status === "claimed";
}

export function getRewardStatusLabel(status: string | null | undefined): string {
  if (isRewardCollected(status)) return "Collected";
  if ((status ?? "pending") === "cancelled") return "Cancelled";
  return "Pending Collection";
}
