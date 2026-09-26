import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from '@/types';

export async function communityCommand<T = any>(action: string, data: Record<string, unknown> = {}, expectedUid?: string): Promise<T> {
  const user = auth.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) throw new Error('로그인이 필요합니다.');
  const response = await fetch('/api/community/command', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action, data }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
  return result as T;
}
export async function ensureUserProfile(data: Record<string, unknown> = {}): Promise<User> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('로그인이 필요합니다.');
  await communityCommand('bootstrap', data, uid);
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) throw new Error('프로필을 불러오지 못했습니다.');
  return { ...snapshot.data(), uid } as User;
}
