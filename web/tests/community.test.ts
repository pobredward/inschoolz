import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminFirestore } from '../src/lib/firebase-admin';
import { executeCommunity } from '../src/lib/server/community';
import { authenticate } from '../src/lib/server/auth';
import { publicProfile, relationshipKey } from '../src/lib/server/schema';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Emulators required');
const db = adminFirestore();
// Fresh emulator user state also makes repeated test invocations deterministic.
let env: RulesTestEnvironment;
const command = (uid: string, action: string, data: Record<string, unknown> = {}) => executeCommunity(db, { uid, email: `${uid}@example.test`, email_verified: true } as DecodedIdToken, action, data);
let postId: string;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-inschoolz', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/demo-inschoolz/accounts`, { method: 'DELETE' });
  await db.doc('boards/national_free').set({ code: 'free', name: '자유게시판', type: 'national', isActive: true, stats: { postCount: 0 } });
  await db.doc('schools/school1').set({ name: '테스트학교' });
});
after(async () => { await env.cleanup(); });
test('missing profiles recover with original UID and private/public separation', async () => {
  await command('alice', 'bootstrap', { profile: { userName: 'Alice', realName: 'Private', phoneNumber: '010-1234-5678' } });
  await command('bob', 'bootstrap', { profile: { userName: 'Bob' } });
  const user = (await db.doc('users/alice').get()).data()!;
  assert.equal(user.uid, 'alice'); assert.equal(user.role, 'student'); assert.equal(user.stats.level, 1);
  const visible = (await db.doc('publicProfiles/alice').get()).data()!;
  assert.equal(visible.profile.phoneNumber, undefined); assert.equal(visible.email, undefined); assert.equal(visible.profile.realName, undefined);
});
test('concurrent nickname reservation has exactly one winner', async () => {
  const results = await Promise.allSettled([command('race1', 'bootstrap', { profile: { userName: 'SameName' } }), command('race2', 'bootstrap', { profile: { userName: 'samename' } })]);
  assert.equal(results.filter(v => v.status === 'fulfilled').length, 1);
});
test('auth observer racing signup does not discard user profile or agreements', async () => {
  await command('observer', 'bootstrap');
  await command('observer', 'bootstrap', { profile: { userName: 'SelectedName' }, school: { id: 'school1' }, agreements: { terms: true, privacy: true, location: false, marketing: false } });
  const user = (await db.doc('users/observer').get()).data()!;
  assert.equal(user.profile.userName, 'SelectedName'); assert.equal(user.school.id, 'school1'); assert.equal(user.agreements.terms, true);
});
test('restored roles cannot confer admin privileges', async () => {
  await db.doc('users/alice').update({ role: 'admin', 'profile.isAdmin': true });
  await command('alice', 'bootstrap');
  assert.equal((await db.doc('users/alice').get()).data()!.role, 'student');
});
test('private users are owner-only; public profile search works', async () => {
  const anonymous = env.unauthenticatedContext().firestore(); const alice = env.authenticatedContext('alice').firestore();
  await assertFails(getDoc(doc(anonymous, 'users/alice'))); await assertFails(getDoc(doc(alice, 'users/bob')));
  await assertSucceeds(getDoc(doc(alice, 'users/alice'))); await assertSucceeds(getDoc(doc(anonymous, 'publicProfiles/alice')));
  await assertSucceeds(getDocs(query(collection(anonymous, 'publicProfiles'), where('profile.userName', '==', 'Alice'))));
});
test('clients cannot grant admin, mint XP, impersonate authors or forge relationships', async () => {
  const client = env.authenticatedContext('alice').firestore();
  await assertFails(updateDoc(doc(client, 'users/alice'), { role: 'admin' }));
  await assertFails(updateDoc(doc(client, 'users/alice'), { 'stats.totalExperience': 9999 }));
  await assertFails(setDoc(doc(client, 'users/intruder'), { role: 'admin' }));
  await assertFails(setDoc(doc(client, 'posts/forged'), { authorId: 'bob' }));
  await assertFails(setDoc(doc(client, 'userRelationships/forged'), { userId: 'bob', type: 'follow' }));
  await assertFails(setDoc(doc(client, 'publicProfiles/alice'), { email: 'leak' }));
});
test('post creation atomically resolves board code and writes counters/rewards', async () => {
  const result = await command('alice', 'post.create', { title: '첫 글', content: '<p>Hello</p><script>alert(1)</script>', boardCode: 'free', type: 'national', authorId: 'bob' }) as { id: string };
  postId = result.id;
  const post = (await db.doc(`posts/${postId}`).get()).data()!;
  assert.equal(post.authorId, 'alice'); assert.equal(post.boardId, 'national_free'); assert.equal(post.content.includes('<script>'), false);
  assert.equal((await db.doc('boards/national_free').get()).data()!.stats.postCount, 1);
  assert.equal((await db.doc('users/alice').get()).data()!.stats.postCount, 1);
  assert.equal((await db.doc('users/alice').get()).data()!.stats.totalExperience, 10);
});
test('author ownership and immutable counters survive malicious edit input', async () => {
  await assert.rejects(command('bob', 'post.update', { postId, userId: 'alice', data: { title: 'stolen' } }), /작성자/);
  await assert.rejects(command('bob', 'post.delete', { postId }), /작성자/);
  await command('alice', 'post.update', { postId, data: { title: '수정 완료', authorId: 'bob', stats: { likeCount: 100 } } });
  const post = (await db.doc(`posts/${postId}`).get()).data()!;
  assert.equal(post.title, '수정 완료'); assert.equal(post.authorId, 'alice'); assert.equal(post.stats.likeCount, 0);
});
test('concurrent like toggles cannot duplicate edges or corrupt counts', async () => {
  await Promise.all([command('bob', 'post.like', { postId }), command('bob', 'post.like', { postId })]);
  assert.equal((await db.doc(`posts/${postId}`).get()).data()!.stats.likeCount, 0);
  assert.equal((await db.collection(`posts/${postId}/likes`).get()).size, 0);
});
test('comments, replies, notifications and deletion counts remain consistent', async () => {
  const { id: commentId } = await command('bob', 'comment.create', { postId, content: '댓글', isAnonymous: true }) as { id: string };
  await command('alice', 'comment.create', { postId, content: '답글', parentId: commentId });
  assert.equal((await db.doc(`posts/${postId}`).get()).data()!.stats.commentCount, 2);
  assert.equal((await db.collection('notifications').where('userId', '==', 'alice').get()).size, 1);
  await assert.rejects(command('alice', 'comment.delete', { postId, commentId }), /작성자/);
  await command('bob', 'comment.delete', { postId, commentId });
  assert.equal((await db.doc(`posts/${postId}`).get()).data()!.stats.commentCount, 1);
  await assert.rejects(command('bob', 'comment.delete', { postId, commentId }), /콘텐츠/);
});
test('follows reject self/missing targets, serialize toggles and respect reverse blocks', async () => {
  await assert.rejects(command('alice', 'relationship.toggle', { targetId: 'alice', type: 'follow' }));
  await assert.rejects(command('alice', 'relationship.toggle', { targetId: 'missing', type: 'follow' }));
  await Promise.all([command('alice', 'relationship.toggle', { targetId: 'bob', type: 'follow' }), command('alice', 'relationship.toggle', { targetId: 'bob', type: 'follow' })]);
  const path = `userRelationships/${relationshipKey('alice', 'bob', 'follow')}`;
  assert.equal((await db.doc(path).get()).data()!.status, 'inactive');
  await command('alice', 'relationship.toggle', { targetId: 'bob', type: 'follow' });
  await command('bob', 'relationship.toggle', { targetId: 'alice', type: 'block' });
  assert.equal((await db.doc(path).get()).data()!.status, 'inactive');
  await assert.rejects(command('alice', 'relationship.toggle', { targetId: 'bob', type: 'follow' }), /차단/);
});
test('attendance and receipt replay cannot mint duplicate XP', async () => {
  const previous = (await db.doc('users/alice').get()).data()!.stats.totalExperience;
  await Promise.all([command('alice', 'attendance.check', { doCheck: true }), command('alice', 'attendance.check', { doCheck: true })]);
  await command('alice', 'reward.claim', { activityType: 'post', amount: 999999 });
  assert.equal((await command('alice', 'reward.claim', { activityType: 'post' }) as { success: boolean }).success, false);
  assert.equal((await db.doc('users/alice').get()).data()!.stats.totalExperience, previous + 10);
});
test('suspended accounts cannot recreate themselves or mutate content', async () => {
  await db.doc('users/bob').update({ status: 'suspended' });
  await assert.rejects(command('bob', 'bootstrap'), /제한/);
  await assert.rejects(command('bob', 'post.like', { postId }), /제한/);
});
test('administrator guard rejects forged tokens and role cookies', async () => {
  await assert.rejects(authenticate(new Request('http://localhost', { headers: { cookie: 'userRole=admin; uid=alice' } }), true));
  await assert.rejects(authenticate(new Request('http://localhost', { headers: { authorization: 'Bearer forged' } }), true));
});
test('public projection excludes arbitrary sensitive fields', () => {
  const result = publicProfile({ uid: 'x', email: 'secret', fcmToken: 'secret', role: 'admin', profile: { userName: 'Safe', phoneNumber: 'secret', realName: 'secret' }, school: { id: 's', name: 'school', studentNumber: 3 }, regions: { sido: '서울', sigungu: '중구', address: 'secret' }, createdAt: 1, updatedAt: 1 });
  assert.equal(JSON.stringify(result).includes('secret'), false); assert.equal('studentNumber' in result.school!, false);
});

