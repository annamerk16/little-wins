import { requireUserId } from "#auth";
import SignOutButton from "../../components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return <><div className="mb-6 flex justify-end"><SignOutButton /></div>{children}</>;
}
