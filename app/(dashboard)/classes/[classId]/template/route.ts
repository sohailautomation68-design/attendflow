import { NextResponse } from "next/server";
import { AccessError, getClass } from "@/lib/data";
import { requireUser } from "@/lib/session";

/** Downloadable CSV template for student import. */
export async function GET(_request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const user = await requireUser();
  const { classId } = await params;
  try {
    await getClass(user, classId);
  } catch (e) {
    if (e instanceof AccessError) return new NextResponse("Not found", { status: 404 });
    throw e;
  }
  const csv = "fullName,rollNumber,guardianPhone\r\nAli Khan,1,0300-1234567\r\nSara Ahmed,2,\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="student-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
