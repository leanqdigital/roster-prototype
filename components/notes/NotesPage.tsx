"use client";

import { Suspense, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import type { PersonalNote, TeamNote } from "@/lib/company-data";
import { useToast } from "@/lib/toast";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { NoteIcon, PencilIcon, PlusIcon, TrashIcon, UsersIcon } from "@/components/ui/icons";

type NoteModalState = { mode: "create" } | { mode: "edit"; note: PersonalNote } | null;
type TeamNoteModalState = { mode: "create" } | { mode: "edit"; note: TeamNote } | null;

const PAGE_SIZE = 9;

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none";

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function NoteFormModal({
  mode,
  note,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  note?: { title?: string; content: string };
  onClose: () => void;
  onSave: (input: { title?: string; content: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await onSave({ title: title || undefined, content });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save — try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={mode === "edit" ? "Edit note" : "New note"}
      confirmLabel={mode === "edit" ? "Save changes" : "Create note"}
      hideFooter
      onClose={onClose}
      onConfirm={() => {}}
    >
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="note-title" className="block text-xs font-medium text-ink-muted">
            Title <span className="font-normal text-ink-subtle">(optional)</span>
          </label>
          <input
            id="note-title"
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="note-content" className="block text-xs font-medium text-ink-muted">
            Content
          </label>
          <textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note…"
            rows={6}
            className="mt-1.5 w-full resize-none rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger-weak px-3 py-2 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-8 rounded-lg border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Spinner className="size-3.5" />}
            {mode === "edit" ? "Save changes" : "Create note"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NotesPageContent() {
  const searchParams = useSearchParams();
  const {
    personalNotes,
    createPersonalNote,
    updatePersonalNote,
    deletePersonalNote,
    teams,
    people,
    teamNotes,
    createTeamNote,
    updateTeamNote,
    deleteTeamNote,
  } = useCompany();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const [view, setView] = useState<"personal" | "team">(
    searchParams.get("view") === "team" ? "team" : "personal",
  );
  const [modal, setModal] = useState<NoteModalState>(null);
  const [confirmDelete, setConfirmDelete] = useState<PersonalNote | null>(null);
  const [page, setPage] = useState(1);

  const myPerson = useMemo(
    () => people.find((p) => p.email.toLowerCase() === user?.email.toLowerCase()) ?? null,
    [people, user?.email],
  );

  const myTeams = useMemo(() => {
    if (user?.role === "company_admin" || user?.role === "super_admin") return teams; // full oversight
    if (!myPerson) return [];
    return teams.filter((t) => myPerson.teamIds.includes(t.id) || t.managerId === myPerson.id);
  }, [teams, myPerson, user?.role]);

  const [selectedTeamIdOverride, setSelectedTeamIdOverride] = useState<string | null>(
    searchParams.get("team"),
  );
  const selectedTeamId =
    selectedTeamIdOverride && myTeams.some((t) => t.id === selectedTeamIdOverride)
      ? selectedTeamIdOverride
      : (myTeams[0]?.id ?? null);

  const [teamModal, setTeamModal] = useState<TeamNoteModalState>(null);
  const [confirmDeleteTeamNote, setConfirmDeleteTeamNote] = useState<TeamNote | null>(null);
  const [teamPage, setTeamPage] = useState(1);

  const personNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) m.set(p.id, p.name);
    return m;
  }, [people]);

  const teamNotesForSelected = useMemo(
    () => teamNotes.filter((n) => n.teamId === selectedTeamId),
    [teamNotes, selectedTeamId],
  );

  const pageCount = Math.max(1, Math.ceil(personalNotes.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedPersonalNotes = useMemo(
    () => personalNotes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [personalNotes, currentPage],
  );

  const teamPageCount = Math.max(1, Math.ceil(teamNotesForSelected.length / PAGE_SIZE));
  const currentTeamPage = Math.min(teamPage, teamPageCount);
  const pagedTeamNotes = useMemo(
    () => teamNotesForSelected.slice((currentTeamPage - 1) * PAGE_SIZE, currentTeamPage * PAGE_SIZE),
    [teamNotesForSelected, currentTeamPage],
  );

  const canModerate = (teamId: string) =>
    user?.role === "company_admin" ||
    user?.role === "super_admin" ||
    (user?.role === "manager" && myTeams.some((t) => t.id === teamId));

  const handleSave = async (input: {
    title?: string;
    content: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (modal?.mode === "edit") {
      const ok = await updatePersonalNote(modal.note.id, { title: input.title, content: input.content });
      if (!ok) return { ok: false, error: "Note can't be empty." };
    } else {
      const result = await createPersonalNote(input);
      if (!result.ok) return { ok: false, error: result.error ?? "Couldn't create note." };
    }
    setModal(null);
    pushToast({ tone: "success", message: "Note saved" });
    return { ok: true };
  };

  const handleSaveTeamNote = async (input: {
    title?: string;
    content: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (teamModal?.mode === "edit") {
      const ok = await updateTeamNote(teamModal.note.id, { title: input.title, content: input.content });
      if (!ok) return { ok: false, error: "Note can't be empty." };
    } else {
      if (!myPerson || !selectedTeamId) return { ok: false, error: "You can't post a note here." };
      const result = await createTeamNote(myPerson.id, { teamId: selectedTeamId, ...input });
      if (!result.ok) return { ok: false, error: result.error ?? "Couldn't create note." };
    }
    setTeamModal(null);
    pushToast({ tone: "success", message: "Note saved" });
    return { ok: true };
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Notes</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {view === "personal"
              ? "A private scratchpad only you can see."
              : "Shared notes visible to your team."}
          </p>
        </div>
        {view === "personal" ? (
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="size-3.5" />
            New note
          </button>
        ) : (
          myPerson &&
          selectedTeamId && (
            <button
              type="button"
              onClick={() => setTeamModal({ mode: "create" })}
              className="flex h-8 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <PlusIcon className="size-3.5" />
              New note
            </button>
          )
        )}
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-hairline bg-surface-3 p-0.5">
        <button
          type="button"
          onClick={() => {
            setView("personal");
            setPage(1);
          }}
          className={`h-7 rounded-md px-3 text-[13px] font-medium transition-colors ${
            view === "personal" ? "bg-surface-1 text-ink shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          Personal
        </button>
        <button
          type="button"
          onClick={() => {
            setView("team");
            setTeamPage(1);
          }}
          className={`h-7 rounded-md px-3 text-[13px] font-medium transition-colors ${
            view === "team" ? "bg-surface-1 text-ink shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          Team
        </button>
      </div>

      {view === "personal" ? (
        <>
          {personalNotes.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline py-16 text-center">
              <span className="flex size-10 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-ink-subtle">
                <NoteIcon className="size-5" />
              </span>
              <p className="mt-3 text-[13px] font-medium text-ink">No notes yet</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                Create your first private note to jot something down.
              </p>
              <button
                type="button"
                onClick={() => setModal({ mode: "create" })}
                className="mt-4 flex h-8 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
              >
                <PlusIcon className="size-3.5" />
                New note
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pagedPersonalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex flex-col rounded-xl border border-hairline bg-surface-2 p-4"
                  >
                    <h3 className="truncate text-[14px] font-semibold text-ink">
                      {note.title || "Untitled"}
                    </h3>
                    <p className="mt-1.5 line-clamp-4 flex-1 whitespace-pre-wrap text-[13px] text-ink-muted">
                      {note.content}
                    </p>
                    <p className="mt-3 text-[11px] text-ink-subtle">
                      Updated {formatUpdatedAt(note.updatedAt)}
                    </p>
                    <div className="mt-3 flex justify-end gap-2 border-t border-hairline pt-3">
                      <button
                        type="button"
                        aria-label="Edit note"
                        title="Edit"
                        onClick={() => setModal({ mode: "edit", note })}
                        className="flex size-7 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-ink transition-colors hover:bg-surface-4"
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete note"
                        title="Delete"
                        onClick={() => setConfirmDelete(note)}
                        className="flex size-7 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-danger transition-colors hover:bg-danger-weak"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-hairline">
                <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
              </div>
            </>
          )}

          {modal && (
            <NoteFormModal
              key={modal.mode === "edit" ? modal.note.id : "create"}
              mode={modal.mode}
              note={modal.mode === "edit" ? modal.note : undefined}
              onClose={() => setModal(null)}
              onSave={handleSave}
            />
          )}

          {confirmDelete && (
            <Modal
              open
              title={`Delete "${confirmDelete.title || "Untitled"}"?`}
              description="This note will be removed. This can't be undone."
              tone="danger"
              confirmLabel="Delete note"
              onClose={() => setConfirmDelete(null)}
              onConfirm={() => {
                deletePersonalNote(confirmDelete.id);
                setConfirmDelete(null);
                pushToast({ tone: "success", message: "Note deleted" });
              }}
            />
          )}
        </>
      ) : myTeams.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline py-16 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-ink-subtle">
            <UsersIcon className="size-5" />
          </span>
          <p className="mt-3 text-[13px] font-medium text-ink">You&apos;re not part of a team yet</p>
        </div>
      ) : (
        <>
          {myTeams.length > 1 && (
            <div className="mt-4">
              <select
                value={selectedTeamId ?? ""}
                onChange={(e) => {
                  setSelectedTeamIdOverride(e.target.value);
                  setTeamPage(1);
                }}
                className="h-9 rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink focus:border-primary/60 focus:outline-none"
              >
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {teamNotesForSelected.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline py-16 text-center">
              <span className="flex size-10 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-ink-subtle">
                <NoteIcon className="size-5" />
              </span>
              <p className="mt-3 text-[13px] font-medium text-ink">
                No notes yet for {myTeams.find((t) => t.id === selectedTeamId)?.name}.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pagedTeamNotes.map((note) => {
                  const canEdit = note.personId === myPerson?.id;
                  const canDelete = canEdit || canModerate(note.teamId);
                  return (
                    <div
                      key={note.id}
                      className="flex flex-col rounded-xl border border-hairline bg-surface-2 p-4"
                    >
                      <h3 className="truncate text-[14px] font-semibold text-ink">
                        {note.title || "Untitled"}
                      </h3>
                      <p className="mt-1.5 line-clamp-4 flex-1 whitespace-pre-wrap text-[13px] text-ink-muted">
                        {note.content}
                      </p>
                      <p className="mt-3 text-[11px] text-ink-subtle">
                        by {personNameById.get(note.personId) ?? "Someone"} · Updated{" "}
                        {formatUpdatedAt(note.updatedAt)}
                      </p>
                      {(canEdit || canDelete) && (
                        <div className="mt-3 flex justify-end gap-2 border-t border-hairline pt-3">
                          {canEdit && (
                            <button
                              type="button"
                              aria-label="Edit note"
                              title="Edit"
                              onClick={() => setTeamModal({ mode: "edit", note })}
                              className="flex size-7 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-ink transition-colors hover:bg-surface-4"
                            >
                              <PencilIcon className="size-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              aria-label="Delete note"
                              title="Delete"
                              onClick={() => setConfirmDeleteTeamNote(note)}
                              className="flex size-7 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-danger transition-colors hover:bg-danger-weak"
                            >
                              <TrashIcon className="size-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-hairline">
                <Pagination page={currentTeamPage} pageCount={teamPageCount} onPageChange={setTeamPage} />
              </div>
            </>
          )}

          {teamModal && (
            <NoteFormModal
              key={teamModal.mode === "edit" ? teamModal.note.id : "create"}
              mode={teamModal.mode}
              note={teamModal.mode === "edit" ? teamModal.note : undefined}
              onClose={() => setTeamModal(null)}
              onSave={handleSaveTeamNote}
            />
          )}

          {confirmDeleteTeamNote && (
            <Modal
              open
              title={`Delete "${confirmDeleteTeamNote.title || "Untitled"}"?`}
              description="This note will be removed. This can't be undone."
              tone="danger"
              confirmLabel="Delete note"
              onClose={() => setConfirmDeleteTeamNote(null)}
              onConfirm={() => {
                deleteTeamNote(confirmDeleteTeamNote.id);
                setConfirmDeleteTeamNote(null);
                pushToast({ tone: "success", message: "Note deleted" });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={null}>
      <NotesPageContent />
    </Suspense>
  );
}
