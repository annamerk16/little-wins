"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  CATEGORIES,
  MAX_REFLECTION,
  errorMessageFor,
  firstInvalidField,
  validateDraft,
  type LogWinCategory,
  type LogWinDraft,
  type LogWinField,
} from "./logWinValidation";

type LocationState = "idle" | "locating" | "granted" | "error";

const LOCATION_OPTIONS: PositionOptions = { timeout: 10_000, maximumAge: 60_000 };

const EMPTY: LogWinDraft = { reflection: "", category: "", location: null };
const NO_TOUCHED: Record<LogWinField, boolean> = {
  reflection: false,
  category: false,
  location: false,
};

export default function LogWinDialog() {
  const ids = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reflectionRef = useRef<HTMLTextAreaElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const locationRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);

  const [draft, setDraft] = useState<LogWinDraft>(EMPTY);
  const [touched, setTouched] = useState(NO_TOUCHED);
  const locateRequestRef = useRef(0);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  // The control swaps between button and card; keep keyboard focus on whichever is rendered.
  useEffect(() => {
    if (locationState === "granted" || locationState === "error") locationRef.current?.focus();
  }, [locationState]);

  const errors = validateDraft(draft);
  const shown = (field: LogWinField) => (touched[field] ? errors[field] : undefined);

  function open() {
    setStatus("");
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  // Runs for Cancel, Escape and success alike: closing discards the draft.
  function reset() {
    setDraft(EMPTY);
    setTouched(NO_TOUCHED);
    setLocationState("idle");
    setLocationMessage("");
    setSubmitError(null);
    locateRequestRef.current += 1; // a late geolocation answer must not refill the reset draft
  }

  function edit(change: Partial<LogWinDraft>) {
    setDraft((current) => ({ ...current, ...change }));
    setSubmitError(null);
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage("This browser can't share your location. Location is required to log a win.");
      setLocationState("error");
      return;
    }
    const request = ++locateRequestRef.current;
    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== locateRequestRef.current) return;
        edit({
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
        setLocationState("granted");
      },
      (failure) => {
        if (request !== locateRequestRef.current) return;
        setLocationMessage(
          failure.code === failure.PERMISSION_DENIED
            ? "Location access is blocked. Allow it for this site, then try again. Location is required to log a win."
            : "Couldn't get your location. Try again. Location is required to log a win.",
        );
        setLocationState("error");
      },
      LOCATION_OPTIONS,
    );
  }

  function focusField(field: LogWinField) {
    const target = { reflection: reflectionRef, category: categoryRef, location: locationRef }[field];
    target.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    setTouched({ reflection: true, category: true, location: true });
    const invalid = firstInvalidField(errors);
    if (invalid) {
      focusField(invalid);
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/wins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reflection: draft.reflection,
          category: draft.category,
          latitude: draft.location?.latitude,
          longitude: draft.location?.longitude,
        }),
      });
      if (response.status === 201) {
        setStatus("Win logged.");
        close();
      } else {
        const body = await response.json().catch(() => null);
        setSubmitError(errorMessageFor(response.status, body));
      }
    } catch {
      setSubmitError(errorMessageFor(null, null));
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  const reflectionError = shown("reflection");
  const categoryError = shown("category");
  const locationError = shown("location");

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="cursor-pointer disabled:cursor-not-allowed inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2f5a3c] px-4 text-[15px] font-bold text-white"
      >
        Log a win
      </button>
      <p role="status" className="text-sm text-neutral-600">
        {status}
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${ids}-title`}
        onClose={reset}
        onCancel={(event) => {
          if (submittingRef.current) event.preventDefault();
        }}
        className="m-auto w-full max-w-md rounded-[22px] bg-[#fdfdfb] p-7 text-[#1e2b1b] shadow-[0_30px_60px_-20px_rgba(30,43,27,0.35)] backdrop:bg-[#1e2b1b]/45 max-sm:m-0 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-b-none max-sm:px-5 max-sm:pb-7 max-sm:pt-5"
      >
        <h2 id={`${ids}-title`} className="font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.03em]">
          Log a win
        </h2>

        <form onSubmit={submit} noValidate className="mt-5">
          <fieldset disabled={pending} className="space-y-5">
            {/* Static for now: photo upload is out of scope (docs/specs/wins/create.md). */}
            <div className="flex justify-center">
              <button
                type="button"
                disabled
                aria-label="Add a photo (coming soon)"
                className="-rotate-[2.5deg] bg-white p-2.5 pb-2 shadow-[0_10px_24px_-10px_rgba(30,43,27,0.45),0_0_0_1px_rgba(30,43,27,0.08)]"
              >
                <span className="flex size-[164px] flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,#e9f0e2_0_10px,#dce6d3_10px_11px)]">
                  <span className="flex size-12 items-center justify-center rounded-full bg-[#2b4a27]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" />
                      <circle cx="12" cy="12.5" r="3.4" />
                    </svg>
                  </span>
                </span>
                <span className="mt-1.5 block text-[13px] font-semibold">Add a photo · optional</span>
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-reflection`} className="text-xs font-bold uppercase tracking-[0.08em] text-[#556251]">
                Reflection
              </label>
              <div className="relative pt-2">
                <textarea
                  id={`${ids}-reflection`}
                  ref={reflectionRef}
                  autoFocus
                  placeholder="What went well, even a little?"
                  value={draft.reflection}
                  onChange={(e) => edit({ reflection: e.target.value })}
                  aria-invalid={reflectionError ? true : undefined}
                  aria-describedby={reflectionError ? `${ids}-reflection-error` : undefined}
                  style={{
                    // One hairline per 28px line, `local` so rules scroll with the text. The textarea has
                    // no top padding so the repeating tile never extends above line 1 (the 8px of air
                    // above lives on the wrapper). Shorthand-only: position/size/repeat/box.
                    background:
                      "linear-gradient(transparent 27px, #d6ded1 27px) 0 0 / 100% 28px repeat-y local content-box, #fdfdfb",
                  }}
                  className="box-border block h-[116px] w-full resize-none rounded-none border-0 border-b-[1.8px] border-[#5e6b5a] px-0.5 pb-[30px] pt-0 text-[17px] leading-7 placeholder:text-[#556251]/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b4a27]"
                />
                <span className="pointer-events-none absolute bottom-2 right-2.5 text-[13px] tabular-nums text-[#556251]">
                  {draft.reflection.trim().length}/{MAX_REFLECTION}
                </span>
              </div>
              {reflectionError && (
                <p id={`${ids}-reflection-error`} className="text-sm text-red-600">
                  {reflectionError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-category`} className="text-xs font-bold uppercase tracking-[0.08em] text-[#556251]">
                Category
              </label>
              <select
                id={`${ids}-category`}
                ref={categoryRef}
                value={draft.category}
                onChange={(e) => edit({ category: e.target.value as LogWinCategory | "" })}
                aria-invalid={categoryError ? true : undefined}
                aria-describedby={categoryError ? `${ids}-category-error` : undefined}
                className="cursor-pointer disabled:cursor-not-allowed border-0 border-b-[1.8px] border-[#5e6b5a] bg-[#fdfdfb] px-0.5 text-[17px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b4a27] h-12"
              >
                <option value="">Choose a category</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0) + category.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              {categoryError && (
                <p id={`${ids}-category-error`} className="text-sm text-red-600">
                  {categoryError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#556251]">Location</span>
              {locationState === "locating" || (draft.location && locationState !== "error") ? (
                <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-full border border-[#5e6b5a]/60 bg-[#e9f0e2] py-0.5 pl-3 pr-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-[#2b4a27]">
                    {draft.location && locationState !== "locating" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    ) : (
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 3a9 9 0 1 0 9 9" />
                      </svg>
                    )}
                    <span role="status">
                      {locationState === "locating" ? "Locating…" : "Location added"}
                    </span>
                  </span>
                  {draft.location && (
                    <button
                      type="button"
                      ref={locationRef}
                      onClick={locate}
                      disabled={locationState === "locating"}
                      className="cursor-pointer disabled:cursor-not-allowed min-h-9 rounded-full px-3.5 text-sm font-semibold text-[#2b4a27] underline underline-offset-[3px] disabled:opacity-60"
                    >
                      Update location
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    ref={locationRef}
                    onClick={locate}
                    aria-describedby={locationState === "error" ? `${ids}-location-info` : undefined}
                    className="cursor-pointer inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-[#5e6b5a]/60 bg-[#e9f0e2] px-[18px] text-[15px] font-semibold text-[#2b4a27]"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                      <circle cx="12" cy="10" r="2.4" />
                    </svg>
                    {locationState === "error" ? "Try again" : "Use my location"}
                  </button>
                  {locationState === "error" && (
                    <p id={`${ids}-location-info`} className="text-[13px] text-[#556251]">
                      {locationMessage}
                    </p>
                  )}
                </>
              )}
              {locationError && locationState !== "error" && (
                <p className="text-sm text-red-600">{locationError}</p>
              )}
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-600">
                {submitError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-1 max-sm:[&>button]:flex-1">
              <button
                type="button"
                onClick={close}
                className="cursor-pointer disabled:cursor-not-allowed min-h-12 rounded-full px-5 font-semibold underline underline-offset-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="cursor-pointer disabled:cursor-not-allowed min-h-12 min-w-[132px] rounded-full bg-[#2b4a27] px-6 font-bold text-white disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save win"}
              </button>
            </div>
          </fieldset>
        </form>
      </dialog>
    </>
  );
}
