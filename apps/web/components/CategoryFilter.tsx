"use client";

import { useId } from "react";

export type CategoryFilterValue =
  | ""
  | "FITNESS"
  | "ACADEMIC"
  | "CAREER"
  | "PERSONAL";

type Props = {
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
};

export default function CategoryFilter({ value, onChange }: Props) {
  const selectId = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="font-medium">
        Filter wins by category
      </label>

      <select
        id={selectId}
        value={value}
        onChange={(event) =>
          onChange(event.target.value as CategoryFilterValue)
        }
        className="rounded border px-3 py-2"
      >
        <option value="">All</option>
        <option value="FITNESS">Fitness</option>
        <option value="ACADEMIC">Academic</option>
        <option value="CAREER">Career</option>
        <option value="PERSONAL">Personal</option>
      </select>
    </div>
  );
}