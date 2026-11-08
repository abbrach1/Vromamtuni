import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { LoginScreen } from "./LoginScreen";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.signIn };
}

export default function LoginPage() {
  return <LoginScreen />;
}
