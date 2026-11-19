"use client";

export default function PrivateError({ reset }: { reset: () => void }) {
  return (
    <main className="space-y-4">
      <p role="alert">Your account is temporarily unavailable. Please try again.</p>
      <button type="button" onClick={reset} className="rounded border px-3 py-2">Retry</button>
    </main>
  );
}
