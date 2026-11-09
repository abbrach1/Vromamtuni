import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Frank_Ruhl_Libre, Source_Serif_4 } from "next/font/google";
import { program } from "@/config/program";
import { isConfigured } from "@/lib/env";
import { LangProvider } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import { AuthProvider } from "@/components/AuthProvider";
import { SetupScreen } from "@/components/SetupScreen";
import "./globals.css";

// Classical capitals like the logo's lettering, a sturdy book face for reading,
// and Frank Ruhl for Hebrew.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});
const hebrew = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-he",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getMessages();
  const name = program.name[lang];
  return {
    title: { default: name, template: `%s · ${name}` },
    description: `${program.yeshivaName[lang]} · ${name} · ${program.tagline[lang]}`,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0b09" },
  ],
};

// Applies a saved light/dark choice before the first paint, so there's no flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, m } = await getMessages();
  return (
    <html
      lang={lang}
      dir={m.dir}
      className={`${display.variable} ${body.variable} ${hebrew.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <LangProvider lang={lang}>
          {isConfigured ? <AuthProvider>{children}</AuthProvider> : <SetupScreen />}
        </LangProvider>
      </body>
    </html>
  );
}
