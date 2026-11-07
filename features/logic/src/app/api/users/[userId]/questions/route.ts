import { handle, readJson } from "@/lib/http";
import { recordQuestion, type ProvidedClassification } from "@/lib/stats";

type Ctx = { params: Promise<{ userId: string }> };

/**
 * POST /api/users/:userId/questions
 * { question: string, subject?: "maths", classification?: { weights, depth? }, displayName? }
 * Call this every time the user asks the chatbot something.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { userId } = await params;
  return handle(async () => {
    const body = await readJson<{
      question: string;
      subject?: string;
      classification?: ProvidedClassification;
      displayName?: string;
    }>(req);
    return recordQuestion({ userId, ...body });
  });
}
