import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

type CalendarApiEvent = {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  location_id: number | null;
  is_peak_alert: boolean;
  location_name: string | null;
};

type CalendarApiSpot = {
  locationId: number;
  name: string;
  highlight: string;
};

function parseMonthParam(monthRaw: string | null): { start: Date; end: Date } {
  // Expected format: YYYY-MM
  if (monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
    const [yStr, mStr] = monthRaw.split("-");
    const year = Number(yStr);
    const month = Number(mStr); // 1..12
    if (month >= 1 && month <= 12) {
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      return { start, end };
    }
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const db = createAdminClient();
    const monthRaw = req.nextUrl.searchParams.get("month");
    const { start, end } = parseMonthParam(monthRaw);

    // Small UTC buffer at both edges to avoid timezone clipping on month boundaries.
    const rangeStart = new Date(start);
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
    const rangeEnd = new Date(end);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

    const [eventsRes, spotsRes] = await Promise.all([
      db
        .from("events")
        .select("id, title, description, event_date, location_id, is_peak_alert, locations(name)")
        .gte("event_date", rangeStart.toISOString())
        .lte("event_date", rangeEnd.toISOString())
        .order("event_date", { ascending: true }),
      db
        .from("locations")
        .select("id, name, current_status, description")
        .order("name", { ascending: true }),
    ]);

    if (eventsRes.error) {
      return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
    }
    if (spotsRes.error) {
      return NextResponse.json({ error: spotsRes.error.message }, { status: 500 });
    }

    const events: CalendarApiEvent[] = (eventsRes.data ?? []).map((row) => {
      const locRaw = (row as unknown as { locations?: { name?: string } | { name?: string }[] | null }).locations;
      const loc = Array.isArray(locRaw) ? locRaw[0] : locRaw;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        event_date: row.event_date,
        location_id: row.location_id,
        is_peak_alert: Boolean(row.is_peak_alert),
        location_name: loc?.name ?? null,
      };
    });

    const spots: CalendarApiSpot[] = (spotsRes.data ?? []).map((loc) => ({
      locationId: loc.id,
      name: loc.name,
      highlight: loc.description ?? loc.current_status ?? "Study spot",
    }));

    return NextResponse.json({ events, spots });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
