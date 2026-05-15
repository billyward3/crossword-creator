import { NextResponse } from "next/server";
import { getPuzzleStore, isValidId } from "@/lib/puzzle/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid puzzle ID" }, { status: 400 });
  }

  try {
    const puzzle = await getPuzzleStore().load(id);
    if (!puzzle) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(puzzle);
  } catch (err) {
    console.error("[api/puzzles/[id]] load failed:", err);
    return NextResponse.json(
      { error: "Failed to load puzzle" },
      { status: 500 }
    );
  }
}
