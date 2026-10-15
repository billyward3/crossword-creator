import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readStored, writeStored } from "@/lib/stored-state";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
  };
}

describe("stored state", () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    storage = fakeStorage({ seeded: JSON.stringify(["A", "B"]), broken: "{not json" });
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads existing localStorage values and falls back when missing or corrupt", () => {
    expect(readStored("seeded", [])).toEqual(["A", "B"]);
    expect(readStored("missing", "default")).toBe("default");
    expect(readStored("broken", 7)).toBe(7);
  });

  it("writes through to localStorage", () => {
    writeStored("written", { n: 1 });
    expect(storage.data.get("written")).toBe('{"n":1}');
    expect(readStored("written", null)).toEqual({ n: 1 });
  });

  it("keeps the value in memory when localStorage rejects the write", () => {
    storage.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    writeStored("quota", ["kept"]);
    expect(readStored("quota", [])).toEqual(["kept"]);
  });
});
