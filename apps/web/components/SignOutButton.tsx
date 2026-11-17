"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Sign-out failed");
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Couldn't sign out. Please try again.");
    } finally { busy.current = false; setPending(false); }
  }
  return (
    <div>
      <button type="button" onClick={() => void signOut()} disabled={pending} className="rounded border px-3 py-2">
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
