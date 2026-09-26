import { advanceQuest } from './quests';
import { FieldValue, Firestore, Transaction } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { ApiError } from './auth';
import { bootstrapInput, profileInput, postInput, postEdit, commentInput, id, publicProfile, nameKey, relationshipKey } from './schema';

type Data = Record<string, any>;
const now = () => FieldValue.serverTimestamp();
const clean = (value: string) => sanitizeHtml(value, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'width', 'height'] }, allowedSchemes: ['https', 'http'] });
const initialStats = () => ({ level: 1, totalExperience: 0, currentExp: 0, currentLevelRequiredXp: 10, postCount: 0, commentCount: 0, likeCount: 0, streak: 0 });
function available(data: Data | undefined) {
  if (!data || data.status?.isDeleted || data.status?.isHidden || data.status?.isBlocked) throw new ApiError(404, '콘텐츠를 찾을 수 없습니다.');
  return data;
}
function authorInfo(user: Data, anonymous: boolean) {
  return { displayName: anonymous ? '익명' : user.profile.userName, profileImageUrl: anonymous ? '' : user.profile.profileImageUrl || '', isAnonymous: anonymous };
}
function owned(data: Data, uid: string, admin: boolean) {
  if (data.authorId !== uid && !admin) throw new ApiError(403, '작성자만 변경할 수 있습니다.');
}
function bumpUser(tx: Transaction, db: Firestore, uid: string, key: string, value: number) {
  tx.update(db.doc(`users/${uid}`), { [`stats.${key}`]: FieldValue.increment(value), updatedAt: now() });
  tx.set(db.doc(`publicProfiles/${uid}`), { stats: { [key]: FieldValue.increment(value) }, updatedAt: now() }, { merge: true });
}

