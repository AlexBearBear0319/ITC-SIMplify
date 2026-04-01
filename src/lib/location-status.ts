import type { LocationStatus } from "@/lib/types/database";

/**
 * Single source of truth for location status derived from live occupancy.
 *
 * Rules:
 * 0% occupied        -> empty
 * 1% to 60% occupied -> empty
 * 61% to 90%         -> busy
 * 91%+               -> full
 */
export function deriveLocationStatus(
  occupiedSeats: number,
  totalSeats: number,
): LocationStatus {
  const safeOccupied = Math.max(0, occupiedSeats);
  const safeTotal = Math.max(0, totalSeats);

  if (safeTotal === 0 || safeOccupied === 0) return "empty";

  const fillPct = (safeOccupied / safeTotal) * 100;
  if (fillPct <= 60) return "empty";
  if (fillPct <= 90) return "busy";
  return "full";
}
