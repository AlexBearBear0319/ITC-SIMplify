import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are an analytics assistant for SIMplify, a campus study-spot management platform used by SIM University.
Your audience is campus administrators and IT club staff.

Your job is to analyse the usage snapshot and provide a quick, highly scannable update. 
You MUST format your response EXACTLY as two short bullet points using the "•" symbol. Do not include any intro or outro text.

Format exactly like this:
• Insight: [1 sentence identifying the most critical bottleneck, over-crowded area, or under-used resource]
• Action: [1 sentence with a specific admin action, e.g., "Send a campus push notification", "Dispatch staff to clear reserved seats", or "Manually update location status"]

Guidelines:
- Use plain, professional English.
- Be direct and concise (keep the entire response under 60 words).
- Base your insight strictly on the provided data snapshot.`;

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
