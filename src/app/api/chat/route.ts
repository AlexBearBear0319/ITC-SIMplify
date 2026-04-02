import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { createClient } from "@/utils/supabase/server";

const SYSTEM_PROMPT_BASE = `You are the SIMplify Campus Guide, a practical assistant for SIM University students.
Your job is to recommend the best study spot using the real-time campus data provided.

RESPONSE STYLE (must follow):
- Plain text only (human-readable).
- Use point form with symbols (for example: ✅ ⚠️ 📍 💺 🔌).
- Do NOT use markdown syntax (no **bold**, no [text](link), no tables, no code blocks, no JSON).
- Keep replies concise (max 130 words).

SELECTION RULES:
1) Prioritise availability first:
   - Always check seats_available and current_status.
   - Avoid recommending "full" spots unless there is no better option.
   - Avoid recommending spots that are currently closed based on opening_time and CURRENT TIME.
2) Match user needs:
   - Charging need -> prefer power_outlets > 0.
   - Quiet focus -> look for quiet/silent cues in description or category.
   - Group study -> look for discussion/cafe-style spaces.
3) Give only top 2 spots unless user asks for more.
4) Ratings: if two spots are equally available, prefer the one with higher avg_rating.
5) Study groups: if user wants group study, mention any active study group at that spot (from ACTIVE STUDY GROUPS data).

OUTPUT FORMAT:
✅ Best Spots
• [Spot Name] (ID [id]) - Seats left: [x], Power: [y], Rating: [avg_rating]⭐, Why: [short reason], Go: /location/[id]
• [Spot Name] (ID [id]) - Seats left: [x], Power: [y], Rating: [avg_rating]⭐, Why: [short reason], Go: /location/[id]

EDGE CASES:
- If user request is vague, ask exactly one short clarifying question.
- If no suitable spot is available, say so clearly and provide one fallback option.
- For non-campus topics, briefly redirect to study-spot guidance.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const supabase = await createClient();

    const now = new Date();
    const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // Fetch locations, sessions, reviews, upcoming peak events, and active study groups in parallel
    const [
      { data: locations, error: dbError },
      { data: sessions },
      { data: reviews },
      { data: events },
      { data: studyGroups },
    ] = await Promise.all([
      supabase
        .from("locations")
        .select("id, name, category, current_status, location_text, opening_time, total_seats, power_outlets, description"),
      supabase
        .from("active_sessions")
        .select("location_id, seats_taken")
        .eq("is_active", true),
      supabase
        .from("reviews")
        .select("location_id, rating"),
      supabase
        .from("events")
        .select("title, location_id, event_date")
        .eq("is_peak_alert", true)
        .gte("event_date", now.toISOString())
        .lte("event_date", sixHoursLater.toISOString()),
      supabase
        .from("study_groups")
        .select("location_id, subject, current_members, max_members")
        .eq("is_active", true)
        .gt("expires_at", now.toISOString()),
    ]);

    if (dbError) {
      console.error("[chat/route] Supabase error:", dbError.message);
    }

    // Compute occupied seats per location
    const occupiedMap: Record<number, number> = {};
    (sessions ?? []).forEach((s: { location_id: number; seats_taken: number | null }) => {
      occupiedMap[s.location_id] = (occupiedMap[s.location_id] ?? 0) + (s.seats_taken ?? 1);
    });

    // Compute avg rating and review count per location
    const ratingMap: Record<number, { total: number; count: number }> = {};
    (reviews ?? []).forEach((r: { location_id: number; rating: number | null }) => {
      if (r.rating == null) return;
      if (!ratingMap[r.location_id]) ratingMap[r.location_id] = { total: 0, count: 0 };
      ratingMap[r.location_id].total += r.rating;
      ratingMap[r.location_id].count += 1;
    });

    // Enrich locations with seats_available, avg_rating, review_count
    const enriched = (locations ?? []).map((loc) => {
      const rm = ratingMap[loc.id];
      return {
        ...loc,
        seats_occupied: occupiedMap[loc.id] ?? 0,
        seats_available: loc.total_seats != null
          ? Math.max(0, loc.total_seats - (occupiedMap[loc.id] ?? 0))
          : null,
        avg_rating: rm ? Math.round((rm.total / rm.count) * 10) / 10 : null,
        review_count: rm ? rm.count : 0,
      };
    });

    // Format upcoming peak alerts
    const eventsText = (events ?? []).length > 0
      ? (events ?? []).map((e: { title: string; location_id: number | null; event_date: string }) => {
          const time = new Date(e.event_date).toLocaleTimeString("en-SG", {
            hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore",
          });
          return `⚠️ "${e.title}" at location ID ${e.location_id} around ${time} — expect crowds nearby`;
        }).join("\n")
      : "None";

    // Format active study groups
    const studyGroupsText = (studyGroups ?? []).length > 0
      ? (studyGroups ?? []).map((g: { location_id: number | null; subject: string; current_members: number | null; max_members: number | null }) =>
          `📚 Location ID ${g.location_id} — ${g.subject} group (${g.current_members ?? 0}/${g.max_members ?? 5} members)`
        ).join("\n")
      : "None";

    const currentTime = now.toLocaleString("en-SG", { timeZone: "Asia/Singapore" });

    const campusData = dbError
      ? "Campus data temporarily unavailable — give general advice based on common study spot types."
      : JSON.stringify(enriched, null, 0);

    const system = `${SYSTEM_PROMPT_BASE}

LIVE CAMPUS DATA (as of this request):
${campusData}

UPCOMING PEAK ALERTS (next 6 hours):
${eventsText}

ACTIVE STUDY GROUPS:
${studyGroupsText}

CURRENT TIME: ${currentTime}
CRITICAL: Only recommend spots that exist in the JSON above. Use current_status and opening_time to warn about or avoid unavailable spots. Use avg_rating to break ties between equally available spots.`;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 200,
      temperature: 0.2,
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[chat/route] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
