"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import { CheckIcon, PencilIcon, UsersIcon } from "@/components/ui/icons";
import ChangePasswordCard from "@/components/settings/ChangePasswordCard";
import TimezoneSelect from "@/components/ui/TimezoneSelect";
import Avatar from "@/components/people/Avatar";
import AvatarUpload from "@/components/people/AvatarUpload";

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

export default function ManagerSettingsPage() {
  const { user } = useAuth();
  const { people, updatePerson } = useCompany();
  const [editing, setEditing] = useState(false);
  const [timezone, setTimezone] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const myPerson = useMemo(
    () =>
      people.find(
        (p) => p.role === "manager" && p.email.toLowerCase() === user?.email.toLowerCase(),
      ) ?? null,
    [people, user?.email],
  );

  const startEdit = () => {
    setTimezone(myPerson?.timezone ?? "");
    setPhone(myPerson?.phone ?? "");
    setAvatarUrl(myPerson?.avatarUrl ?? null);
    setSaved(false);
    setEditing(true);
  };

  const save = () => {
    if (!myPerson) return;
    updatePerson(myPerson.id, {
      timezone,
      phone: phone.trim() || undefined,
      avatarUrl,
    });
    setEditing(false);
    setSaved(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={user?.name ?? "Team manager"}
            src={myPerson?.avatarUrl}
            className="size-11 rounded-xl text-sm font-semibold"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Settings
            </h1>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Your account details and sign-in security
            </p>
          </div>
        </div>
        {myPerson && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            <PencilIcon className="size-3.5" />
            Edit
          </button>
        )}
      </div>

      {saved && !editing && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-success/30 bg-success-weak px-4 py-3">
          <CheckIcon className="size-4 text-success" />
          <p className="text-[13px] font-medium text-success">Profile updated</p>
        </div>
      )}

      <section className="mt-6 rounded-xl border border-hairline bg-surface-2 p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          Account
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="block text-xs font-medium text-ink-muted">Name</p>
            <p className="mt-1 text-[13px] font-medium text-ink">
              {user?.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="block text-xs font-medium text-ink-muted">Email</p>
            <p className="mt-1 text-[13px] font-medium text-ink">
              {user?.email ?? "—"}
            </p>
          </div>
          <div>
            <p className="block text-xs font-medium text-ink-muted">Role</p>
            <p className="mt-1 text-[13px] font-medium text-ink">
              Manager
            </p>
          </div>
        </div>

        {myPerson ? (
          editing ? (
            <div className="mt-5 border-t border-hairline pt-5">
              <p className="mb-2 text-xs font-medium text-ink-muted">Profile photo</p>
              <AvatarUpload name={myPerson.name} src={avatarUrl} onPick={setAvatarUrl} />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="manager-timezone"
                    className="block text-xs font-medium text-ink-muted"
                  >
                    Timezone
                  </label>
                  <TimezoneSelect
                    id="manager-timezone"
                    value={timezone}
                    onChange={setTimezone}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <label
                    htmlFor="manager-phone"
                    className="block text-xs font-medium text-ink-muted"
                  >
                    Phone
                  </label>
                  <input
                    id="manager-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 000 0000"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="h-8 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-2">
              <div>
                <p className="block text-xs font-medium text-ink-muted">Timezone</p>
                <p className="mt-1 text-[13px] font-medium text-ink">
                  {myPerson.timezone.replace(/_/g, " ")}
                </p>
              </div>
              <div>
                <p className="block text-xs font-medium text-ink-muted">Phone</p>
                <p className="mt-1 text-[13px] font-medium text-ink">
                  {myPerson.phone ?? "—"}
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-hairline bg-surface-3 px-3 py-3">
            <UsersIcon className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
            <p className="text-xs text-ink-muted">
              No team member record is linked to your account yet — ask a company admin to
              invite you as a manager.
            </p>
          </div>
        )}
      </section>

      <div className="mt-4">
        <ChangePasswordCard />
      </div>
    </div>
  );
}
