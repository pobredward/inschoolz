import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, deleteObject, getBytes } from 'firebase/storage';
let env: RulesTestEnvironment;
before(async () => {
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error('Storage emulator required');
  env = await initializeTestEnvironment({ projectId: 'demo-inschoolz', storage: { rules: readFileSync('storage.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });
test('uploads enforce ownership, safe MIME types and public download', async () => {
  const owner = env.authenticatedContext('storage-owner').storage();
  const other = env.authenticatedContext('storage-other').storage();
  const guest = env.unauthenticatedContext().storage();
  const path = 'uploads/storage-owner/security-test.txt';
  await assertSucceeds(uploadBytes(ref(owner, path), new Uint8Array([65]), { contentType: 'text/plain' }));
  await assertSucceeds(getBytes(ref(guest, path)));
  await assertFails(uploadBytes(ref(other, path), new Uint8Array([65]), { contentType: 'text/plain' }));
  await assertFails(deleteObject(ref(other, path)));
  await assertFails(uploadBytes(ref(guest, 'uploads/guest/test.txt'), new Uint8Array([65]), { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(owner, 'uploads/storage-owner/test.html'), new Uint8Array([65]), { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(owner, 'legacy/test.txt'), new Uint8Array([65]), { contentType: 'text/plain' }));
  await assertSucceeds(deleteObject(ref(owner, path)));
});
