import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are an analytics assistant for SIMplify, a campus study-spot management platform used by SIM University.
Your audience is campus administrators and IT club staff — not students.

Your job:
- Analyse the usage snapshot provided and surface 2–3 sentences of actionable insight
- Lead with the most important observation first (good or bad)
- Call out any bottleneck, under-used resource, or unusual pattern
- End with one concrete recommendation the admin can act on today
- Use plain, professional English — no markdown, no bullet points, no headings
- Keep the total response under 80 words

Context you will receive per request:
- checkinsToday: total check-ins since midnight
- busiestSpot: location name + current capacity %
- avgStudyMins: average session length today
- activeGroups: number of live study groups + how many are open to join
- peakHour: busiest hour so far today with check-in count
- topCategory: most-used facility type this week + share %
- weeklyTotal: total sessions in the last 7 days

Respond only with the insight paragraph. Do not repeat the data back verbatim.`;

export async function POST(req: Request) {
  try {
    const { snapshot } = await req.json();

    if (!snapshot) {
      return new Response(JSON.stringify({ error: "Missing snapshot" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userMessage =
      `Analyse this campus usage snapshot and give me an admin insight:\n` +
      `• Check-ins today: ${snapshot.checkinsToday}\n` +
      `• Busiest spot: ${snapshot.busiestSpot} at ${snapshot.busiestCapacityPct}% capacity\n` +
      `• Average session length: ${snapshot.avgStudyMins} min\n` +
      `• Active study groups: ${snapshot.activeGroups} (${snapshot.groupsOpen} open to join)\n` +
      `• Peak hour today: ${snapshot.peakHour} with ${snapshot.peakCount} check-ins (${snapshot.peakDensity}% of daily peak)\n` +
      `• Top category this week: ${snapshot.topCategory} (${snapshot.topCategoryPct}%)\n` +
      `• Total sessions last 7 days: ${snapshot.weeklyTotal}`;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      maxOutputTokens: 150,
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[admin-insight/route] error:", err);
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
