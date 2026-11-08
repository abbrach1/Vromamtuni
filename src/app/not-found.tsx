import Link from "next/link";
import { getMessages } from "@/i18n/server";

export default async function NotFound() {
  const { m } = await getMessages();
  return (
    <main className="page">
      <div className="card empty stack">
        <p>{m.notFound}</p>
        <Link href="/" className="btn">
          {m.goHome}
        </Link>
      </div>
    </main>
  );
}
