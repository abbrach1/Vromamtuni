"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext } from "react";
import type { Lang, Text } from "@/config/program";
import { messages, type Messages } from "./messages";

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** The current language, its interface text, and a helper for program text. */
export function useLang(): { lang: Lang; m: Messages; t: (text: Text) => string } {
  const lang = useContext(LangContext);
  return { lang, m: messages[lang], t: (text) => text[lang] };
}

/** Switches language: saves the choice in a cookie and re-renders the page. */
export function useSwitchLang() {
  const { lang } = useLang();
  const router = useRouter();
  return useCallback(() => {
    const next: Lang = lang === "he" ? "en" : "he";
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = messages[next].dir;
    router.refresh();
  }, [lang, router]);
}
