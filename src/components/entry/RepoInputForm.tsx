"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseRepoInput } from "@/lib/github/parseRepoInput";

export function RepoInputForm() {
  const router = useRouter();
  const [value, setValue] = useState("lumen-labs/lumen-pay");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = parseRepoInput(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    router.push(`/map/${result.value.owner}/${result.value.repo}`);
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex items-stretch overflow-hidden rounded-md border border-line bg-panel focus-within:border-muted">
        <span className="hidden items-center px-3 font-mono text-sm text-muted sm:flex">
          github.com/
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="facebook/react"
          spellCheck={false}
          autoFocus
          className="flex-1 bg-transparent px-3 py-3 font-mono text-sm text-text outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          className="bg-text px-4 text-sm font-semibold text-app transition hover:bg-white"
        >
          Visualize
        </button>
      </div>
      {error && (
        <p className="mt-2 font-mono text-xs text-[#ff5b5b]">{error}</p>
      )}
    </form>
  );
}
