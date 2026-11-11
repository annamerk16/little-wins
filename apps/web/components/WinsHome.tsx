"use client";

import { useRef, useState } from "react";
import CategoryFilter, { type CategoryFilterValue } from "./CategoryFilter";
import LogWinDialog from "./LogWinDialog";
import Timeline from "./Timeline";

export default function WinsHome() {
  const [category, setCategory] = useState<CategoryFilterValue>("");
  const [revision, setRevision] = useState(0);
  const logTrigger = useRef<HTMLButtonElement>(null);

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-[#2b4a27]">Little Wins</h1>
          <p className="mt-2 text-neutral-600">Small moments. Real progress.</p>
        </div>
        <div>
          <LogWinDialog triggerRef={logTrigger} onCreated={() => setRevision((value) => value + 1)} />
        </div>
      </header>
      <CategoryFilter value={category} onChange={setCategory} />
      <Timeline category={category} refreshKey={revision} onLogWin={() => logTrigger.current?.click()} />
    </main>
  );
}
