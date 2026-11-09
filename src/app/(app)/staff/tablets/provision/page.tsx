import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { ProvisionScreen } from "./ProvisionScreen";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.provisionTitle };
}

export default function ProvisionPage() {
  return (
    <main className="page page--wide">
      <ProvisionScreen />
    </main>
  );
}
