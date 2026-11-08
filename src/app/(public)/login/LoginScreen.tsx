"use client";

import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { program } from "@/config/program";
import { createProfile } from "@/lib/db";
import { firebase } from "@/lib/firebase";
import { useLang } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { setRegistering, useAuth } from "@/components/AuthProvider";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

type Mode = "signin" | "register" | "forgot";

function errorText(e: unknown, m: Messages): string {
  const code = e instanceof FirebaseError ? e.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return m.errWrongPassword;
    case "auth/email-already-in-use":
      return m.errEmailInUse;
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return m.errWeakPassword;
    case "auth/invalid-email":
      return m.errInvalidEmail;
    case "auth/too-many-requests":
      return m.errTooMany;
    case "auth/network-request-failed":
      return m.errNetwork;
    default:
      return m.errGeneric;
  }
}

export function LoginScreen() {
  const { m, t } = useLang();
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (auth.status === "signed-in" && !pending) router.replace("/");
  }, [auth.status, pending, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const mail = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError("");
    setMessage("");

    if (mode === "register" && !name) return setError(m.errEnterName);
    if (!mail) return setError(m.errEnterEmail);
    if (mode !== "forgot" && !password) return setError(m.errEnterEmailPassword);
    if (mode === "register" && password.length < 8) return setError(m.errWeakPassword);

    setPending(true);
    const { auth: fbAuth } = firebase();
    fbAuth.languageCode = document.documentElement.lang;
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(fbAuth, mail, password);
        router.replace("/");
      } else if (mode === "register") {
        setRegistering(true);
        try {
          const { user } = await createUserWithEmailAndPassword(fbAuth, mail, password);
          await updateProfile(user, { displayName: name });
          await createProfile(user, name);
        } finally {
          setRegistering(false);
        }
        router.replace("/sign-up");
      } else {
        await sendPasswordResetEmail(fbAuth, mail);
        setMessage(m.resetSent(mail));
        setPending(false);
      }
    } catch (err) {
      // For privacy, don't reveal whether an email has an account.
      if (mode === "forgot" && err instanceof FirebaseError && err.code === "auth/user-not-found") {
        setMessage(m.resetSent(mail));
      } else {
        setError(errorText(err, m));
      }
      setPending(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth__corner">
        <LangToggle />
        <ThemeToggle />
      </div>
      <div className="auth__box">
        <div className="auth__head">
          <Logo size={88} className="auth__mark" />
          <p className="eyebrow">{t(program.yeshivaName)}</p>
          <h1>{t(program.name)}</h1>
          <p className="muted small">{m.tagline}</p>
        </div>

        <div className="stack">
          {mode !== "forgot" && (
            <div className="segmented" role="group" aria-label={m.signInOrCreate}>
              <button type="button" aria-pressed={mode === "signin"} onClick={() => switchMode("signin")}>
                {m.signIn}
              </button>
              <button type="button" aria-pressed={mode === "register"} onClick={() => switchMode("register")}>
                {m.createAccount}
              </button>
            </div>
          )}

          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="alert alert--ok" role="status">
              {message}
            </p>
          )}

          <form key={mode} onSubmit={onSubmit} className="card stack" noValidate>
            {mode === "forgot" && (
              <div>
                <h2>{m.resetTitle}</h2>
                <p className="muted small" style={{ marginTop: 4 }}>
                  {m.resetIntro}
                </p>
              </div>
            )}

            {mode === "register" && (
              <label className="field">
                <span className="field__label">{m.yourName}</span>
                <input className="input" name="name" autoComplete="name" maxLength={120} required />
              </label>
            )}

            <label className="field">
              <span className="field__label">{m.email}</span>
              <input
                className="input"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            {mode !== "forgot" && (
              <label className="field">
                <span className="field__label">{m.password}</span>
                <input
                  className="input"
                  name="password"
                  type="password"
                  dir="ltr"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                />
                {mode === "register" && <span className="field__help">{m.passwordHelp}</span>}
              </label>
            )}

            <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
              {pending
                ? m.oneMoment
                : mode === "signin"
                  ? m.signIn
                  : mode === "register"
                    ? m.createAccount
                    : m.sendReset}
            </button>
          </form>

          <div style={{ textAlign: "center" }}>
            {mode === "signin" && (
              <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>
                {m.forgot}
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" className="link-btn" onClick={() => switchMode("signin")}>
                {m.backToSignIn}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
