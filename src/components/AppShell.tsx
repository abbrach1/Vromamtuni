"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { program } from "@/config/program";
import { firebase } from "@/lib/firebase";
import { useLang } from "@/i18n/client";
import { useAuth } from "./AuthProvider";
import { SignOutIcon } from "./icons";
import { LangToggle } from "./LangToggle";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

/** Top bar and sign-in guard for every signed-in screen. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const { m, t } = useLang();

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/login");
  }, [auth.status, router]);

  const profile = auth.status === "signed-in" ? auth.profile : null;
  const isStaff = profile?.role === "staff";
  const nav = !profile
    ? []
    : isStaff
      ? [{ href: "/staff", label: m.navOverview }]
      : [
          { href: "/progress", label: m.navMyWeek },
          { href: "/sign-up", label: m.navSignUp },
        ];

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Link href="/" className="brand">
            <Logo size={44} className="brand__mark" />
            <span className="brand__text">
              <span className="brand__name">{t(program.name)}</span>
              <span className="brand__yeshiva">{t(program.yeshivaName)}</span>
            </span>
            {isStaff && <span className="role-pill">{m.staff}</span>}
          </Link>
          <NavLinks items={nav} className="nav" />
          <LangToggle />
          <ThemeToggle />
          {auth.status === "signed-in" && (
            <button
              type="button"
              className="icon-btn"
              aria-label={m.signOut}
              title={m.signOut}
              onClick={async () => {
                await signOut(firebase().auth);
                router.replace("/login");
              }}
            >
              <SignOutIcon />
            </button>
          )}
        </div>
        {nav.length > 1 && <NavLinks items={nav} className="tabs" />}
      </header>
      {auth.status === "signed-in" && profile ? children : <Loading />}
    </>
  );
}

export function Loading() {
  const { m } = useLang();
  return (
    <main className="page">
      <p className="loading" role="status">
        {m.loading}
      </p>
    </main>
  );
}
