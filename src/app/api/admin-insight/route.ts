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

    const lines: string[] = ["Analyse this campus usage snapshot and give me an admin insight:"];
    if (snapshot.checkinsToday  != null) lines.push(`• Check-ins today: ${snapshot.checkinsToday}`);
    if (snapshot.weeklyTotal    != null) lines.push(`• Total sessions last 7 days: ${snapshot.weeklyTotal}`);
    if (snapshot.totalUsers     != null) lines.push(`• Total registered users: ${snapshot.totalUsers}`);
    if (snapshot.activeGroups   != null) lines.push(`• Active study groups: ${snapshot.activeGroups} (${snapshot.groupsOpen ?? snapshot.activeGroups} open to join)`);
    if (snapshot.pendingRedemptions != null) lines.push(`• Pending reward redemptions: ${snapshot.pendingRedemptions}`);
    if (snapshot.busiestSpot    != null) lines.push(`• Busiest spot: ${snapshot.busiestSpot} at ${snapshot.busiestCapacityPct}% capacity`);
    if (snapshot.avgStudyMins   != null) lines.push(`• Average session length: ${snapshot.avgStudyMins} min`);
    if (snapshot.peakHour       != null) lines.push(`• Peak hour today: ${snapshot.peakHour} with ${snapshot.peakCount} check-ins (${snapshot.peakDensity}% of daily peak)`);
    if (snapshot.topCategory    != null) lines.push(`• Top category this week: ${snapshot.topCategory} (${snapshot.topCategoryPct}%)`);
    const userMessage = lines.join("\n");

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      maxOutputTokens: 150,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error("[admin-insight/route] error:", err);
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
