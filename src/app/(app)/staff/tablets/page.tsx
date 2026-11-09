import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { TabletsScreen } from "./TabletsScreen";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.tablets };
}

export default function TabletsPage() {
  return (
    <main className="page page--wide">
      <TabletsScreen />
    </main>
  );
}
