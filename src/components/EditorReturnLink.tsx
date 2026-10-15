"use client";

import { useStoredState } from "@/lib/stored-state";

const STORAGE_KEY_EDITOR = "crossword-editor-state";

/**
 * Renders a "Resume editing" link only when there's a saved puzzle in
 * the editor. Lets users navigate freely to /about (and back) without
 * losing context. The editor saves on every change so the saved state
 * is always current.
 */
export function EditorReturnLink() {
  const [saved] = useStoredState<unknown>(STORAGE_KEY_EDITOR, null);

  if (saved === null) return null;

  return (
    <a
      href="/create/edit"
      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
    >
      Resume editing &rarr;
    </a>
  );
}
