"use client";

import { useEffect, useId, useRef, useState } from "react";

export class DeleteWinError extends Error {}

type Props = {
  winText: string;
  onConfirm: () => Promise<void> | void;
  // Controlled mode keeps the modal mounted when its card disappears optimistically.
  open?: boolean;
  onClose?: () => void;
};

export default function DeleteWinDialog({ winText, onConfirm, open, onClose }: Props) {
  const ids = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (open === false && !pendingRef.current) dialogRef.current?.close();
  }, [open]);

  function show() {
    setError(null);
    dialogRef.current?.showModal();
  }

  async function confirm() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      dialogRef.current?.close();
    } catch (failure) {
      setError(failure instanceof DeleteWinError ? failure.message : "Couldn't delete this win. Try again.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <>
      {open === undefined && (
        <button type="button" onClick={show} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">
          Delete<span className="sr-only"> win: {winText}</span>
        </button>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-desc`}
        onCancel={(event) => { if (pendingRef.current) event.preventDefault(); }}
        onClose={() => { setError(null); onClose?.(); }}
        className="m-auto max-w-md rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/40"
      >
        <h2 id={`${ids}-title`} className="text-lg font-semibold">Delete this win?</h2>
        <p id={`${ids}-desc`} className="mt-2 break-words text-sm text-neutral-600">
          “{winText}” will be permanently deleted.
        </p>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" autoFocus onClick={() => dialogRef.current?.close()} disabled={pending}
            className="rounded border border-neutral-300 px-3 py-2">Cancel</button>
          <button type="button" onClick={confirm} disabled={pending}
            className="rounded bg-red-600 px-3 py-2 text-white disabled:opacity-50">
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </dialog>
    </>
  );
}
