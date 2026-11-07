import { handle, readJson } from "@/lib/http";
import { resolveClassification, StatsError, type ProvidedClassification } from "@/lib/stats";

/** POST /api/classify — dry run: which stats would this question hit? Writes nothing. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ question?: string; subject?: string; classification?: ProvidedClassification }>(req);
    if (!body.question?.trim()) throw new StatsError("question is required", 400);
    return resolveClassification(body.subject ?? "maths", body.question, body.classification);
  });
}
