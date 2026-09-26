/** Non-destructive recovery bootstrap. Dry-run is the default; never imports into an implicit project. */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { publicProfile, nameKey, userName } from '../src/lib/server/schema';

async function main() {
  const args = process.argv.slice(2);
  const projectId = args.find(v => v.startsWith('--project='))?.slice(10);
  if (!projectId) throw new Error('Specify --project=PROJECT_ID. Default mode is read-only.');
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== projectId) throw new Error('FIREBASE_PROJECT_ID does not match --project.');
  process.env.FIREBASE_PROJECT_ID = projectId;
  const { adminFirestore, adminAuth } = await import('../src/lib/firebase-admin');
  const db = adminFirestore();
  const apply = args.includes('--apply');
  const stamp = FieldValue.serverTimestamp();
  const plan: { path: string; data: Record<string, unknown>; createOnly: boolean }[] = [];
  const definitions = [
    { code: 'free', name: '자유게시판', icon: '💬' },
    { code: 'qna', name: '질문/답변', icon: '❓' },
    { code: 'info', name: '정보공유', icon: '📚' },
  ];
  for (const type of ['national', 'regional', 'school']) {
    for (const [index, definition] of definitions.entries()) {
      const existing = await db.collection('boards').where('code', '==', definition.code).where('type', '==', type).limit(1).get();
      if (!existing.empty) continue;
      plan.push({ path: `boards/${type}_${definition.code}`, createOnly: true, data: { ...definition, type, description: definition.name, isActive: true, order: index + 1, categories: [], stats: { postCount: 0 }, accessLevel: { read: 'all', write: 'all' }, settings: { allowAnonymous: true, allowAttachment: true, maxAttachmentSize: 10 }, createdAt: stamp, updatedAt: stamp } });
    }
  }
  const schoolsFile = args.find(v => v.startsWith('--schools='))?.slice(10);
  if (schoolsFile) {
    const schools = z.array(z.object({ id: z.string().min(1).max(128).refine(v => !v.includes('/')), name: z.string().min(1).max(100), address: z.string().max(300).default(''), region: z.string().max(80).default(''), schoolType: z.string().max(40).default('') })).parse(JSON.parse(readFileSync(schoolsFile, 'utf8')));
    if (new Set(schools.map(v => v.id)).size !== schools.length) throw new Error('Duplicate school IDs in import.');
    for (const school of schools) if (!(await db.doc(`schools/${school.id}`).get()).exists) plan.push({ path: `schools/${school.id}`, createOnly: true, data: { ...school, memberCount: 0, favoriteCount: 0, createdAt: stamp, updatedAt: stamp } });
  }
  if (args.includes('--rebuild-public-profiles')) {
    const seen = new Map<string, string>();
    let cursor;
    do {
      let query = db.collection('users').orderBy('__name__').limit(200);
      if (cursor) query = query.startAfter(cursor);
      const batch = await query.get();
      if (batch.empty) break;
      for (const snapshot of batch.docs) {
        const data = snapshot.data();
        // Skip orphan documents and fake/bot accounts; a client-writeable role is never trusted.
        try { await adminAuth().getUser(snapshot.id); } catch (error: any) {
          if (error.code === 'auth/user-not-found') { console.log(`SKIP orphan user: ${snapshot.id}`); continue; }
          throw error;
        }
        const nickname = userName.parse(data.profile?.userName);
        const key = nameKey(nickname);
        const current = await db.doc(`usernames/${key}`).get();
        if ((seen.has(key) && seen.get(key) !== snapshot.id) || (current.exists && current.data()!.uid !== snapshot.id)) throw new Error(`Nickname conflict for UID ${snapshot.id}; resolve before applying.`);
        seen.set(key, snapshot.id);
        plan.push({ path: `publicProfiles/${snapshot.id}`, createOnly: false, data: publicProfile({ ...data, uid: snapshot.id, createdAt: data.createdAt || stamp, updatedAt: stamp }) });
        if (!current.exists) plan.push({ path: `usernames/${key}`, createOnly: true, data: { uid: snapshot.id, createdAt: stamp } });
      }
      cursor = batch.docs.at(-1);
    } while (cursor);
  }
  console.log(JSON.stringify({ projectId, mode: apply ? 'apply' : 'dry-run', writes: plan.map(({ path, createOnly }) => ({ path, operation: createOnly ? 'create-if-missing' : 'replace-public-projection' })) }, null, 2));
  if (!apply) return;
  // Each chunk is retry-safe. Existing private profiles, posts and Auth users are never deleted.
  for (const operation of plan) {
    await db.runTransaction(async tx => {
      const ref = db.doc(operation.path);
      const existing = await tx.get(ref);
      if (operation.createOnly && existing.exists) return;
      tx.set(ref, operation.data);
    });
  }
  console.log(`Applied ${plan.length} planned writes. Private user data and content preserved.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
