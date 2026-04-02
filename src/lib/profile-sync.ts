export const PROFILE_STATS_DIRTY_EVENT = "simplify:profile-stats-dirty";

export function markProfileStatsDirty() {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem("simplify_points_dirty", "1");
  } catch {
    // ignore session storage failures
  }

  window.dispatchEvent(new Event(PROFILE_STATS_DIRTY_EVENT));
}
