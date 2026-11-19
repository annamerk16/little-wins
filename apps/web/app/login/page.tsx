import AuthPage from "../../components/AuthPage";

export const dynamic = "force-dynamic";
export default function Login(props: { searchParams: Promise<{ returnTo?: string; registered?: string; error?: string }> }) {
  return <AuthPage mode="login" {...props} />;
}
