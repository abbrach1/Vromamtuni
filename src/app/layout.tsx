import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, Heebo, Inter, Source_Serif_4 } from "next/font/google";
import { program } from "@/config/program";
import { isConfigured } from "@/lib/env";
import { LangProvider } from "@/i18n/client";
import { getMessages } from "@/i18n/server";
import { AuthProvider } from "@/components/AuthProvider";
import { SetupScreen } from "@/components/SetupScreen";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sansHe = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-sans-he", display: "swap" });
const serifHe = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["500", "700"],
  variable: "--font-serif-he",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { lang } = await getMessages();
  const name = program.name[lang];
  return {
    title: { default: name, template: `%s · ${name}` },
    description: `${program.yeshivaName[lang]} · ${name}`,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1220" },
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
      className={`${sans.variable} ${serif.variable} ${sansHe.variable} ${serifHe.variable}`}
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
