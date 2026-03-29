import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { createClient } from "@/utils/supabase/server";

const SYSTEM_PROMPT_BASE = `You are the SIMplify Campus Guide, an AI assistant for SIM University students.
Your job is to recommend study spots on campus based on what the student needs.

Guidelines:
- Be concise — keep replies under 120 words unless asked for detail
- Be friendly and occasionally use Singlish slang (e.g. "can lah", "confirm got power outlets one", "very shiok spot", "walao so packed", "chope the seat fast")
- Format recommendations clearly: spot name on its own line, then key features as short bullets
- If the user's request is vague, ask ONE clarifying question
- If no spots match perfectly, suggest the closest alternative and explain why
- If asked something unrelated to study spots or the campus, politely redirect

Schema reference for the LIVE DATA below:
- name: location name
- category: type of space (e.g. Library, IT Lab, Cafeteria, Study Room, Outdoor)
- current_status: real-time occupancy — "empty" (go go go!), "busy" (still got space), or "full" (siam lah, no space)
- location_text: floor / building info
- opening_time: operating hours
- total_seats: total seats available
- power_outlets: number of power outlets (0 = none)
- description: extra details about the spot`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Fetch live location data from Supabase before calling OpenAI
  const supabase = await createClient();
  const { data: locations, error } = await supabase
    .from("locations")
    .select("name, category, current_status, location_text, opening_time, total_seats, power_outlets, description");

  const campusData = error
    ? "Campus data temporarily unavailable — give general advice based on common study spot types."
    : JSON.stringify(locations, null, 0);

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
}
