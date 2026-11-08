"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { pillars, requirementById, requirements, requirementsForPillar } from "@/config/program";
import { saveSignUp, type Profile } from "@/lib/db";
import { useLang } from "@/i18n/client";
import { useAuth } from "@/components/AuthProvider";
import { CheckIcon } from "@/components/icons";

export function SignUpScreen() {
  const auth = useAuth();
  if (auth.status !== "signed-in" || !auth.profile) return null;
  return <SignUpForm profile={auth.profile} />;
}

function SignUpForm({ profile }: { profile: Profile }) {
  const { m, t } = useLang();
  const router = useRouter();
  const isNew = profile.requirementIds.length === 0;
  const [name, setName] = useState(profile.name);
  const [goal, setGoal] = useState(profile.smartGoal);
  const [selected, setSelected] = useState(() => new Set(profile.requirementIds));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const ids = requirements.filter((r) => selected.has(r.id)).map((r) => r.id);
  const count = ids.length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError(m.errEnterName);
    if (count === 0) return setError(m.errNoneChosen);
    if (ids.some((id) => requirementById.get(id)?.goalText) && !goal.trim()) return setError(m.errGoal);
    setPending(true);
    try {
      await saveSignUp(profile.id, { name, requirementIds: ids, smartGoal: goal });
      router.push(isNew ? "/progress?welcome=1" : "/progress?saved=1");
    } catch {
      setError(m.errSaveSignUp);
      setPending(false);
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <span className="eyebrow">{isNew ? m.welcome : m.mySignUp}</span>
        <h1>{isNew ? m.chooseCommitments : m.yourCommitments}</h1>
        <p className="muted">{m.signUpIntro}</p>
      </div>

      <form onSubmit={onSubmit} className="stack" noValidate>
        <label className="field card">
          <span className="field__label">{m.yourName}</span>
          <input
            className="input"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={120}
            required
          />
        </label>

        {pillars.map((pillar) => (
          <fieldset key={pillar.id} className="pillar fieldset">
            <legend className="pillar__title">{t(pillar.title)}</legend>
            <div className="stack" style={{ gap: 10 }}>
              {requirementsForPillar(pillar.id).map((req) => {
                const on = selected.has(req.id);
                return (
                  <div key={req.id} className="stack" style={{ gap: 8 }}>
                    <label className="choice">
                      <input
                        type="checkbox"
                        name="requirement"
                        value={req.id}
                        checked={on}
                        onChange={(e) => toggle(req.id, e.target.checked)}
                      />
                      <span className="checkmark">
                        <CheckIcon width={16} height={16} />
                      </span>
                      <span className="choice__body">
                        <span className="choice__title">
                          <span className="choice__letter">{t(req.letter)}</span>
                          {t(req.title)}
                        </span>
                        <span className="choice__desc">{t(req.description)}</span>
                      </span>
                    </label>
                    {req.goalText && (
                      <div className="goal-box field" hidden={!on}>
                        <label className="field__label" htmlFor={`goal-${req.id}`}>
                          {t(req.goalText.label)}
                        </label>
                        <textarea
                          id={`goal-${req.id}`}
                          className="textarea"
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                          placeholder={t(req.goalText.placeholder)}
                          maxLength={2000}
                        />
                        <span className="field__help">{t(req.goalText.help)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="savebar">
          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={pending || count === 0}>
            {pending
              ? m.saving
              : count === 0
                ? m.chooseAtLeastOne
                : isNew
                  ? m.signUpButton(count)
                  : m.saveChangesButton(count)}
          </button>
        </div>
      </form>
    </main>
  );
}
