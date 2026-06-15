import Link from "next/link";
import { CreateModuleForm } from "./create-module-form";

export default function NewModulePage() {
  return (
    <div className="flex max-w-2xl flex-col gap-7">
      <div className="text-sm text-[#9c886a]">
        <Link href="/admin/modules" className="text-caramel hover:underline">
          Modules
        </Link>{" "}
        · New
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-caramel">
          nova / training
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">New module</h1>
        <p className="mt-1 text-sm text-[#9c886a]">
          Adds to the shared playbook every client sees. Create the shell, then add
          chapters and lessons in the builder.
        </p>
      </div>
      <div className="rounded-xl border border-[#3a2a1c] bg-[#251910] p-6">
        <CreateModuleForm />
      </div>
    </div>
  );
}
