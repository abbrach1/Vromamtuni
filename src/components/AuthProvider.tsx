"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { createProfile, toProfile, type Profile } from "@/lib/db";
import { firebase } from "@/lib/firebase";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User; profile: Profile | null };

const AuthContext = createContext<AuthState>({ status: "loading" });

/** Set while the register form creates the profile itself. */
let registering = false;
export function setRegistering(value: boolean) {
  registering = value;
}

/** Keeps track of who is signed in and keeps their profile up to date. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const { auth, db } = firebase();
    let stopProfile: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopProfile?.();
      stopProfile = undefined;
      if (!user) {
        setState({ status: "signed-out" });
        return;
      }
      setState({ status: "signed-in", user, profile: null });
      // The phone's offline copy answers first; wait briefly for the server's
      // copy (so a role change shows at once) and fall back to the offline
      // copy when there's no connection.
      let fromServer = false;
      let fallback: ReturnType<typeof setTimeout> | undefined;
      const stopSnap = onSnapshot(
        doc(db, "users", user.uid),
        { includeMetadataChanges: true },
        (snap) => {
          const publish = () => {
            if (snap.exists()) {
              setState({ status: "signed-in", user, profile: toProfile(user.uid, snap.data()) });
            }
          };
          if (!snap.metadata.fromCache) {
            fromServer = true;
            clearTimeout(fallback);
            if (snap.exists()) publish();
            else if (!registering) {
              // An account without a profile (e.g. registration was interrupted).
              void createProfile(user, user.displayName ?? "").catch(() => {});
            }
          } else if (fromServer) {
            publish();
          } else {
            clearTimeout(fallback);
            fallback = setTimeout(publish, 2000);
          }
        },
        () => setState({ status: "signed-in", user, profile: null }),
      );
      stopProfile = () => {
        clearTimeout(fallback);
        stopSnap();
      };
    });

    return () => {
      stopProfile?.();
      stopAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
