import { z } from 'zod';

export const id = z.string().min(1).max(128).refine(v => !v.includes('/') && v !== '.' && v !== '..', '잘못된 문서 ID입니다.');
export const userName = z.string().trim().min(2).max(24).regex(/^[\p{L}\p{N}_-]+$/u, '닉네임은 문자, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.');
const url = z.union([z.literal(''), z.string().url().max(2048).refine(v => v.startsWith('https://'))]);
const privateProfile = {
  realName: z.string().max(80).optional(), gender: z.string().max(10).optional(),
  birthYear: z.coerce.number().int().min(0).max(2100).optional(),
  birthMonth: z.coerce.number().int().min(0).max(12).optional(),
  birthDay: z.coerce.number().int().min(0).max(31).optional(),
  phoneNumber: z.string().max(30).optional(),
};
export const profileInput = z.object({
  userName: userName.optional(), profileImageUrl: url.optional(), ...privateProfile,
  sido: z.string().max(40).optional(), sigungu: z.string().max(40).optional(), address: z.string().max(300).optional(),
});
export const bootstrapInput = z.object({
  referral: userName.optional(),
  profile: profileInput.optional(),
  school: z.object({ id, name: z.string().max(100).optional(), grade: z.coerce.number().int().min(0).max(20).optional(), classNumber: z.coerce.number().int().min(0).max(100).optional(), studentNumber: z.coerce.number().int().min(0).max(1000).optional(), isGraduate: z.boolean().optional() }).optional(),
  regions: z.object({ sido: z.string().max(40), sigungu: z.string().max(40), address: z.string().max(300).optional() }).optional(),
  favorites: z.object({ schools: z.array(id).max(5), boards: z.array(z.string().max(150)).max(100) }).optional(),
  agreements: z.object({ terms: z.boolean(), privacy: z.boolean(), location: z.boolean(), marketing: z.boolean() }).optional(),
});
export const postInput = z.object({
  title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(100000),
  boardCode: id, type: z.enum(['national', 'regional', 'school']),
  schoolId: id.optional(), regions: z.object({ sido: z.string().min(1).max(40), sigungu: z.string().min(1).max(40) }).optional(),
  category: z.union([z.string().max(80), z.object({ id, name: z.string().max(80) })]).optional(), tags: z.array(z.string().max(40)).max(10).default([]),
  isAnonymous: z.boolean().default(false),
  attachments: z.array(z.object({ type: z.enum(['image', 'file']), url, name: z.string().max(200), size: z.number().min(0).max(10485760) })).max(20).default([]),
  poll: z.object({ question: z.string().trim().min(1).max(200), options: z.array(z.union([z.string().trim().min(1).max(200), z.object({ text: z.string().trim().min(1).max(200), imageUrl: url.optional() })])).min(2).max(10), multipleChoice: z.boolean().default(false), expiresAt: z.union([z.string().datetime(), z.number().positive()]).optional() }).optional(),
});
export const postEdit = postInput.pick({ title: true, content: true, tags: true, isAnonymous: true, attachments: true }).partial();
export const commentInput = z.object({ postId: id, content: z.string().trim().min(1).max(10000), parentId: id.nullish(), isAnonymous: z.boolean().default(false) });

// Explicit projection: never copy private profile fields or access-control data to public documents.
export function publicProfile(user: Record<string, any>) {
  return {
    uid: user.uid,
    profile: { userName: user.profile?.userName || '', profileImageUrl: user.profile?.profileImageUrl || '' },
    stats: Object.fromEntries(['level', 'totalExperience', 'currentExp', 'currentLevelRequiredXp', 'postCount', 'commentCount', 'likeCount', 'streak'].map(key => [key, Number.isFinite(user.stats?.[key]) ? user.stats[key] : 0])),
    gameStats: Object.fromEntries(['reactionGame', 'tileGame', 'flappyBird', 'mathGame', 'typingGame'].map(game => [game, Object.fromEntries(['playCount', 'totalScore', 'bestReactionTime', 'bestMoves'].filter(key => Number.isFinite(user.gameStats?.[game]?.[key])).map(key => [key, user.gameStats[game][key]]))])),
    ...(user.school?.id ? { school: { id: user.school.id, name: user.school.name || '' } } : {}),
    ...(user.regions ? { regions: { sido: user.regions.sido || '', sigungu: user.regions.sigungu || '' } } : {}),
    searchTokens: nameTokens(user.profile?.userName || ''),
    createdAt: user.createdAt, updatedAt: user.updatedAt,
  };
}
export function nameTokens(value: string) {
  const text = value.toLowerCase();
  const tokens = new Set<string>([text]);
  for (let i = 0; i < text.length; i++) for (let j = i + 1; j <= Math.min(text.length, i + 8); j++) tokens.add(text.slice(i, j));
  return [...tokens];
}
export function nameKey(value: string) { return Buffer.from(value.normalize('NFKC').toLowerCase()).toString('base64url'); }
export function relationshipKey(userId: string, targetId: string, type: string) {
  return Buffer.from(JSON.stringify([userId, targetId, type])).toString('base64url');
}