export async function executeCommunity(db: Firestore, token: DecodedIdToken, action: string, raw: Data) {
  const uid = token.uid;
  const userRef = db.doc(`users/${uid}`);
  if (action === 'bootstrap') {
    const input = bootstrapInput.parse(raw);
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(userRef);
      if (snapshot.exists) {
        const user = snapshot.data()!;
        if (user.status && user.status !== 'active') throw new ApiError(403, '이용이 제한된 계정입니다.');
        const profile = { userName: `user_${Buffer.from(uid).toString('hex').slice(0, 18)}`, realName: '', profileImageUrl: '', ...user.profile, ...input.profile, isAdmin: token.admin === true };
        const nameRef = db.doc(`usernames/${nameKey(profile.userName)}`);
        const reserved = await tx.get(nameRef);
        if (reserved.exists && reserved.data()!.uid !== uid) throw new ApiError(409, '이미 사용 중인 닉네임입니다.');
        const oldRef = user.profile?.userName ? db.doc(`usernames/${nameKey(user.profile.userName)}`) : null;
        const old = oldRef ? await tx.get(oldRef) : null;
        const referral = await resolveReferral(tx, db, uid, input.referral, user);
        let school = user.school;
        if (input.school) {
          const schoolDoc = await tx.get(db.doc(`schools/${input.school.id}`));
          if (!schoolDoc.exists) throw new ApiError(400, '학교 정보를 다시 선택해주세요.');
          school = { ...input.school, name: schoolDoc.data()!.name || '' };
        }
        const merged = { ...user, uid, email: token.email || user.email || '', role: token.admin === true ? 'admin' : 'student', status: user.status || 'active', profile,
          stats: { ...initialStats(), ...user.stats }, agreements: input.agreements || user.agreements || { terms: false, privacy: false, location: false, marketing: false },
          ...(school ? { school } : {}), ...(input.regions ? { regions: input.regions } : {}), ...(input.favorites ? { favorites: input.favorites } : {}),
          ...(referral ? { referral } : {}), createdAt: user.createdAt || now(), updatedAt: now(), lastLoginAt: now(), schemaVersion: 2 };
        if (oldRef && old?.data()?.uid === uid && oldRef.path !== nameRef.path) tx.delete(oldRef);
        tx.set(nameRef, { uid, createdAt: reserved.data()?.createdAt || now() });
        tx.set(userRef, merged);
        tx.set(db.doc(`publicProfiles/${uid}`), publicProfile(merged));
        return { uid };
      }
      const nickname = input.profile?.userName || `user_${Buffer.from(uid).toString('hex').slice(0, 18)}`;
      const nameRef = db.doc(`usernames/${nameKey(nickname)}`);
      const reserved = await tx.get(nameRef);
      if (reserved.exists && reserved.data()!.uid !== uid) throw new ApiError(409, '이미 사용 중인 닉네임입니다.');
      const referral = await resolveReferral(tx, db, uid, input.referral);
      let school: Data | undefined;
      if (input.school) {
        const schoolDoc = await tx.get(db.doc(`schools/${input.school.id}`));
        if (!schoolDoc.exists) throw new ApiError(400, '학교 정보를 다시 선택해주세요.');
        school = { ...input.school, name: schoolDoc.data()!.name || input.school.name || '' };
      }
      const user: Data = {
        uid, email: token.email || '', role: token.admin === true ? 'admin' : 'student', status: 'active',
        isVerified: token.email_verified === true, fake: false, schemaVersion: 2,
        profile: { userName: nickname, realName: '', profileImageUrl: '', ...input.profile, isAdmin: token.admin === true, createdAt: now() },
        stats: initialStats(), agreements: input.agreements || { terms: false, privacy: false, location: false, marketing: false },
        favorites: input.favorites || { schools: school ? [school.id] : [], boards: [] },
        ...(school ? { school } : {}), ...(input.regions ? { regions: input.regions } : {}),
        ...(referral ? { referral } : {}), createdAt: now(), updatedAt: now(), lastLoginAt: now(),
      };
      tx.create(userRef, user);
      tx.set(nameRef, { uid, createdAt: now() });
      tx.set(db.doc(`publicProfiles/${uid}`), publicProfile(user));
      return { uid };
    });
  }

  // Every mutation reads account state in the same transaction as its writes.
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(userRef);
    const user = snapshot.data();
    if (!user) throw new ApiError(409, '프로필을 먼저 설정해주세요.');
    if (user.status !== 'active' && user.status !== undefined) throw new ApiError(403, '이용이 제한된 계정입니다.');
    const admin = token.admin === true;
    const settings = (await tx.get(db.doc('system/experienceSettings'))).data() || {};
    const bounded = (value: unknown, fallback: number, maximum = 100) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : fallback;
    user._rewardPolicy = {
      post: bounded(settings.community?.dailyPostLimit, 3), comment: bounded(settings.community?.dailyCommentLimit, 5),
      attendance: 1, game: 50, quest: 100, referral: 10,
    };


    if (action === 'quest.initialize' || action === 'quest.track') {
      const result = await advanceQuest(tx, db, uid, user, action === 'quest.initialize', typeof raw.actionType === 'string' ? raw.actionType : undefined, raw.metadata);
      if (result.xp) reward(tx, db, uid, user, 'quest', result.eventId!, result.xp);
      return action === 'quest.initialize' ? { success: true } : result.result;
    }
    if (action === 'game.start' || action === 'game.finish') {
      const gameType = z.enum(['reactionGame', 'tileGame', 'flappyBird', 'mathGame', 'typingGame']).parse(raw.gameType);
      const today = koreaDate();
      const daily = user.gameDaily?.date === today ? user.gameDaily : { date: today };
      const count = daily[gameType] || 0;
      const ref = userRef.collection('gameSessions').doc(gameType);
      const session = (await tx.get(ref)).data();
      if (action === 'game.start') {
        const gameLimit = bounded(settings.games?.[gameType]?.dailyLimit, 5);
      if (count >= gameLimit) return { success: false, remainingAttempts: 0, message: '오늘의 플레이 횟수를 모두 사용했습니다.' };
        tx.set(ref, { startedAt: Date.now(), finished: false });
        tx.update(userRef, { gameDaily: { ...daily, [gameType]: count + 1 }, [`activityLimits.dailyCounts.games.${gameType}`]: count + 1, 'activityLimits.lastResetDate': today });
        return { success: true, remainingAttempts: gameLimit - count - 1 };
      }
      if (!session || session.finished || Date.now() - session.startedAt > 3600000) throw new ApiError(409, '유효한 게임 세션이 없습니다. 다시 시작해주세요.');
      const score = z.number().finite().min(0).max(100000).parse(raw.score);
      const reactionTime = raw.reactionTime === undefined ? undefined : z.number().finite().min(80).max(60000).parse(raw.reactionTime);
      const previous = user.gameStats?.[gameType] || {};
      const stats = { ...previous, playCount: (previous.playCount || 0) + 1, totalScore: (previous.totalScore || 0) + score };
      if (gameType === 'reactionGame' && reactionTime) stats.bestReactionTime = Math.min(previous.bestReactionTime || Infinity, reactionTime);
      else if (gameType === 'tileGame' && score > 0) stats.bestMoves = Math.min(previous.bestMoves || Infinity, score);
      else stats.bestReactionTime = Math.max(previous.bestReactionTime || 0, score);
      tx.update(ref, { finished: true, score, finishedAt: now() });
      tx.update(userRef, { [`gameStats.${gameType}`]: stats });
      tx.set(db.doc(`publicProfiles/${uid}`), { gameStats: { [gameType]: stats } }, { merge: true });
      // Only server-configured, capped thresholds determine rewards; score claims are bounded but are not authoritative anti-cheat evidence.
      const lowerIsBetter = gameType === 'reactionGame' || gameType === 'tileGame';
      const value = gameType === 'reactionGame' ? (reactionTime || score) : score;
      const defaults = gameType === 'reactionGame' ? [100, 200, 300] : gameType === 'tileGame' ? [7, 10, 13] : [30, 20, 10];
      const thresholds = Array.isArray(settings.games?.[gameType]?.thresholds) ? settings.games[gameType].thresholds : defaults.map((minScore, index) => ({ minScore, xpReward: [15, 10, 5][index] }));
      const xp = Math.max(0, ...thresholds.filter((entry: Data) => typeof entry.minScore === 'number' && (lowerIsBetter ? value > 0 && value <= entry.minScore : value >= entry.minScore)).map((entry: Data) => bounded(entry.xpReward, 0, 25)));
      const result = reward(tx, db, uid, user, 'game', `${gameType}_${session.startedAt}`, xp);
      return { success: true, xpEarned: result.expAwarded, leveledUp: result.leveledUp, oldLevel: result.oldLevel, newLevel: result.newLevel };
    }
    if (action === 'school.favorite') {
      const schoolId = id.parse(raw.schoolId);
      const schoolRef = db.doc(`schools/${schoolId}`);
      const school = await tx.get(schoolRef);
      if (!school.exists) throw new ApiError(404, '학교를 찾을 수 없습니다.');
      const favorites: string[] = user.favorites?.schools || [];
      const active = !favorites.includes(schoolId);
      if (active && favorites.length >= 5) throw new ApiError(400, '학교 즐겨찾기는 최대 5개입니다.');
      const updated = active ? [...favorites, schoolId] : favorites.filter(value => value !== schoolId);
      tx.update(userRef, { 'favorites.schools': updated, updatedAt: now() });
      tx.update(schoolRef, { favoriteCount: Math.max(0, (school.data()!.favoriteCount || 0) + (active ? 1 : -1)) });
      return { success: true, isFavorite: active, favoriteCount: updated.length };
    }
    if (action === 'school.set') {
      const schoolId = id.parse(raw.schoolId);
      const school = (await tx.get(db.doc(`schools/${schoolId}`))).data();
      if (!school) throw new ApiError(404, '학교를 찾을 수 없습니다.');
      const details = bootstrapInput.shape.school.unwrap().omit({ id: true, name: true }).parse(raw.schoolInfo || {});
      const updated = { ...user, school: { ...details, id: schoolId, name: school.name || school.schoolName || '' }, updatedAt: now() };
      const favorites: string[] = user.favorites?.schools || [];
      const nextFavorites = favorites.includes(schoolId) ? favorites : [schoolId, ...favorites].slice(0, 5);
      tx.update(userRef, { school: updated.school, 'favorites.schools': nextFavorites, updatedAt: now() });
      tx.set(db.doc(`publicProfiles/${uid}`), publicProfile(updated));
      return { success: true };
    }
    if (action === 'reward.claim') {
      const activity = z.enum(['post', 'comment', 'like', 'attendance', 'attendanceStreak', 'referral', 'game']).parse(raw.activityType);
      const receipts = await tx.get(userRef.collection('rewards').where('activity', '==', activity).where('claimed', '==', false).limit(1));
      const receipt = receipts.docs[0];
      if (!receipt) return { success: false, expAwarded: 0, leveledUp: false, reason: '새로 지급된 경험치가 없습니다.' };
      tx.update(receipt.ref, { claimed: true });
      return receipt.data().result;
    }
    if (action === 'attendance.check') {
      const ref = db.doc(`attendance/${uid}`);
      const previous = (await tx.get(ref)).data() || {};
      const today = koreaDate();
      const yesterday = koreaDate(Date.now() - 86400000);
      const attendances = { ...(previous.attendances || {}) };
      let streak = previous.streak || 0;
      let result: Data = { success: false, expAwarded: 0, leveledUp: false };
      if (raw.doCheck === true && !attendances[today]) {
        streak = attendances[yesterday] ? streak + 1 : 1;
        attendances[today] = true;
        result = reward(tx, db, uid, user, 'attendance', today, bounded(settings.attendance?.dailyXP, 10) + (streak % 7 === 0 ? bounded(settings.attendance?.weeklyBonusXP, 50) : 0));
        tx.set(ref, { userId: uid, attendances, monthlyLog: attendances, streak, lastAttendance: now() });
        tx.update(userRef, { 'stats.streak': streak });
        tx.set(db.doc(`publicProfiles/${uid}`), { stats: { streak } }, { merge: true });
      }
      const monthlyLog = Object.fromEntries(Object.entries(attendances).filter(([date]) => date.startsWith(today.slice(0, 7))));
      return { checkedToday: attendances[today] === true, streak, totalCount: Object.keys(attendances).length, monthCount: Object.keys(monthlyLog).length, monthlyLog, attendances, expGained: result.expAwarded, leveledUp: result.leveledUp, oldLevel: result.oldLevel, newLevel: result.newLevel };
    }
    if (action === 'profile.update') {
      const input = profileInput.parse(raw);
      const profile = { ...user.profile };
      const regions = { ...(user.regions || {}) };
      if (input.userName && input.userName !== profile.userName) {
        const newRef = db.doc(`usernames/${nameKey(input.userName)}`);
        const reserved = await tx.get(newRef);
        if (reserved.exists && reserved.data()!.uid !== uid) throw new ApiError(409, '이미 사용 중인 닉네임입니다.');
        const oldRef = profile.userName ? db.doc(`usernames/${nameKey(profile.userName)}`) : null;
        const old = oldRef ? await tx.get(oldRef) : null;
        if (oldRef && old?.data()?.uid === uid && oldRef.path !== newRef.path) tx.delete(oldRef);
        tx.set(newRef, { uid, createdAt: now() });
      }
      for (const [key, value] of Object.entries(input)) {
        if (['sido', 'sigungu', 'address'].includes(key)) regions[key] = value;
        else profile[key] = value;
      }
      const updated = { ...user, profile, regions, updatedAt: now() };
      tx.update(userRef, { profile, regions, updatedAt: now() });
      tx.set(db.doc(`publicProfiles/${uid}`), publicProfile(updated));
      return { success: true };
    }

    if (action === 'relationship.toggle') {
      const { targetId, type } = z.object({ targetId: id, type: z.enum(['follow', 'block']) }).parse(raw);
      if (targetId === uid) throw new ApiError(400, '자기 자신과 관계를 만들 수 없습니다.');
      const target = await tx.get(db.doc(`users/${targetId}`));
      if (!target.exists) throw new ApiError(404, '존재하지 않는 사용자입니다.');
      const relationRef = db.doc(`userRelationships/${relationshipKey(uid, targetId, type)}`);
      // Read legacy random IDs too so restored data cannot create duplicate edges.
      const matches = await tx.get(db.collection('userRelationships').where('userId', '==', uid).where('targetId', '==', targetId).where('type', '==', type));
      const active = matches.docs.some(doc => doc.data().status === 'active');
      const blockRefs = [db.doc(`userRelationships/${relationshipKey(uid, targetId, 'block')}`), db.doc(`userRelationships/${relationshipKey(targetId, uid, 'block')}`)];
      const blocks = await tx.getAll(...blockRefs);
      const legacyBlocks = await tx.get(db.collection('userRelationships').where('type', '==', 'block').where('userId', 'in', [uid, targetId]));
      if (type === 'follow' && !active && (blocks.some(b => b.data()?.status === 'active') || legacyBlocks.docs.some(b => b.data().status === 'active' && [uid, targetId].includes(b.data().targetId)))) throw new ApiError(403, '차단 관계에서는 팔로우할 수 없습니다.');
      const follows = type === 'block' && !active ? await tx.get(db.collection('userRelationships').where('type', '==', 'follow').where('userId', 'in', [uid, targetId])) : null;
      for (const old of matches.docs) if (old.id !== relationRef.id) tx.delete(old.ref);
      tx.set(relationRef, { id: relationRef.id, userId: uid, targetId, type, status: active ? 'inactive' : 'active', createdAt: matches.docs[0]?.data().createdAt || now(), updatedAt: now() });
      for (const follow of follows?.docs || []) if ([uid, targetId].includes(follow.data().targetId)) tx.update(follow.ref, { status: 'inactive', updatedAt: now() });
      return { isFollowing: !active, isBlocked: !active };
    }

    if (action === 'post.create') {
      const input = postInput.parse(raw);
      const boards = await tx.get(db.collection('boards').where('code', '==', input.boardCode).where('type', '==', input.type).limit(1));
      const board = boards.docs[0];
      if (!board || board.data().isActive === false) throw new ApiError(404, '사용 가능한 게시판이 없습니다.');
      const data = board.data();
      if (((data.accessLevel?.write === 'admin') || (Array.isArray(data.permissions?.write) && !data.permissions.write.includes(user.role))) && !admin) throw new ApiError(403, '게시판 작성 권한이 없습니다.');
      if (input.type === 'school' && (!user.school?.id || (input.schoolId && input.schoolId !== user.school.id))) throw new ApiError(403, '내 학교 게시판에만 작성할 수 있습니다.');
      if (input.type === 'regional' && (!user.regions?.sido || !user.regions?.sigungu || (input.regions && (input.regions.sido !== user.regions.sido || input.regions.sigungu !== user.regions.sigungu)))) throw new ApiError(403, '내 지역 게시판에만 작성할 수 있습니다.');
      const postRef = db.collection('posts').doc();
      const post: Data = {
        title: input.title, content: clean(input.content), tags: input.tags, authorId: uid, isAnonymous: input.isAnonymous, authorInfo: authorInfo(user, input.isAnonymous),
        boardCode: input.boardCode, boardId: board.id, boardName: data.name, type: input.type,
        stats: { viewCount: 0, likeCount: 0, commentCount: 0, scrapCount: 0 }, status: { isDeleted: false, isHidden: false, isBlocked: false, isPinned: false },
        attachments: input.attachments, createdAt: now(), updatedAt: now(),
      };
      if (input.category) post.category = input.category;
      if (input.type === 'school') post.schoolId = user.school.id;
      if (input.type === 'regional') post.regions = { sido: user.regions.sido, sigungu: user.regions.sigungu };
      if (input.poll) post.poll = { ...input.poll, isActive: true, options: input.poll.options.map((option, index) => ({ ...(typeof option === 'string' ? { text: option } : option), index, voteCount: 0 })), ...(input.poll.expiresAt ? { expiresAt: new Date(input.poll.expiresAt).getTime() } : {}) };
      consumeWriteQuota(tx, userRef, user);
      tx.create(postRef, post);
      tx.update(board.ref, { 'stats.postCount': FieldValue.increment(1), updatedAt: now() });
      bumpUser(tx, db, uid, 'postCount', 1);
      reward(tx, db, uid, user, 'post', postRef.id, bounded(settings.community?.postXP, 10));
      return { id: postRef.id };
    }

    const postId = id.parse(raw.postId);
    const postRef = db.doc(`posts/${postId}`);
    const postSnap = await tx.get(postRef);
    const post = available(postSnap.data());

    if (action === 'post.update') {
      owned(post, uid, admin);
      const input = postEdit.parse(raw.data);
      const updates: Data = { updatedAt: now() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) updates.content = clean(input.content);
      if (input.tags !== undefined) updates.tags = input.tags;
      if (input.attachments !== undefined) updates.attachments = input.attachments;
      if (input.isAnonymous !== undefined) {
        const author = post.authorId === uid ? user : (await tx.get(db.doc(`users/${post.authorId}`))).data();
        updates.authorInfo = authorInfo(author || user, input.isAnonymous);
      }
      tx.update(postRef, updates);
      return { id: postId };
    }
    if (action === 'post.delete') {
      owned(post, uid, admin);
      tx.update(postRef, { content: '', title: '삭제된 게시글', attachments: [], 'status.isDeleted': true, updatedAt: now() });
      bumpUser(tx, db, post.authorId, 'postCount', -1);
      if (post.boardId) tx.update(db.doc(`boards/${post.boardId}`), { 'stats.postCount': FieldValue.increment(-1) });
      return { success: true };
    }
    if (action === 'comment.create') {
      const input = commentInput.parse(raw);
      const parent = input.parentId ? available((await tx.get(postRef.collection('comments').doc(input.parentId))).data()) : null;
      if (parent?.parentId) throw new ApiError(400, '대댓글에는 답글을 달 수 없습니다.');
      const commentRef = postRef.collection('comments').doc();
      consumeWriteQuota(tx, userRef, user);
      tx.create(commentRef, { id: commentRef.id, postId, content: clean(input.content), authorId: uid, isAnonymous: input.isAnonymous, parentId: input.parentId || null, stats: { likeCount: 0 }, status: { isDeleted: false, isBlocked: false }, createdAt: now(), updatedAt: now() });
      tx.update(postRef, { 'stats.commentCount': FieldValue.increment(1), updatedAt: now() });
      bumpUser(tx, db, uid, 'commentCount', 1);
      reward(tx, db, uid, user, 'comment', commentRef.id, bounded(settings.community?.commentXP, 5));
      const recipient = parent?.authorId || post.authorId;
      if (recipient && recipient !== uid && recipient !== 'deleted') tx.create(db.collection('notifications').doc(), {
        userId: recipient, type: parent ? 'comment_reply' : 'post_comment', title: parent ? '새 답글' : '새 댓글',
        message: input.isAnonymous ? '익명 사용자가 댓글을 남겼습니다.' : `${user.profile.userName}님이 댓글을 남겼습니다.`, isRead: false,
        data: { postId, commentId: commentRef.id, postType: post.type, boardCode: post.boardCode, postTitle: post.title, ...(post.schoolId ? { schoolId: post.schoolId } : {}), ...(post.regions ? { regions: post.regions } : {}) }, createdAt: now(),
      });
      return { id: commentRef.id };
    }
    if (action === 'comment.update' || action === 'comment.delete') {
      const ref = postRef.collection('comments').doc(id.parse(raw.commentId));
      const comment = available((await tx.get(ref)).data());
      owned(comment, uid, admin);
      if (action === 'comment.update') tx.update(ref, { content: clean(z.string().trim().min(1).max(10000).parse(raw.content)), updatedAt: now() });
      else {
        tx.update(ref, { content: '삭제된 댓글입니다.', 'status.isDeleted': true, updatedAt: now() });
        tx.update(postRef, { 'stats.commentCount': FieldValue.increment(-1) });
        bumpUser(tx, db, comment.authorId, 'commentCount', -1);
      }
      return { hasReplies: true };
    }
    if (action === 'post.like' || action === 'post.scrap' || action === 'comment.like') {
      const isComment = action === 'comment.like';
      const isScrap = action === 'post.scrap';
      const ref = isComment ? postRef.collection('comments').doc(id.parse(raw.commentId)) : postRef;
      const data = isComment ? available((await tx.get(ref)).data()) : post;
      const edge = ref.collection(isScrap ? 'scraps' : 'likes').doc(uid);
      const existing = await tx.get(edge);
      const active = !existing.exists;
      const key = isScrap ? 'scrapCount' : 'likeCount';
      if (active) tx.create(edge, { userId: uid, postId, createdAt: now() }); else tx.delete(edge);
      tx.update(ref, { [`stats.${key}`]: FieldValue.increment(active ? 1 : -1) });
      if (isScrap) tx.update(userRef, { 'scraps.postIds': active ? FieldValue.arrayUnion(postId) : FieldValue.arrayRemove(postId) });
      else bumpUser(tx, db, uid, 'likeCount', active ? 1 : -1);
      return { liked: active, scrapped: active, likeCount: Math.max(0, (data.stats?.likeCount || 0) + (active ? 1 : -1)), scrapCount: Math.max(0, (data.stats?.scrapCount || 0) + (active ? 1 : -1)) };
    }
    if (action === 'poll.vote') {
      const poll = post.poll;
      if (!poll?.isActive || (poll.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now())) throw new ApiError(400, '종료된 투표입니다.');
      const option = z.number().int().min(0).max(poll.options.length - 1).nullable().parse(raw.option);
      const userVotes = { ...(poll.userVotes || {}) };
      const options = poll.options.map((value: Data) => ({ ...value }));
      const previous = userVotes[uid];
      if (previous !== undefined && options[previous]) options[previous].voteCount = Math.max(0, options[previous].voteCount - 1);
      if (option !== null) { options[option].voteCount += 1; userVotes[uid] = option; } else delete userVotes[uid];
      const updated = { ...poll, options, userVotes, voters: Object.keys(userVotes) };
      tx.update(postRef, { poll: updated });
      return { poll: updated };
    }
    if (action === 'post.view') {
      const ref = postRef.collection('views').doc(uid);
      const view = await tx.get(ref);
      if (!view.exists) { tx.create(ref, { createdAt: now() }); tx.update(postRef, { 'stats.viewCount': FieldValue.increment(1) }); }
      return { success: true };
    }
    throw new ApiError(400, '지원하지 않는 작업입니다.');
  });
}

