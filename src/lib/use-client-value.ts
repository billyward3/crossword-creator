import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * Reads a browser-only value (localStorage, window.location) without a
 * hydration mismatch: the server render and the hydration pass both see
 * `serverValue`, then React re-renders with `getClientValue()`.
 * `getClientValue` must return a primitive so React can compare snapshots.
 */
export function useClientValue<T extends string | number | boolean>(
  getClientValue: () => T,
  serverValue: T
): T {
  return useSyncExternalStore(subscribeNever, getClientValue, () => serverValue);
}