test('school favorites and profile edits keep public/private projections consistent', async () => {
  await command('alice', 'school.set', { schoolId: 'school1' });
  await command('alice', 'profile.update', { realName: 'Another private name', address: 'private address', sido: '서울', sigungu: '중구', role: 'admin' });
  const visible = (await db.doc('publicProfiles/alice').get()).data()!;
  assert.equal(visible.school.id, 'school1'); assert.equal(visible.regions.address, undefined);
  assert.equal((await db.doc('users/alice').get()).data()!.role, 'student');
  await command('alice', 'school.favorite', { schoolId: 'school1' });
  assert.equal((await db.doc('users/alice').get()).data()!.favorites.schools.includes('school1'), false);
});
test('poll votes are serialized and switching/removing votes preserves totals', async () => {
  const { id: pollPost } = await command('alice', 'post.create', { title: '투표', content: '선택', boardCode: 'free', type: 'national', poll: { question: '선택', options: ['A', 'B'] } }) as { id: string };
  await command('alice', 'poll.vote', { postId: pollPost, option: 0 });
  await command('alice', 'poll.vote', { postId: pollPost, option: 1 });
  assert.deepEqual((await db.doc(`posts/${pollPost}`).get()).data()!.poll.options.map((v: any) => v.voteCount), [0, 1]);
  await command('alice', 'poll.vote', { postId: pollPost, option: null });
  assert.deepEqual((await db.doc(`posts/${pollPost}`).get()).data()!.poll.options.map((v: any) => v.voteCount), [0, 0]);
  await assert.rejects(command('alice', 'poll.vote', { postId: pollPost, option: 99 }));
});
test('game rewards require a session and cannot be replayed or set by caller XP', async () => {
  await assert.rejects(command('alice', 'game.finish', { gameType: 'tileGame', score: 5 }));
  await command('alice', 'game.start', { gameType: 'tileGame' });
  const old = (await db.doc('users/alice').get()).data()!.stats.totalExperience;
  await command('alice', 'game.finish', { gameType: 'tileGame', score: 5, xpEarned: 99999 });
  assert.equal((await db.doc('users/alice').get()).data()!.stats.totalExperience, old + 15);
  await assert.rejects(command('alice', 'game.finish', { gameType: 'tileGame', score: 5 }));
});
test('quest tracking verifies server evidence and never accepts arbitrary XP', async () => {
  await command('alice', 'quest.initialize');
  const old = (await db.doc('users/alice').get()).data()!.stats.totalExperience;
  await command('alice', 'quest.track', { actionType: 'nickname_change', xp: 99999 });
  assert.equal((await db.doc('users/alice').get()).data()!.stats.totalExperience, old + 50);
  // Current step needs an actual favorite school; caller cannot invent it.
  const result = await command('alice', 'quest.track', { actionType: 'favorite_school', metadata: { count: 999 } }) as { completed: boolean };
  assert.equal(result.completed, false);
  assert.equal((await db.doc('users/alice').get()).data()!.stats.totalExperience, old + 50);
});
test('real emulator ID token passes login/command authorization; forged actor is ignored', async () => {
  const { adminAuth } = await import('../src/lib/firebase-admin');
  const { POST } = await import('../src/app/api/community/command/route');
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'real@example.test', password: 'a-strong-test-password', returnSecureToken: true }) });
  const credentials = await response.json();
  assert.equal(response.ok, true);
  const request = () => new Request('http://localhost/api/community/command', { method: 'POST', headers: { authorization: `Bearer ${credentials.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bootstrap', data: { uid: 'alice', role: 'admin' } }) });
  assert.equal((await POST(request())).status, 200);
  assert.equal((await db.doc(`users/${credentials.localId}`).get()).data()!.role, 'student');
  await assert.rejects(authenticate(request(), true), /관리자/);
  await adminAuth().updateUser(credentials.localId, { disabled: true });
  assert.equal((await POST(request())).status, 401);
});

test('referral attribution is private, immutable and never trusts caller rewards', async () => {
  await command('referral-user', 'bootstrap', { profile: { userName: 'ReferredUser' }, referral: 'Alice', reward: 999999 });
  const ref = db.doc('users/referral-user');
  assert.equal((await ref.get()).data()!.referral.referrerId, 'alice');
  assert.equal((await ref.get()).data()!.stats.totalExperience, 0);
  await command('referral-user', 'bootstrap', { referral: 'NoSuchUser' });
  assert.equal((await ref.get()).data()!.referral.referrerId, 'alice');
  assert.equal((await db.doc('publicProfiles/referral-user').get()).data()!.referral, undefined);
  await assert.rejects(command('referral-user', 'bootstrap', { profile: { userName: 'bad/name' } }));
});
test('school class details remain private and quest cosmetics require earned rewards', async () => {
  await command('alice', 'school.set', { schoolId: 'school1', schoolInfo: { grade: '2', classNumber: '3', studentNumber: '12' } });
  assert.equal((await db.doc('users/alice').get()).data()!.school.classNumber, 3);
  assert.equal((await db.doc('publicProfiles/alice').get()).data()!.school.classNumber, undefined);
  const client = env.authenticatedContext('alice').firestore();
  await assertFails(updateDoc(doc(client, 'quests/alice'), { activeRewards: { title: 'forged-title' } }));
  await assertSucceeds(updateDoc(doc(client, 'quests/alice'), { activeRewards: { badges: [] } }));
});
