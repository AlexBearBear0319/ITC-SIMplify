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
2) Match user needs:
   - Charging need -> prefer power_outlets > 0.
   - Quiet focus -> look for quiet/silent cues in description or category.
   - Group study -> look for discussion/cafe-style spaces.
3) Give only top 2 spots unless user asks for more.

OUTPUT FORMAT:
✅ Best Spots
• [Spot Name] (ID [id]) - Seats left: [x], Power: [y], Why: [short reason], Go: /location/[id]
• [Spot Name] (ID [id]) - Seats left: [x], Power: [y], Why: [short reason], Go: /location/[id]

EDGE CASES:
- If user request is vague, ask exactly one short clarifying question.
- If no suitable spot is available, say so clearly and provide one fallback option.
- For non-campus topics, briefly redirect to study-spot guidance.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const supabase = await createClient();

    // Fetch locations + active session seat tallies in parallel
    const [{ data: locations, error: dbError }, { data: sessions }] = await Promise.all([
      supabase
        .from("locations")
        .select("id, name, category, current_status, location_text, opening_time, total_seats, power_outlets, description"),
      supabase
        .from("active_sessions")
        .select("location_id, seats_taken")
        .eq("is_active", true),
    ]);

    if (dbError) {
      console.error("[chat/route] Supabase error:", dbError.message);
    }

    // Compute occupied seats per location
    const occupiedMap: Record<number, number> = {};
    (sessions ?? []).forEach((s: { location_id: number; seats_taken: number | null }) => {
      occupiedMap[s.location_id] = (occupiedMap[s.location_id] ?? 0) + (s.seats_taken ?? 1);
    });

    // Enrich locations with seats_available
    const enriched = (locations ?? []).map((loc) => ({
      ...loc,
      seats_occupied: occupiedMap[loc.id] ?? 0,
      seats_available: loc.total_seats != null
        ? Math.max(0, loc.total_seats - (occupiedMap[loc.id] ?? 0))
        : null,
    }));

    const campusData = dbError
      ? "Campus data temporarily unavailable — give general advice based on common study spot types."
      : JSON.stringify(enriched, null, 0);

    const system = `${SYSTEM_PROMPT_BASE}

LIVE CAMPUS DATA (as of this request):
${campusData}

CRITICAL: Only recommend spots that exist in the JSON above. Use current_status to warn about full spots.`;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 350,
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
