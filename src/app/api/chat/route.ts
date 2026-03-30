import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { createClient } from "@/utils/supabase/server";

const SYSTEM_PROMPT_BASE = `You are the SIMplify Campus Guide, a smart, friendly, and highly practical AI assistant for SIM University students.
Your mission is to find the perfect study spot for students based on their specific needs, using the real-time campus data provided.

CORE BEHAVIORS & ANALYSIS LOGIC:
1. Think like a student: Don't just list data; interpret it. (e.g., "Since your laptop is dying, I found a spot with 10 power outlets that's mostly empty.")
2. Prioritize Availability: ALWAYS check 'seats_available' and 'current_status'. Recommend spots with the most available seats. NEVER recommend a "full" spot unless it's the absolute only option, and heavily warn them.
3. Match the Vibe: 
   - Need to charge? Ensure 'power_outlets' > 0.
   - Need focus? Look for "quiet" or "silent" in the 'description' or 'category'.
   - Group work? Look for "discussion" or "cafe" areas.
4. Keep it Concise: Keep replies under 120 words total. Use plain, friendly English suitable for international students.

FORMATTING YOUR RESPONSE:
Always structure your recommendations cleanly:
- **Location Name**
- ⚡ Quick reason why it fits (mentioning available seats and power plugs).
- 🔗 [View Location Details](/location/{id}) 

*Note for links: Always generate a valid Markdown link using the exact 'id' from the JSON data. Replace {id} with the actual ID number.*

EDGE CASES:
- Vague requests: Ask ONE clarifying question (e.g., "Do you need a quiet zone, or a place where you can chat?").
- Multiple matches: Suggest only the Top 2 best spots to avoid overwhelming them.
- Non-campus questions: Politely redirect back to finding study spots.`;

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
