"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, saveSession } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { displayName } from "@/lib/user";
import type { UserProfile } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";

const BIO_MAX = 200;
const NAME_MAX = 40;

type Form = { first_name: string; last_name: string; bio: string };

function toForm(u: UserProfile): Form {
  return { first_name: u.first_name, last_name: u.last_name, bio: u.bio };
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<Form>({
    first_name: "",
    last_name: "",
    bio: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .me(token)
      .then((me) => {
        setProfile(me);
        setForm(toForm(me));
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function edit(patch: Partial<Form>) {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
    setError(null);
  }

  const dirty =
    !!profile &&
    (form.first_name !== profile.first_name ||
      form.last_name !== profile.last_name ||
      form.bio !== profile.bio);

  async function save() {
    const token = getToken();
    if (!token || !profile) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateMe(token, form);
      setProfile(updated);
      setForm(toForm(updated)); // adopt the server's trimmed values
      saveSession(token, updated);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Can't reach the server. Make sure it's running on port 4000.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
      </div>
    );
  }

  // Live preview of how this user will appear to others as they type.
  const preview = {
    username: profile.username,
    first_name: form.first_name,
    last_name: form.last_name,
    deleted: false,
  };

  const inputClass =
    "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-muted/50 focus:border-signal focus:ring-4 focus:ring-signal/15";

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
        <div className="animate-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal">
            Your profile
          </p>
          <h1 className="mt-2.5 font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">
            How you appear
          </h1>
          <p className="mt-2 text-sm text-muted">
            This is what other people see when you message them. Your avatar is
            drawn from your initials — no uploads.
          </p>

          <div className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7">
            {/* Live identity preview */}
            <div className="flex items-center gap-4 border-b border-line pb-6">
              <Avatar user={preview} size={64} />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-semibold text-ink">
                  {displayName(preview)}
                </p>
                <p className="truncate text-sm text-muted">
                  @{profile.username}
                </p>
              </div>
            </div>

            <form
              className="pt-6"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (dirty && !saving) void save();
              }}
            >
              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
                >
                  {error}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">
                    First name
                  </span>
                  <input
                    className={inputClass}
                    type="text"
                    value={form.first_name}
                    maxLength={NAME_MAX}
                    autoComplete="given-name"
                    placeholder="Parsa"
                    onChange={(e) => edit({ first_name: e.target.value })}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">Last name</span>
                  <input
                    className={inputClass}
                    type="text"
                    value={form.last_name}
                    maxLength={NAME_MAX}
                    autoComplete="family-name"
                    placeholder="Mehrpooshan"
                    onChange={(e) => edit({ last_name: e.target.value })}
                  />
                </label>
              </div>

              <label className="mt-5 flex flex-col gap-1.5">
                <span className="flex items-center justify-between text-sm font-medium text-ink">
                  Bio
                  <span
                    className={`font-mono text-xs ${
                      form.bio.length > BIO_MAX ? "text-danger" : "text-muted"
                    }`}
                  >
                    {form.bio.length}/{BIO_MAX}
                  </span>
                </span>
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  value={form.bio}
                  maxLength={BIO_MAX}
                  placeholder="A line or two about you."
                  onChange={(e) => edit({ bio: e.target.value })}
                />
              </label>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!dirty || saving}
                  className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                {saved && !dirty && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-signal">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-signal" />
                    Saved
                  </span>
                )}
                {dirty && !saving && (
                  <span className="text-sm text-muted">Unsaved changes</span>
                )}
              </div>
            </form>
          </div>

          {/* Danger zone */}
          <div className="mt-8 rounded-2xl border border-danger/25 bg-danger-soft/40 p-5 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-danger">
              Danger zone
            </p>
            <h2 className="mt-2 font-display text-lg font-semibold text-ink">
              Delete account
            </h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
              Permanently erase your profile and release your username. Messages
              you&rsquo;ve sent remain in other people&rsquo;s conversations as
              “Deleted User.” This can&rsquo;t be undone.
            </p>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="mt-4 rounded-xl border border-danger/40 bg-surface px-4 py-2.5 text-[15px] font-medium text-danger transition hover:bg-danger hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-danger/25"
            >
              Delete account
            </button>
          </div>
        </div>
      </main>

      {confirmingDelete && (
        <DeleteAccountDialog onClose={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}
