import { deleteAccount } from '@/lib/server/delete-account';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { authenticate, apiError, ApiError } from '@/lib/server/auth';
import { executeCommunity } from '@/lib/server/community';
import { adminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const token = await authenticate(request);
    const body = await request.text();
    if (Buffer.byteLength(body) > 150000) throw new ApiError(413, '요청이 너무 큽니다.');
    let parsed;
    try { parsed = JSON.parse(body); } catch { throw new ApiError(400, '잘못된 요청입니다.'); }
    const { action, data } = z.object({ action: z.string().max(40), data: z.record(z.unknown()).default({}) }).parse(parsed);
    const result = action === 'account.delete' ? await deleteAccount(token) : await executeCommunity(adminFirestore(), token, action, data);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || '입력값을 확인해주세요.' }, { status: 400 });
    return apiError(error);
  }
}
