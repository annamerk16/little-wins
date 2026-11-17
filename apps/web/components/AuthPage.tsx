import Link from "next/link";
import { authEnvironment, safeReturnPath } from "#auth/server";
import AuthForm from "./AuthForm";

type Props = {
  mode: "login" | "register";
  searchParams: Promise<{ returnTo?: string; registered?: string; error?: string }>;
};

export default async function AuthPage({ mode, searchParams }: Props) {
  const query = await searchParams;
  const returnTo = safeReturnPath(query.returnTo);
  let configured = false;
  let githubEnabled = false;
  try { const env = authEnvironment(); configured = true; githubEnabled = Boolean(env.github); } catch { /* Fail closed; show setup state. */ }
  return (
    <main className="space-y-5">
      <h1 className="text-2xl font-bold">{mode === "register" ? "Create your Little Wins account" : "Sign in to Little Wins"}</h1>
      {query.registered === "1" && <p role="status">Registration complete. You can try signing in.</p>}
      {query.error && <p role="alert">GitHub sign-in failed. Please try again or use your password.</p>}
      <AuthForm mode={mode} returnTo={returnTo} githubEnabled={githubEnabled} configured={configured} />
      <p>
        <Link className="text-blue-600 underline" href={`${mode === "register" ? "/login" : "/register"}?returnTo=${encodeURIComponent(returnTo)}`}>
          {mode === "register" ? "Already have an account? Sign in" : "Create an account"}
        </Link>
      </p>
    </main>
  );
}
