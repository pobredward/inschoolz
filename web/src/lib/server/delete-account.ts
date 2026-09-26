import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, adminFirestore } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ApiError } from './auth';
import { nameKey } from './schema';

// Restartable cleanup: keep Auth until database cleanup succeeds, so a failed request can be retried.
export async function deleteAccount(token: DecodedIdToken) {
  if (Date.now() / 1000 - token.auth_time > 300) throw new ApiError(401, '계정 삭제를 위해 다시 로그인해주세요.');
  const db = adminFirestore();
  const uid = token.uid;
  const userRef = db.doc(`users/${uid}`);
  const user = (await userRef.get()).data();
  if (user) await userRef.update({ status: 'deleting', updatedAt: FieldValue.serverTimestamp() });
  const writer = db.bulkWriter();
  const jobs = [
    { query: db.collection('posts').where('authorId', '==', uid), remove: false },
    { query: db.collectionGroup('comments').where('authorId', '==', uid), remove: false },
    { query: db.collection('userRelationships').where('userId', '==', uid), remove: true },
    { query: db.collection('userRelationships').where('targetId', '==', uid), remove: true },
    { query: db.collection('notifications').where('userId', '==', uid), remove: true },
  ];
  for (const job of jobs) {
    const snapshot = await job.query.get();
    await Promise.all(snapshot.docs.map(doc => job.remove ? writer.delete(doc.ref) : writer.update(doc.ref, { authorId: 'deleted', authorInfo: { displayName: '삭제된 계정', isAnonymous: true, profileImageUrl: '' }, isAnonymous: true, updatedAt: FieldValue.serverTimestamp() })));
  }
  await writer.close();
  if (user?.profile?.userName) {
    const ref = db.doc(`usernames/${nameKey(user.profile.userName)}`);
    await db.runTransaction(async tx => { const snapshot = await tx.get(ref); if (snapshot.data()?.uid === uid) tx.delete(ref); });
  }
  await Promise.all([db.doc(`publicProfiles/${uid}`).delete(), db.doc(`attendance/${uid}`).delete(), db.doc(`quests/${uid}`).delete()]);
  // Deleting Auth first prevents a simultaneous login from recreating a removed Firestore profile.
  await adminAuth().deleteUser(uid);
  await db.recursiveDelete(userRef);
  return { success: true };
}
