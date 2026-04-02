import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are the SIMplify Admin Insight Assistant for campus operations.
Audience: admin team and IT club staff.

Goal: deliver a fast, readable operations update from the provided snapshot.

STRICT OUTPUT FORMAT (exactly 3 lines, plain text only):
📊 Snapshot: [main signal with a number]
⚠️ Watchout: [main risk or bottleneck]
✅ Next Step: [one concrete action for today]

Rules:
- Use simple, professional English.
- No markdown, no code formatting, no extra intro/outro text.
- Keep total response under 80 words.
- Mention numbers when available.
- Base everything strictly on the provided snapshot.`;

export async function POST(req: Request) {
  try {
    const { snapshot } = await req.json();

    if (!snapshot) {
      return new Response(JSON.stringify({ error: "Missing snapshot" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lines: string[] = [
      "Analyse this campus usage snapshot and give me an admin insight:",
    ];
    if (snapshot.checkinsToday != null)
      lines.push(`• Check-ins today: ${snapshot.checkinsToday}`);
    if (snapshot.weeklyTotal != null)
      lines.push(`• Total sessions last 7 days: ${snapshot.weeklyTotal}`);
    if (snapshot.totalUsers != null)
      lines.push(`• Total registered users: ${snapshot.totalUsers}`);
    if (snapshot.activeGroups != null)
      lines.push(
        `• Active study groups: ${snapshot.activeGroups} (${snapshot.groupsOpen ?? snapshot.activeGroups} open to join)`,
      );
    if (snapshot.pendingRedemptions != null)
      lines.push(
        `• Pending reward redemptions: ${snapshot.pendingRedemptions}`,
      );
    if (snapshot.busiestSpot != null)
      lines.push(
        `• Busiest spot: ${snapshot.busiestSpot} at ${snapshot.busiestCapacityPct}% capacity`,
      );
    if (snapshot.avgStudyMins != null)
      lines.push(`• Average session length: ${snapshot.avgStudyMins} min`);
    if (snapshot.peakHour != null)
      lines.push(
        `• Peak hour today: ${snapshot.peakHour} with ${snapshot.peakCount} check-ins (${snapshot.peakDensity}% of daily peak)`,
      );
    if (snapshot.topCategory != null)
      lines.push(
        `• Most used library area this week: ${snapshot.topCategory} (${snapshot.topCategoryPct}% of check-ins)`,
      );
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
      JSON.stringify({
        error: String(err instanceof Error ? err.message : err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
