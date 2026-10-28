"use client";

import { useRef, useState } from "react";

type Props = {
  winText: string;
  onConfirm: () => Promise<void> | void;
};

export default function DeleteWinDialog({ winText, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch {
      setError("Couldn't delete this win. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"
      >
        Delete
        <span className="sr-only"> win: {winText}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="rounded-lg p-6 backdrop:bg-black/40"
      >
        <h2 id="delete-title" className="text-lg font-semibold">
          Delete this win?
        </h2>
        <p id="delete-desc" className="mt-2 text-sm text-neutral-600">
          “{winText}” will be permanently deleted.
        </p>

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={close}
            disabled={pending}
            className="rounded border border-neutral-300 px-3 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </dialog>
    </>
  );
}