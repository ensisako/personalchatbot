// src/app/api/envtest/route.ts
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() {
  const v = process.env.OPENAI_API_KEY;
  return NextResponse.json({ hasKey: !!v, prefix: v?.slice(0,5) ?? null, len: v?.length ?? 0 });
}
