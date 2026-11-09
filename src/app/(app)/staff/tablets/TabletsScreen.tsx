"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/i18n/client";
import { useAuth } from "@/components/AuthProvider";

type Device = {
  id: string;
  label: string;
  area: string | null;
  enrolled: boolean;
  online: boolean;
  last_seen_at: string | null;
  disabled: boolean;
  app_version: string | null;
  version_code: number | null;
  bundle_version: string | null;
  battery_pct: number | null;
  battery_charging: boolean | null;
};

type Enroll = { label: string; enrollment_code: string; escape_pin: string };

export function TabletsScreen() {
  const auth = useAuth();
  const { m, lang } = useLang();
  const user = auth.status === "signed-in" ? auth.user : null;
  const isStaff = auth.status === "signed-in" && auth.profile?.role === "staff";

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [enroll, setEnroll] = useState<Enroll | null>(null);

  const authed = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = user ? await user.getIdToken() : "";
      return fetch(path, {
        ...init,
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
        cache: "no-store",
      });
    },
    [user],
  );

  const load = useCallback(async () => {
    if (!isStaff) return;
    try {
      const res = await authed("/api/staff/tablets");
      if (!res.ok) return setFailed(true);
      const data = (await res.json()) as { devices?: Device[] };
      setDevices((data.devices ?? []).slice().sort((a, b) => a.label.localeCompare(b.label)));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [authed, isStaff]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  function flashSent(id: string) {
    setSent((s) => ({ ...s, [id]: true }));
    setTimeout(() => setSent((s) => ({ ...s, [id]: false })), 1500);
  }

  async function command(id: string, kind: string, payload?: Record<string, unknown>) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await authed(`/api/staff/tablets/${id}/commands`, {
        method: "POST",
        body: JSON.stringify({ kind, payload: payload ?? {} }),
      });
      if (res.ok) flashSent(id);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await authed(`/api/staff/tablets/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function add(label: string, area: string) {
    const res = await authed("/api/staff/tablets", {
      method: "POST",
      body: JSON.stringify({ label, area: area || null }),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<Enroll> & { error?: string };
    if (res.ok && data.enrollment_code && data.escape_pin) {
      setEnroll({ label, enrollment_code: data.enrollment_code, escape_pin: data.escape_pin });
      setAdding(false);
      await load();
    }
    return { ok: res.ok, error: data.error };
  }

  if (!isStaff) return <p className="card empty">{m.staffOnly}</p>;

  const online = devices?.filter((d) => d.online).length ?? 0;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{m.staff}</span>
        <h1>{m.tablets}</h1>
      </div>

      <div className="stack">
        {failed && <p className="alert alert--error">{m.tabletsError}</p>}

        {enroll && <EnrollCard enroll={enroll} onClose={() => setEnroll(null)} />}

        {devices && (
          <div className="stats">
            <div className="stat">
              <b>{devices.length}</b>
              <span>{m.tStatTotal}</span>
            </div>
            <div className="stat">
              <b>{online}</b>
              <span>{m.tStatOnline}</span>
            </div>
          </div>
        )}

        <ChannelEditor authed={authed} />

        <div className="toolbar" style={{ justifyContent: "flex-end", gap: 8 }}>
          <Link href="/staff/tablets/provision" className="btn btn--primary btn--small">
            {m.provisionTitle}
          </Link>
          <button type="button" className="btn btn--small" onClick={() => setAdding(true)}>
            {m.tAddTablet}
          </button>
        </div>

        {adding && <AddForm onCancel={() => setAdding(false)} onSubmit={add} />}

        {!devices && !failed && (
          <p className="loading" role="status">
            {m.loading}
          </p>
        )}

        {devices && devices.length === 0 && <p className="card empty">{m.noTablets}</p>}

        {devices && devices.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="roster">
              <thead>
                <tr>
                  <th scope="col">{m.tColName}</th>
                  <th scope="col">{m.tColStatus}</th>
                  <th scope="col">{m.tColBattery}</th>
                  <th scope="col">{m.tColVersion}</th>
                  <th scope="col">{m.tColActions}</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} style={d.disabled ? { opacity: 0.55 } : undefined}>
                    <td>
                      <strong>{d.label}</strong>
                      {d.area && <div className="muted" style={{ fontSize: "0.85em" }}>{d.area}</div>}
                    </td>
                    <td>{statusText(d, m, lang)}</td>
                    <td>{battery(d)}</td>
                    <td>{d.bundle_version ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        <button type="button" className="btn btn--small" disabled={busy[d.id]} onClick={() => void command(d.id, "reload")}>
                          {m.tReload}
                        </button>
                        <button
                          type="button"
                          className="btn btn--small"
                          disabled={busy[d.id]}
                          onClick={() => {
                            if (confirm(m.tConfirmReboot)) void command(d.id, "reboot");
                          }}
                        >
                          {m.tReboot}
                        </button>
                        <button type="button" className="btn btn--small" disabled={busy[d.id]} onClick={() => void command(d.id, "check_update")}>
                          {m.tUpdate}
                        </button>
                        <select
                          className="input"
                          aria-label={m.tOrientation}
                          defaultValue=""
                          disabled={busy[d.id]}
                          onChange={(e) => {
                            if (e.target.value) void command(d.id, "set_orientation", { mode: e.target.value });
                            e.target.value = "";
                          }}
                          style={{ width: "auto", padding: "4px 8px" }}
                        >
                          <option value="" disabled>
                            {m.tOrientation}
                          </option>
                          <option value="auto">{m.tAuto}</option>
                          <option value="landscape">{m.tLandscape}</option>
                          <option value="portrait">{m.tPortrait}</option>
                        </select>
                        <button type="button" className="btn btn--small" disabled={busy[d.id]} onClick={() => void patch(d.id, { disabled: !d.disabled })}>
                          {d.disabled ? m.tEnable : m.tDisable}
                        </button>
                        {sent[d.id] && <span className="muted" style={{ fontSize: "0.85em" }}>{m.tSent}</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function statusText(d: Device, m: ReturnType<typeof useLang>["m"], lang: string): React.ReactNode {
  if (d.online) return <span style={{ color: "var(--ok, green)" }}>{m.tOnline}</span>;
  if (!d.last_seen_at) return <span className="muted">{m.tNeverSeen}</span>;
  const when = new Date(d.last_seen_at).toLocaleString(lang, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return <span className="muted">{m.tLastSeen(when)}</span>;
}

function battery(d: Device): string {
  if (d.battery_pct == null) return "—";
  return `${d.battery_pct}%${d.battery_charging ? " ⚡" : ""}`;
}

function EnrollCard({ enroll, onClose }: { enroll: Enroll; onClose: () => void }) {
  const { m } = useLang();
  return (
    <div className="card stack">
      <h2>{m.tEnrollTitle}</h2>
      <p className="muted">{enroll.label}</p>
      <div className="field">
        <span className="field__label">{m.tEnrollIntro}</span>
        <strong style={{ fontSize: "1.6rem", letterSpacing: "0.15em" }}>{enroll.enrollment_code}</strong>
      </div>
      <div className="field">
        <span className="field__label">{m.tEscapeIntro}</span>
        <strong style={{ fontSize: "1.3rem", letterSpacing: "0.15em" }}>{enroll.escape_pin}</strong>
      </div>
      <button type="button" className="btn btn--primary" onClick={onClose}>
        {m.tEnrollDone}
      </button>
    </div>
  );
}

function AddForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (label: string, area: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { m } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const label = String(form.get("label") ?? "").trim();
        const area = String(form.get("area") ?? "").trim();
        if (!label) return;
        setBusy(true);
        setError(null);
        const r = await onSubmit(label, area);
        setBusy(false);
        if (!r.ok) setError(r.error ?? m.tabletsError);
      }}
    >
      <h2>{m.tAddTitle}</h2>
      {error && <p className="alert alert--error">{error}</p>}
      <label className="field">
        <span className="field__label">{m.tName}</span>
        <input className="input" name="label" autoComplete="off" required autoFocus />
      </label>
      <label className="field">
        <span className="field__label">{m.tArea}</span>
        <input className="input" name="area" autoComplete="off" />
      </label>
      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCancel}>
          {m.tCancel}
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {m.tCreate}
        </button>
      </div>
    </form>
  );
}

function ChannelEditor({ authed }: { authed: (p: string, i?: RequestInit) => Promise<Response> }) {
  const { m } = useLang();
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void authed("/api/staff/tablets/channel")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ota_manifest_url?: string | null } | null) => {
        if (d) setUrl(d.ota_manifest_url ?? "");
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [authed]);

  if (!loaded) return null;

  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setSaved(false);
        await authed("/api/staff/tablets/channel", {
          method: "PUT",
          body: JSON.stringify({ ota_manifest_url: url.trim() || null }),
        });
        setBusy(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }}
    >
      <label className="field">
        <span className="field__label">{m.tChannel}</span>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/kiosk-manifest.json" />
      </label>
      <p className="muted" style={{ fontSize: "0.85em", margin: 0 }}>{m.tChannelHelp}</p>
      <div className="toolbar" style={{ justifyContent: "flex-end", gap: 8 }}>
        {saved && <span className="muted" style={{ fontSize: "0.85em" }}>{m.tSaved}</span>}
        <button type="submit" className="btn btn--small" disabled={busy}>{m.tSave}</button>
      </div>
    </form>
  );
}
