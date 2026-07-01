"use client";

import { useActionState } from "react";
import { createRecapJobAction, type RecapJobState } from "./actions";

const init: RecapJobState = {};
const field =
  "w-full rounded-lg border border-[#e6e3dd] bg-[#f7f7f4] px-3 py-2 text-sm text-[#2f2f33] outline-none focus:border-caramel placeholder:text-[#a3a3a8]";

export function NewRecapJobForm({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createRecapJobAction, init);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-[#6b6b70]">
            Client
          </span>
          <select name="clientId" defaultValue="" className={field}>
            <option value="">Select…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-[#6b6b70]">
            Fathom call
          </span>
          <input
            name="fathomRef"
            placeholder="https://fathom.video/calls/… · a call id · or 'my last call with Tone'"
            className={field}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-[#6b6b70]">
          Note (optional)
        </span>
        <input name="note" placeholder="Anything to remember when you run it…" className={field} />
      </label>
      {state.error && <p className="text-sm text-[#9c4a2d]">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-caramel px-4 text-sm font-semibold text-white hover:bg-[#8a5e30] disabled:opacity-50"
        >
          {pending ? "Queuing…" : "Queue recap"}
        </button>
        {state.ok && <span className="text-sm text-[#4f6b34]">Queued — copy the command below to run it.</span>}
      </div>
    </form>
  );
}