function koreaDate(time = Date.now()) { return new Date(time + 9 * 3600000).toISOString().slice(0, 10); }
async function resolveReferral(tx: Transaction, db: Firestore, uid: string, nickname?: string, user?: Data) {
  if (user?.referral || !nickname) return user?.referral;
  if (user?.createdAt?.toMillis && Date.now() - user.createdAt.toMillis() > 86400000) throw new ApiError(400, '추천인은 가입 후 24시간 이내에만 등록할 수 있습니다.');
  const reservation = await tx.get(db.doc(`usernames/${nameKey(nickname)}`));
  const targetId = reservation.data()?.uid;
  if (!targetId || targetId === uid) throw new ApiError(400, '추천인 정보를 확인해주세요.');
  const target = await tx.get(db.doc(`users/${targetId}`));
  if (!target.exists || target.data()!.status !== 'active') throw new ApiError(400, '이용 가능한 추천인이 아닙니다.');
  // Attribution is immutable; signup alone is not evidence for an XP payout.
  return { referrerId: targetId, status: 'pending', createdAt: now() };
}
function reward(tx: Transaction, db: Firestore, uid: string, user: Data, activity: string, eventId: string, amount: number) {
  const today = koreaDate();
  const daily = user.rewardDaily?.date === today ? user.rewardDaily : { date: today };
  const count = daily[activity] || 0;
  const limits: Data = user._rewardPolicy || { post: 3, comment: 5, attendance: 1, game: 50, quest: 100, referral: 10 };
  const gained = count < (limits[activity] || 0) ? amount : 0;
  const total = (user.stats?.totalExperience || 0) + gained;
  let level = 1;
  let currentExp = total;
  while (level < 100 && currentExp >= level * 10) { currentExp -= level * 10; level++; }
  const result = { success: gained > 0, expAwarded: gained, leveledUp: level > (user.stats?.level || 1), oldLevel: user.stats?.level || 1, newLevel: level };
  tx.update(db.doc(`users/${uid}`), { 'stats.totalExperience': total, 'stats.level': level, 'stats.currentExp': currentExp, 'stats.currentLevelRequiredXp': level * 10, rewardDaily: { ...daily, [activity]: count + 1 } });
  tx.set(db.doc(`publicProfiles/${uid}`), { stats: { totalExperience: total, level, currentExp, currentLevelRequiredXp: level * 10 } }, { merge: true });
  tx.create(db.doc(`users/${uid}/rewards/${activity}_${eventId}`), { activity, claimed: false, result, createdAt: now() });
  return result;
}

function consumeWriteQuota(tx: Transaction, ref: FirebaseFirestore.DocumentReference, user: Data) {
  const minute = Math.floor(Date.now() / 60000);
  const count = user.writeQuota?.minute === minute ? user.writeQuota.count : 0;
  if (count >= 10) throw new ApiError(429, '잠시 후 다시 작성해주세요.');
  tx.update(ref, { writeQuota: { minute, count: count + 1 } });
}
