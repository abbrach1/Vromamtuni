"use client";

import { useLang, useSwitchLang } from "@/i18n/client";

export function LangToggle({ className = "lang-btn" }: { className?: string }) {
  const { m } = useLang();
  const switchLang = useSwitchLang();
  return (
    <button type="button" className={className} onClick={switchLang} aria-label={m.switchLangLabel}>
      {m.switchLang}
    </button>
  );
}
