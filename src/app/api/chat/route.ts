import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { createClient } from "@/utils/supabase/server";

const SYSTEM_PROMPT_BASE = `You are the SIMplify Campus Guide, a helpful AI assistant for SIM University students.
Your job is to recommend study spots on campus based on what the student needs.

Guidelines:
- Be concise — keep replies under 120 words unless asked for detail
- Be friendly and approachable in plain, clear English suitable for international students
- Format recommendations clearly: spot name on its own line, then key features as short bullets
- If the user's request is vague, ask ONE clarifying question
- If no spots match perfectly, suggest the closest alternative and explain why
- If asked something unrelated to study spots or the campus, politely redirect

Schema reference for the LIVE DATA below:
- name: location name
- category: type of space (e.g. Library, IT Lab, Cafeteria, Study Room, Outdoor)
- current_status: real-time occupancy — "empty" (very available), "busy" (some space left), or "full" (no space)
- location_text: floor / building info
- opening_time: operating hours
- total_seats: total seats available
- power_outlets: number of power outlets (0 = none)
- description: extra details about the spot`;

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
