import { NextResponse } from 'next/server';
import { adminAuth } from '../firebase-admin';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function authenticate(request: Request, administrator = false) {
  const bearer = request.headers.get('authorization');
  const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('authToken='))?.slice(10);
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : cookie;
  if (!token) throw new ApiError(401, '로그인이 필요합니다.');
  let identity;
  try { identity = await adminAuth().verifyIdToken(token, true); }
  catch { throw new ApiError(401, '로그인이 만료되었습니다. 다시 로그인해주세요.'); }
  if (administrator && identity.admin !== true) throw new ApiError(403, '관리자 권한이 필요합니다.');
  return identity;
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Community API failed', error);
  return NextResponse.json({ error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
}

export async function guardAdmin(request: Request) {
  try { await authenticate(request, true); return null; }
  catch (error) { return apiError(error); }
}

export async function verifiedCookieUid(token?: string) {
  if (!token) return '';
  try { return (await adminAuth().verifyIdToken(token, true)).uid; } catch { return ''; }
}
