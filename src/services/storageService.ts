import { ALL_LEVELS } from '../data/curriculum';
import { ALL_RHYTHM_LEVELS } from '../data/rhythmCurriculum';
import { ALL_INTERVAL_LEVELS } from '../data/intervalCurriculum';

export interface LevelProgressRecord {
  stars: number; // 0 to 3
  bestAccuracy: number; // 0 to 100
  bestNpm: number; // Notes per minute
  bestScore: number;
  attempts: number;
}

export interface NoteHistoricalStat {
  noteId: string;
  seen: number;
  correct: number;
  mistakes: number;
  totalReactionMs: number;
}

export interface UserProgressState {
  unlockedLevels: string[];
  levelRecords: Record<string, LevelProgressRecord>;
  unlockedRhythmLevels: string[];
  rhythmRecords: Record<string, LevelProgressRecord>;
  unlockedIntervalLevels: string[];
  intervalRecords: Record<string, LevelProgressRecord>;
  noteStats: Record<string, NoteHistoricalStat>;
  streakDays: number;
  lastPracticeDate: string | null;
  totalNotesAnswered: number;
  totalCorrectNotes: number;
  totalReactionMs: number;
  totalRhythmNotesEvaluated: number;
  totalRhythmPerfectOrGood: number;
  unlockAllSandbox: boolean;
}

const STORAGE_KEY = 'conservatory_sight_reading_v1';

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function getYesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export const defaultProgressState: UserProgressState = {
  unlockedLevels: ['1.1'],
  levelRecords: {},
  unlockedRhythmLevels: ['R1.1'],
  rhythmRecords: {},
  unlockedIntervalLevels: ['I1.1'],
  intervalRecords: {},
  noteStats: {},
  streakDays: 1,
  lastPracticeDate: getTodayIso(),
  totalNotesAnswered: 0,
  totalCorrectNotes: 0,
  totalReactionMs: 0,
  totalRhythmNotesEvaluated: 0,
  totalRhythmPerfectOrGood: 0,
  unlockAllSandbox: false,
};

export function loadUserProgress(): UserProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultProgressState };
    const parsed = JSON.parse(raw) as Partial<UserProgressState>;
    return {
      ...defaultProgressState,
      ...parsed,
      unlockedLevels:
        Array.isArray(parsed.unlockedLevels) && parsed.unlockedLevels.length > 0
          ? parsed.unlockedLevels
          : ['1.1'],
      unlockedRhythmLevels:
        Array.isArray(parsed.unlockedRhythmLevels) && parsed.unlockedRhythmLevels.length > 0
          ? parsed.unlockedRhythmLevels
          : ['R1.1'],
      unlockedIntervalLevels:
        Array.isArray(parsed.unlockedIntervalLevels) && parsed.unlockedIntervalLevels.length > 0
          ? parsed.unlockedIntervalLevels
          : ['I1.1'],
      levelRecords: parsed.levelRecords || {},
      rhythmRecords: parsed.rhythmRecords || {},
      intervalRecords: parsed.intervalRecords || {},
      noteStats: parsed.noteStats || {},
    };
  } catch {
    return { ...defaultProgressState };
  }
}

