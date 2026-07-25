import { getOverview } from "../../../db/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getOverview(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to load ResolveOps overview", error);
    return Response.json(
      { error: "The operations dataset is temporarily unavailable." },
      { status: 503 },
    );
  }
}

