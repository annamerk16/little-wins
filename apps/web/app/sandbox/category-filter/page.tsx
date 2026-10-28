"use client";

import { useEffect, useState } from "react";
import CategoryFilter, {
  type CategoryFilterValue,
} from "../../../components/CategoryFilter";

type Win = {
  id: string;
  reflection: string;
  category: string;
};

export default function CategoryFilterPage() {
  const [category, setCategory] = useState<CategoryFilterValue>("");
  const [wins, setWins] = useState<Win[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadWins() {
      setLoading(true);
      setError(null);
      setWins([]);

      const url = category
        ? `/api/wins?category=${encodeURIComponent(category)}`
        : "/api/wins";

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        const data: { wins: Win[] } = await response.json();

        if (active) {
          setWins(data.wins);
        }
      } catch {
        if (active) {
          setError("Couldn't load your wins. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadWins();

    return () => {
      active = false;
      controller.abort();
    };
  }, [category, retry]);

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">
        Sandbox: category filter
      </h1>

      <CategoryFilter value={category} onChange={setCategory} />

      <section aria-label="Wins" aria-busy={loading}>
        <p role="status" className="mb-4">
          {loading
            ? "Loading wins…"
            : error
              ? ""
              : wins.length === 0
                ? category
                  ? "No wins in this category yet."
                  : "No wins yet."
                : `${wins.length} ${wins.length === 1 ? "win" : "wins"} found.`}
        </p>

        {error && (
          <div className="space-y-2">
            <p role="alert">{error}</p>
            <button
              type="button"
              onClick={() => setRetry((count) => count + 1)}
              className="rounded border px-3 py-2"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <ul className="space-y-3">
            {wins.map((win) => (
              <li key={win.id} className="rounded border p-4">
                <p>{win.reflection}</p>
                <p className="text-sm text-neutral-600">
                  {win.category}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}