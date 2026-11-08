import "server-only";
import { cookies } from "next/headers";
import { program, type Lang } from "@/config/program";
import { messages } from "./messages";

export const LANG_COOKIE = "lang";

/** The language chosen with the language button (stored in a cookie). */
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === "he" || value === "en" ? value : program.defaultLang;
}

export async function getMessages() {
  const lang = await getLang();
  return { lang, m: messages[lang] };
}
