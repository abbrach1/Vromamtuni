"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Loading } from "@/components/AppShell";

/** Sends everyone to the right place: login, staff overview, sign-up or their week. */
export default function Home() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/login");
    if (auth.status !== "signed-in" || !auth.profile) return;
    const p = auth.profile;
    router.replace(p.role === "staff" ? "/staff" : p.requirementIds.length > 0 ? "/progress" : "/sign-up");
  }, [auth, router]);

  return <Loading />;
}
