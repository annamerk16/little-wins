import AuthPage from "../../components/AuthPage";

export const dynamic = "force-dynamic";
export default function Register(props: { searchParams: Promise<{ returnTo?: string }> }) {
  return <AuthPage mode="register" {...props} />;
}
