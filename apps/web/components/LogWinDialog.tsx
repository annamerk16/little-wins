"use client";

import { useId, useRef, useState, type FormEvent } from "react";
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

  function touch(field: LogWinField) {
    setTouched((current) => ({ ...current, [field]: true }));
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
        className="rounded bg-blue-600 px-3 py-2 text-white"
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
        className="w-full max-w-md rounded-lg p-6 backdrop:bg-black/40"
      >
        <h2 id={`${ids}-title`} className="text-lg font-semibold">
          Log a win
        </h2>

        <form onSubmit={submit} noValidate className="mt-4">
          <fieldset disabled={pending} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-reflection`} className="font-medium">
                Reflection
              </label>
              <textarea
                id={`${ids}-reflection`}
                ref={reflectionRef}
                autoFocus
                rows={3}
                value={draft.reflection}
                onChange={(e) => edit({ reflection: e.target.value })}
                onBlur={() => touch("reflection")}
                aria-invalid={reflectionError ? true : undefined}
                aria-describedby={reflectionError ? `${ids}-reflection-error` : undefined}
                className="rounded border px-3 py-2"
              />
              <p className="text-xs text-neutral-500">
                {draft.reflection.trim().length}/{MAX_REFLECTION}
              </p>
              {reflectionError && (
                <p id={`${ids}-reflection-error`} className="text-sm text-red-600">
                  {reflectionError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`${ids}-category`} className="font-medium">
                Category
              </label>
              <select
                id={`${ids}-category`}
                ref={categoryRef}
                value={draft.category}
                onChange={(e) => edit({ category: e.target.value as LogWinCategory | "" })}
                onBlur={() => touch("category")}
                aria-invalid={categoryError ? true : undefined}
                aria-describedby={categoryError ? `${ids}-category-error` : undefined}
                className="rounded border px-3 py-2"
              >
                <option value="">Select a category</option>
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
              <span className="font-medium">Location</span>
              <button
                type="button"
                ref={locationRef}
                onClick={locate}
                disabled={locationState === "locating"}
                aria-describedby={`${ids}-location-info`}
                className="self-start rounded border px-3 py-2"
              >
                {locationState === "granted"
                  ? "Update location"
                  : locationState === "error"
                    ? "Try again"
                    : "Use my location"}
              </button>
              <p id={`${ids}-location-info`} className="text-sm text-neutral-600">
                {locationState === "locating" && "Locating…"}
                {locationState === "granted" &&
                  draft.location &&
                  `Location set (${draft.location.latitude.toFixed(3)}, ${draft.location.longitude.toFixed(3)})`}
                {locationState === "error" && locationMessage}
              </p>
              {locationError && locationState !== "error" && (
                <p className="text-sm text-red-600">{locationError}</p>
              )}
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-600">
                {submitError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded border border-neutral-300 px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
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
