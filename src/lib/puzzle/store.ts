import { createClient, type RedisClientType } from "redis";
import { isPuzzle, type Puzzle } from "./types";

/**
 * Storage abstraction so the UI never imports Redis directly. Lets us
 * swap implementations (in-memory mock, file-based) without touching
 * API routes.
 */
export interface PuzzleStore {
  /** Persist a puzzle. Returns the short ID assigned to it. */
  save(puzzle: Puzzle): Promise<string>;
  /** Fetch a puzzle by ID. Returns null if not found or malformed. */
  load(id: string): Promise<Puzzle | null>;
}

const REDIS_PREFIX = "puzzle:";
/** Reasonable TTL for unclaimed puzzles. 90 days from first save. */
const TTL_SECONDS = 60 * 60 * 24 * 90;

class RedisPuzzleStore implements PuzzleStore {
  private clientPromise: Promise<RedisClientType> | null = null;

  private async getClient(): Promise<RedisClientType> {
    if (!this.clientPromise) {
      const url = process.env.REDIS_URL;
      if (!url) {
        throw new Error(
          "REDIS_URL is not set. Run `vercel env pull .env.development.local`."
        );
      }
      const client = createClient({ url }) as RedisClientType;
      // Surface connection errors loudly instead of crashing the request
      client.on("error", (err) => {
        console.error("[redis] client error:", err);
      });
      this.clientPromise = client.connect().then(() => client);
    }
    return this.clientPromise;
  }

  async save(puzzle: Puzzle): Promise<string> {
    const client = await this.getClient();
    const id = await this.generateUniqueId(client);
    await client.set(REDIS_PREFIX + id, JSON.stringify(puzzle), {
      EX: TTL_SECONDS,
    });
    return id;
  }

  async load(id: string): Promise<Puzzle | null> {
    if (!isValidId(id)) return null;
    const client = await this.getClient();
    const raw = await client.get(REDIS_PREFIX + id);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!isPuzzle(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async generateUniqueId(client: RedisClientType): Promise<string> {
    // Try up to 5 times to find a free ID. At 8 chars from a 32-symbol
    // alphabet that's 2^40 = 10^12 combinations — collision risk is
    // negligible until we have billions of puzzles.
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = randomId(8);
      const exists = await client.exists(REDIS_PREFIX + id);
      if (!exists) return id;
    }
    throw new Error("Could not allocate a free puzzle ID after 5 attempts");
  }
}

/**
 * Crockford base32 — short, URL-safe, no ambiguous characters (no I/L/O/U).
 */
const ID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

function randomId(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  }
  return out;
}

/** Reject IDs that contain unexpected characters before hitting Redis. */
export function isValidId(id: string): boolean {
  if (typeof id !== "string" || id.length < 4 || id.length > 16) return false;
  for (const ch of id) if (!ID_ALPHABET.includes(ch)) return false;
  return true;
}

let cachedStore: PuzzleStore | null = null;

/** Get the process-wide puzzle store instance. */
export function getPuzzleStore(): PuzzleStore {
  if (!cachedStore) cachedStore = new RedisPuzzleStore();
  return cachedStore;
}
