import { approveCase } from "../../../../../db/runtime";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    reviewer?: string;
  };
  const result = await approveCase(id, body.reviewer || "Operations lead");
  if (!result) {
    return Response.json({ error: "Case not found." }, { status: 404 });
  }
  return Response.json(result);
}

