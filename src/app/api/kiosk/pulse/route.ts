import { adminDb } from "@/lib/admin";
import { checkKioskCode, json } from "@/lib/kiosk-server";
import { getWeekInfo } from "@/lib/week";

/**
 * The yeshiva-wide number on the wall tablet: how many bachurim have marked
 * something this week, out of how many. Counts only, no names, so nothing
 * personal shows on a shared screen. Two count queries cost about two reads.
 */
export async function GET(request: Request) {
  const denied = checkKioskCode(request);
  if (denied) return denied;
  const { currentWeek } = getWeekInfo(undefined);
  const db = adminDb();
  const [marked, total] = await Promise.all([
    db.collection("progress").where("week", "==", currentWeek).count().get(),
    db.collection("users").where("role", "==", "bachur").count().get(),
  ]);
  return json({ week: currentWeek, marked: marked.data().count, total: total.data().count });
}