export function saveUserProgress(state: UserProgressState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function recordNoteAttempt(
  state: UserProgressState,
  noteId: string,
  isCorrectFirstTry: boolean,
  reactionMs: number
): UserProgressState {
  const clampedMs = Math.min(Math.max(reactionMs, 150), 12000);
  const existing = state.noteStats[noteId] || {
    noteId,
    seen: 0,
    correct: 0,
    mistakes: 0,
    totalReactionMs: 0,
  };

  const updatedStat: NoteHistoricalStat = {
    noteId,
    seen: existing.seen + 1,
    correct: existing.correct + (isCorrectFirstTry ? 1 : 0),
    mistakes: existing.mistakes + (isCorrectFirstTry ? 0 : 1),
    totalReactionMs: existing.totalReactionMs + clampedMs,
  };

  const today = getTodayIso();
  const yesterday = getYesterdayIso();
  let newStreak = state.streakDays;
  if (state.lastPracticeDate !== today) {
    newStreak = state.lastPracticeDate === yesterday ? state.streakDays + 1 : 1;
  }

  const nextState: UserProgressState = {
    ...state,
    streakDays: newStreak,
    lastPracticeDate: today,
    totalNotesAnswered: state.totalNotesAnswered + 1,
    totalCorrectNotes: state.totalCorrectNotes + (isCorrectFirstTry ? 1 : 0),
    totalReactionMs: state.totalReactionMs + clampedMs,
    noteStats: {
      ...state.noteStats,
      [noteId]: updatedStat,
    },
  };

  saveUserProgress(nextState);
  return nextState;
}

export function recordLevelCompletion(
  state: UserProgressState,
  levelId: string,
  accuracy: number,
  npm: number,
  score: number,
  targetSpeedMs: number,
  avgReactionMs: number
): { nextState: UserProgressState; earnedStars: number; newlyUnlockedLevelId: string | null } {
  let earnedStars = 0;
  if (accuracy >= 80) {
    earnedStars = 1;
    if (accuracy >= 90) earnedStars = 2;
    if (accuracy >= 95 && avgReactionMs <= targetSpeedMs * 1.25) earnedStars = 3;
  }

  const prevRec = state.levelRecords[levelId] || {
    stars: 0,
    bestAccuracy: 0,
    bestNpm: 0,
    bestScore: 0,
    attempts: 0,
  };

  const updatedRec: LevelProgressRecord = {
    stars: Math.max(prevRec.stars, earnedStars),
    bestAccuracy: Math.max(prevRec.bestAccuracy, Math.round(accuracy)),
    bestNpm: Math.max(prevRec.bestNpm, Math.round(npm)),
    bestScore: Math.max(prevRec.bestScore, score),
    attempts: prevRec.attempts + 1,
  };

  const unlockedSet = new Set(state.unlockedLevels);
  let newlyUnlockedLevelId: string | null = null;

  if (accuracy >= 80) {
    const idx = ALL_LEVELS.findIndex((l) => l.id === levelId);
    if (idx >= 0 && idx + 1 < ALL_LEVELS.length) {
      const nextLvl = ALL_LEVELS[idx + 1].id;
      if (!unlockedSet.has(nextLvl)) {
        unlockedSet.add(nextLvl);
        newlyUnlockedLevelId = nextLvl;
      }
    }
  }

  const nextState: UserProgressState = {
    ...state,
    unlockedLevels: Array.from(unlockedSet),
    levelRecords: {
      ...state.levelRecords,
      [levelId]: updatedRec,
    },
  };

  saveUserProgress(nextState);
  return { nextState, earnedStars, newlyUnlockedLevelId };
}

export function recordRhythmCompletion(
  state: UserProgressState,
  rhythmLevelId: string,
  accuracy: number,
  bpm: number,
  score: number,
  evaluatedCount: number,
  goodOrPerfectCount: number
): { nextState: UserProgressState; earnedStars: number; newlyUnlockedRhythmId: string | null } {
  let earnedStars = 0;
  if (accuracy >= 80) {
    earnedStars = 1;
    if (accuracy >= 90) earnedStars = 2;
    if (accuracy >= 95) earnedStars = 3;
  }

  const prevRec = state.rhythmRecords[rhythmLevelId] || {
    stars: 0,
    bestAccuracy: 0,
    bestNpm: 0,
    bestScore: 0,
    attempts: 0,
  };

  const updatedRec: LevelProgressRecord = {
    stars: Math.max(prevRec.stars, earnedStars),
    bestAccuracy: Math.max(prevRec.bestAccuracy, Math.round(accuracy)),
    bestNpm: Math.max(prevRec.bestNpm, bpm),
    bestScore: Math.max(prevRec.bestScore, score),
    attempts: prevRec.attempts + 1,
  };

  const unlockedSet = new Set(state.unlockedRhythmLevels);
  let newlyUnlockedRhythmId: string | null = null;

  if (accuracy >= 80) {
    const idx = ALL_RHYTHM_LEVELS.findIndex((l) => l.id === rhythmLevelId);
    if (idx >= 0 && idx + 1 < ALL_RHYTHM_LEVELS.length) {
      const nextId = ALL_RHYTHM_LEVELS[idx + 1].id;
      if (!unlockedSet.has(nextId)) {
        unlockedSet.add(nextId);
        newlyUnlockedRhythmId = nextId;
      }
    }
  }

  const nextState: UserProgressState = {
    ...state,
    unlockedRhythmLevels: Array.from(unlockedSet),
    rhythmRecords: {
      ...state.rhythmRecords,
      [rhythmLevelId]: updatedRec,
    },
    totalRhythmNotesEvaluated: state.totalRhythmNotesEvaluated + evaluatedCount,
    totalRhythmPerfectOrGood: state.totalRhythmPerfectOrGood + goodOrPerfectCount,
  };

  saveUserProgress(nextState);
  return { nextState, earnedStars, newlyUnlockedRhythmId };
}

export function recordIntervalCompletion(
  state: UserProgressState,
  intervalLevelId: string,
  accuracy: number,
  score: number
): { nextState: UserProgressState; earnedStars: number; newlyUnlockedIntervalId: string | null } {
  let earnedStars = 0;
  if (accuracy >= 80) {
    earnedStars = 1;
    if (accuracy >= 90) earnedStars = 2;
    if (accuracy >= 95) earnedStars = 3;
  }

  const prevRec = state.intervalRecords[intervalLevelId] || {
    stars: 0,
    bestAccuracy: 0,
    bestNpm: 0,
    bestScore: 0,
    attempts: 0,
  };

  const updatedRec: LevelProgressRecord = {
    stars: Math.max(prevRec.stars, earnedStars),
    bestAccuracy: Math.max(prevRec.bestAccuracy, Math.round(accuracy)),
    bestNpm: prevRec.bestNpm,
    bestScore: Math.max(prevRec.bestScore, score),
    attempts: prevRec.attempts + 1,
  };

  const unlockedSet = new Set(state.unlockedIntervalLevels);
  let newlyUnlockedIntervalId: string | null = null;

  if (accuracy >= 80) {
    const idx = ALL_INTERVAL_LEVELS.findIndex((l) => l.id === intervalLevelId);
    if (idx >= 0 && idx + 1 < ALL_INTERVAL_LEVELS.length) {
      const nextId = ALL_INTERVAL_LEVELS[idx + 1].id;
      if (!unlockedSet.has(nextId)) {
        unlockedSet.add(nextId);
        newlyUnlockedIntervalId = nextId;
      }
    }
  }

  const nextState: UserProgressState = {
    ...state,
    unlockedIntervalLevels: Array.from(unlockedSet),
    intervalRecords: {
      ...state.intervalRecords,
      [intervalLevelId]: updatedRec,
    },
  };

  saveUserProgress(nextState);
  return { nextState, earnedStars, newlyUnlockedIntervalId };
}
