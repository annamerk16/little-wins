// Layout for the app's main screens: sidebar beside the page content.
// The root body is a narrow centered column, so this wrapper widens itself
// past it (see docs/specs/navigation/sidebar.md) instead of editing the root.
import Sidebar from "../../../components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative left-1/2 flex w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-6 sm:flex-row sm:gap-8">
      <div className="shrink-0 sm:sticky sm:top-10 sm:w-52 sm:self-start">
        <Sidebar />
      </div>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
