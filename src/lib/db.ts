/**
 * Reading and writing the database (Firestore), from the browser.
 * Who may read or write what is enforced by firestore.rules, not here.
 *
 *   users/{uid}             name, email, role, requirementIds, smartGoal
 *   progress/{uid}_{week}   uid, week (its Sunday), entries: { requirementId: data }
 */

import type { User } from "firebase/auth";
import {
  collection,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { normalizeSelection } from "@/config/program";
import type { ISODate } from "./dates";
import { firebase } from "./firebase";
import type { EntryData, ProgressByWeek } from "./rules";

export type Role = "bachur" | "staff";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  requirementIds: string[];
  smartGoal: string;
}

export function toProfile(id: string, data: DocumentData | undefined): Profile {
  return {
    id,
    name: typeof data?.name === "string" ? data.name : "",
    email: typeof data?.email === "string" ? data.email : "",
    role: data?.role === "staff" ? "staff" : "bachur",
    requirementIds: normalizeSelection(Array.isArray(data?.requirementIds) ? data.requirementIds : []),
    smartGoal: typeof data?.smartGoal === "string" ? data.smartGoal : "",
  };
}

const userRef = (uid: string) => doc(firebase().db, "users", uid);
const progressRef = (uid: string, week: ISODate) => doc(firebase().db, "progress", `${uid}_${week}`);

/** Creates the profile for a new account (new accounts are always bachurim). */
export async function createProfile(user: User, name: string) {
  const ref = userRef(user.uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, {
    name: name.trim().slice(0, 120),
    email: user.email ?? "",
    role: "bachur",
    requirementIds: [],
    smartGoal: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function loadProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? toProfile(uid, snap.data()) : null;
}

export async function saveSignUp(
  uid: string,
  values: { name: string; requirementIds: string[]; smartGoal: string },
) {
  await updateDoc(userRef(uid), {
    name: values.name.trim().slice(0, 120),
    requirementIds: normalizeSelection(values.requirementIds),
    smartGoal: values.smartGoal.trim().slice(0, 2000),
    updatedAt: serverTimestamp(),
  });
}

function readEntries(data: DocumentData | undefined): Record<string, EntryData> {
  const entries = data?.entries;
  return entries && typeof entries === "object" ? (entries as Record<string, EntryData>) : {};
}

/** One bachur's progress for the given weeks. */
export async function loadProgress(uid: string, weeks: ISODate[]): Promise<ProgressByWeek> {
  const snaps = await Promise.all(weeks.map((w) => getDoc(progressRef(uid, w))));
  const out: ProgressByWeek = {};
  snaps.forEach((snap, i) => {
    out[weeks[i]] = readEntries(snap.data());
  });
  return out;
}

/** Saves one requirement's entry for one week, leaving the others untouched. */
export async function saveEntry(uid: string, week: ISODate, requirementId: string, data: EntryData) {
  await setDoc(
    progressRef(uid, week),
    { uid, week, entries: { [requirementId]: data }, updatedAt: serverTimestamp() },
    { mergeFields: ["uid", "week", "updatedAt", new FieldPath("entries", requirementId)] },
  );
}

// ── Staff ─────────────────────────────────────────────────────────────────

export async function loadBachurim(): Promise<Profile[]> {
  const snap = await getDocs(query(collection(firebase().db, "users"), where("role", "==", "bachur")));
  return snap.docs.map((d) => toProfile(d.id, d.data()));
}

/** Everyone's progress between two weeks (inclusive), grouped by bachur. */
export async function loadAllProgress(from: ISODate, to: ISODate): Promise<Map<string, ProgressByWeek>> {
  const snap = await getDocs(
    query(collection(firebase().db, "progress"), where("week", ">=", from), where("week", "<=", to)),
  );
  const byUser = new Map<string, ProgressByWeek>();
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.uid !== "string" || typeof data.week !== "string") continue;
    const user = byUser.get(data.uid) ?? {};
    user[data.week] = readEntries(data);
    byUser.set(data.uid, user);
  }
  return byUser;
}
