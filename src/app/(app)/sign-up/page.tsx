import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { SignUpScreen } from "./SignUpForm";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.mySignUp };
}

export default function SignUpPage() {
  return <SignUpScreen />;
}
