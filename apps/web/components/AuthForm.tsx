"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = {
  mode: "login" | "register";
  returnTo: string;
  githubEnabled: boolean;
  configured: boolean;
};

export default function AuthForm({ mode, returnTo, githubEnabled, configured }: Props) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function authenticate(github = false) {
    if (busy.current || !configured) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const path = github ? "sign-in/social" : mode === "register" ? "sign-up/email" : "sign-in/email";
      const response = await fetch(`/api/auth/${path}?returnTo=${encodeURIComponent(returnTo)}`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(github ? { provider: "github" } : { email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message ?? "Authentication failed. Please try again.");
        return;
      }
      if (github) {
        if (typeof data.url !== "string" || new URL(data.url).origin !== "https://github.com") {
          throw new Error("Invalid authentication redirect");
        }
        window.location.assign(data.url);
      } else {
        router.replace(mode === "register"
          ? `/login?registered=1&returnTo=${encodeURIComponent(returnTo)}` : returnTo);
        router.refresh();
      }
    } catch {
      setError("Authentication is unavailable. Please try again.");
    } finally {
      setPassword("");
      busy.current = false;
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void authenticate();
  }

  return (
    <>
      {!configured && <p role="alert">Authentication is not configured. See the authentication setup guide.</p>}
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={pending || !configured} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="auth-email" className="block font-medium">Email</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254}
              value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
          <div className="space-y-1">
            <label htmlFor="auth-password" className="block font-medium">Password</label>
            <input id="auth-password" name="password" type="password" required maxLength={128}
              minLength={mode === "register" ? 12 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password} onChange={(event) => setPassword(event.target.value)}
              aria-describedby={mode === "register" ? "password-help" : undefined}
              className="w-full rounded border px-3 py-2" />
            {mode === "register" && <p id="password-help" className="text-sm text-neutral-600">Use 12–128 characters.</p>}
          </div>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {pending ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
          </button>
        </fieldset>
      </form>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <p role="status" className="sr-only">{pending ? "Signing in or registering…" : ""}</p>
      <button type="button" disabled={pending || !configured || !githubEnabled} onClick={() => void authenticate(true)}
        className="rounded border px-4 py-2 disabled:opacity-50">Sign in with GitHub</button>
      {!githubEnabled && <p className="text-sm text-neutral-600">GitHub sign-in is not configured.</p>}
    </>
  );
}
