/**
 * /location index — redirects to the Dashboard where the
 * interactive map and location cards live.
 *
 * TODO: Replace with a full location listing page once ready.
 */
import { redirect } from "next/navigation";

export default function LocationIndexPage() {
  redirect("/dashboard");
}
