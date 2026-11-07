import { NextResponse } from "next/server";
import { StatsError } from "@/lib/stats";

/** Wrap a route handler so StatsErrors become JSON { error } with the right status. */
export async function handle<T>(fn: () => Promise<T>, status = 200): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (err) {
    if (err instanceof StatsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Parse a JSON body or throw a 400. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new Error();
    return body as T;
  } catch {
    throw new StatsError("Request body must be a JSON object", 400);
  }
}
