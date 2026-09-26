import { FieldValue, Firestore, Transaction } from 'firebase-admin/firestore';
import { tutorialChain } from '../quests/chains/tutorial';
import { newbieGrowthChain } from '../quests/chains/newbie-growth';
import { ApiError } from './auth';
const chains = [tutorialChain, newbieGrowthChain];
type Data = Record<string, any>;
const now = () => FieldValue.serverTimestamp();

export async function advanceQuest(tx: Transaction, db: Firestore, uid: string, user: Data, initializeOnly: boolean, actionType?: string, metadata?: Data) {
  const ref = db.doc(`quests/${uid}`);
  const snapshot = await tx.get(ref);
  const state: Data = snapshot.data() || {
    userId: uid, chains: { tutorial: { currentStep: 1, status: 'in_progress', startedAt: now(), stepProgress: { tutorial_1: { status: 'in_progress', progress: 0, target: 1 } } } },
    completedChains: [], earnedRewards: { badges: [], titles: [], frames: [], effects: [] }, activeRewards: {},
    stats: { totalQuestsCompleted: 0, totalChainsCompleted: 0, totalXpEarned: 0 }, createdAt: now(), updatedAt: now(),
  };
  if (initializeOnly) { if (!snapshot.exists) tx.create(ref, state); return { state }; }
  const chain = chains.find(chain => state.chains[chain.id]?.status === 'in_progress');
  if (!chain) return { result: null };
  const progress = state.chains[chain.id];
  const step = chain.steps.find(step => step.step === progress.currentStep);
  if (!step) throw new ApiError(409, '퀘스트 상태를 확인해주세요.');
  const metric = step.objective.type;
  let current = 0;
  if (metric === 'nickname_change' || metric === 'profile_complete') current = user.profile?.userName && !user.profile.userName.startsWith('user_') ? 1 : 0;
  if (metric === 'favorite_school' || metric === 'school_register') current = user.favorites?.schools?.length || 0;
  if (metric === 'create_post') current = user.stats?.postCount || 0;
  if (metric === 'create_comment') current = user.stats?.commentCount || 0;
  if (metric === 'give_like') current = user.stats?.likeCount || 0;
  if (metric === 'play_game') current = Object.values(user.gameStats || {}).reduce((sum: number, value: any) => sum + (value.playCount || 0), 0);
  if (metric === 'consecutive_attendance' || metric === 'attendance') current = user.stats?.streak || 0;
  if (metric === 'tile_game_moves') current = user.gameStats?.tileGame?.bestMoves > 0 && user.gameStats.tileGame.bestMoves <= 10 ? 1 : 0;
  if (metric === 'get_likes') {
    const posts = await tx.get(db.collection('posts').where('authorId', '==', uid));
    current = posts.docs.reduce((sum, doc) => sum + (doc.data().stats?.likeCount || 0), 0);
  }
  if (['visit_board', 'visit_other_board', 'visit_category', 'custom'].includes(metric) && ['visit_board', 'visit_other_board', 'visit_category'].includes(actionType || '')) {
    if (typeof metadata?.boardId === 'string' && !metadata.boardId.includes('/')) {
      const board = await tx.get(db.doc(`boards/${metadata.boardId}`));
      const byCode = board.exists ? null : await tx.get(db.collection('boards').where('code', '==', metadata.boardId).limit(1));
      if (board.exists || !byCode?.empty) current = 1;
    }
  }
  current = Math.min(current, step.objective.target);
  progress.stepProgress[step.id] = { status: current >= step.objective.target ? 'completed' : 'in_progress', progress: current, target: step.objective.target };
  const completed = current >= step.objective.target;
  let xp = 0;
  if (completed) {
    progress.stepProgress[step.id].completedAt = now();
    state.stats.totalQuestsCompleted += 1;
    xp = step.rewards.xp;
    const next = chain.steps.find(value => value.step === step.step + 1);
    if (next) {
      progress.currentStep = next.step;
      progress.stepProgress[next.id] = { status: 'in_progress', progress: 0, target: next.objective.target };
    } else {
      progress.status = 'completed'; progress.completedAt = now();
      state.completedChains.push(chain.id); state.stats.totalChainsCompleted += 1;
      xp += chain.completionRewards.xp;
      for (const [key, plural] of [['badge', 'badges'], ['title', 'titles'], ['frame', 'frames'], ['effect', 'effects']]) {
        const value = (chain.completionRewards as Data)[key];
        if (value && !state.earnedRewards[plural].includes(value)) state.earnedRewards[plural].push(value);
      }
      const nextChain = chains[chains.indexOf(chain) + 1];
      if (nextChain) state.chains[nextChain.id] = { currentStep: 1, status: 'in_progress', startedAt: now(), stepProgress: { [nextChain.steps[0].id]: { status: 'in_progress', progress: 0, target: nextChain.steps[0].objective.target } } };
    }
    state.stats.totalXpEarned += xp;
  }
  state.updatedAt = now();
  tx.set(ref, state);
  return { state, xp, eventId: step.id, result: { completed, step, newProgress: current, target: step.objective.target, ...(completed ? { rewards: { ...step.rewards, xp } } : {}) } };
}
