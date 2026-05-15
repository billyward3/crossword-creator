import { NextResponse } from "next/server";
import { getPuzzleStore } from "@/lib/puzzle/store";
import { isPuzzle, type Puzzle } from "@/lib/puzzle/types";

/** Reject bodies above this size. ~200KB is generous for any reasonable puzzle. */
const MAX_BODY_BYTES = 200_000;

export async function POST(req: Request) {
  // Guard against giant payloads before parsing
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Puzzle too large" },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // The incoming body is a Puzzle minus createdAt — we set that here.
  const candidate: Puzzle = {
    ...(body as Partial<Puzzle>),
    version: 1,
    createdAt: new Date().toISOString(),
  } as Puzzle;

  if (!isPuzzle(candidate)) {
    return NextResponse.json(
      { error: "Puzzle payload failed validation" },
      { status: 400 }
    );
  }

  try {
    const id = await getPuzzleStore().save(candidate);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("[api/puzzles] save failed:", err);
    return NextResponse.json(
      { error: "Failed to store puzzle" },
      { status: 500 }
    );
  }
}
