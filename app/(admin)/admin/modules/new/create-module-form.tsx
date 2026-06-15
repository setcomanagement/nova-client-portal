"use client";

import { useActionState } from "react";
import { createModuleAction, type ModuleFormState } from "../actions";

const init: ModuleFormState = {};
const field =
  "w-full rounded-lg border border-[#3a2a1c] bg-[#1c130a] px-3 py-2 text-sm text-[#e7d8c4] outline-none focus:border-caramel";

export function CreateModuleForm() {
  const [state, action, pending] = useActionState(createModuleAction, init);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-[#9c886a]">
          Title
        </span>
        <input name="title" placeholder="e.g. Setter Onboarding" className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-[#9c886a]">
          Description
        </span>
        <textarea
          name="description"
          rows={2}
          placeholder="One line on what this module covers."
          className={field}
        />
      </label>
      {state.error && <p className="text-sm text-[#d98a6a]">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-caramel px-4 text-sm font-semibold text-white hover:bg-[#8a5e30] disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create & add chapters"}
        </button>
      </div>
    </form>
  );
}
