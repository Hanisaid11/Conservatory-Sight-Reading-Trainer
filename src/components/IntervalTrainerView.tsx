import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ALL_INTERVAL_LEVELS,
  GeneratedIntervalQuestion,
  generateIntervalQuestion,
  INTERVAL_CHAPTERS,
  INTERVAL_META,
  IntervalId,
  IntervalLevel,
} from '../data/intervalCurriculum';
import { StaffRenderer } from './StaffRenderer';
import { ExerciseLessonCard } from './ExerciseLessonCard';
import { audioEngine } from '../services/audioEngine';
import { UserProgressState } from '../services/storageService';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Ear,
  Lock,
  Music2,
  Play,
  RotateCcw,
  Star,
  Volume2,
} from 'lucide-react';

interface IntervalTrainerViewProps {
  progress: UserProgressState;
  lang: 'en' | 'ar';
  initialLevelId?: string | null;
  onCompleteIntervalLevel: (
    levelId: string,
    accuracy: number,
    score: number
  ) => { earnedStars: number; newlyUnlockedIntervalId: string | null };
}

const TOTAL_INTERVAL_QUESTIONS = 15;

export const IntervalTrainerView: React.FC<IntervalTrainerViewProps> = ({
  progress,
  lang,
  initialLevelId,
  onCompleteIntervalLevel,
}) => {
  const [subView, setSubView] = useState<'levels' | 'stage'>(
    initialLevelId ? 'stage' : 'levels'
  );
  const [selectedLevel, setSelectedLevel] = useState<IntervalLevel>(() => {
    if (initialLevelId) {
      return ALL_INTERVAL_LEVELS.find((l) => l.id === initialLevelId) || ALL_INTERVAL_LEVELS[0];
    }
    return ALL_INTERVAL_LEVELS[0];
  });

  const [question, setQuestion] = useState<GeneratedIntervalQuestion>(() =>
    generateIntervalQuestion(ALL_INTERVAL_LEVELS[0])
  );
  const [activeSlot, setActiveSlot] = useState<1 | 2 | 'both' | null>(null);
  const [feedbackState, setFeedbackState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [hadMistakeOnCurrent, setHadMistakeOnCurrent] = useState<boolean>(false);

  // Progress & Score within the 15-question session
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [correctFirstTry, setCorrectFirstTry] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [sessionFinished, setSessionFinished] = useState<boolean>(false);
  const [levelSummary, setLevelSummary] = useState<{
    accuracy: number;
    earnedStars: number;
    newlyUnlockedId: string | null;
    score: number;
  } | null>(null);

  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Play Note 1 -> Note 2 sequentially (or harmonically together)
  const playPairAudio = useCallback(
    (q: GeneratedIntervalQuestion, mode: 'sequential' | 'harmonic' = 'sequential') => {
      clearTimers();
      if (mode === 'harmonic') {
        setActiveSlot('both');
        audioEngine.playPianoNote(q.note1.frequency, 1.0, 0.24);
        audioEngine.playPianoNote(q.note2.frequency, 1.0, 0.24);
        const tEnd = window.setTimeout(() => setActiveSlot(null), 900);
        timersRef.current.push(tEnd);
      } else {
        setActiveSlot(1);
        audioEngine.playPianoNote(q.note1.frequency, 0.65, 0.28);
        const t2 = window.setTimeout(() => {
          setActiveSlot(2);
          audioEngine.playPianoNote(q.note2.frequency, 0.85, 0.28);
        }, 480);
        const tEnd = window.setTimeout(() => {
          setActiveSlot(null);
        }, 1250);
        timersRef.current.push(t2, tEnd);
      }
    },
    [clearTimers]
  );

  // Start a specific Interval Level
  const startIntervalLevel = useCallback(
    (lvl: IntervalLevel) => {
      clearTimers();
      const firstQ = generateIntervalQuestion(lvl);
      setSelectedLevel(lvl);
      setQuestion(firstQ);
      setFeedbackState('idle');
      setHadMistakeOnCurrent(false);
      setCompletedCount(0);
      setCorrectFirstTry(0);
      setStreak(0);
      setScore(0);
      setSessionFinished(false);
      setLevelSummary(null);
      setSubView('stage');
      playPairAudio(firstQ, 'sequential');
    },
    [clearTimers, playPairAudio]
  );

  // Sync if parent passed initialLevelId
  useEffect(() => {
    if (initialLevelId) {
      const found = ALL_INTERVAL_LEVELS.find((l) => l.id === initialLevelId);
      if (found) {
        startIntervalLevel(found);
      }
    }
  }, [initialLevelId, startIntervalLevel]);

  // Handle user clicking an Interval Answer Button
  const handleSelectInterval = useCallback(
    (chosenId: IntervalId) => {
      if (sessionFinished || feedbackState === 'correct') return;

      if (chosenId === question.intervalId) {
        setFeedbackState('correct');
        // Play harmonic confirmation of the two notes together
        audioEngine.playPianoNote(question.note1.frequency, 0.75, 0.22);
        audioEngine.playPianoNote(question.note2.frequency, 0.75, 0.26);
        setActiveSlot('both');

        const firstTry = !hadMistakeOnCurrent;
        const nextCompleted = completedCount + 1;
        const nextCorrect = correctFirstTry + (firstTry ? 1 : 0);
        const nextStreak = firstTry ? streak + 1 : 1;
        const multiplier = Math.min(4, 1 + Math.floor(nextStreak / 4));
        const nextScore = score + (firstTry ? 120 : 35) * multiplier;

        setCompletedCount(nextCompleted);
        setCorrectFirstTry(nextCorrect);
        setStreak(nextStreak);
        setScore(nextScore);

        if (nextCompleted >= TOTAL_INTERVAL_QUESTIONS) {
          const tFinish = window.setTimeout(() => {
            const finalAccuracy = Math.round((nextCorrect / TOTAL_INTERVAL_QUESTIONS) * 100);
            const res = onCompleteIntervalLevel(selectedLevel.id, finalAccuracy, nextScore);
            setLevelSummary({
              accuracy: finalAccuracy,
              earnedStars: res.earnedStars,
              newlyUnlockedId: res.newlyUnlockedIntervalId,
              score: nextScore,
            });
            setSessionFinished(true);
            audioEngine.playLevelCompleteFanfare(finalAccuracy >= 80);
          }, 520);
          timersRef.current.push(tFinish);
        } else {
          const tNext = window.setTimeout(() => {
            const nextQ = generateIntervalQuestion(selectedLevel, question.id);
            setQuestion(nextQ);
            setFeedbackState('idle');
            setHadMistakeOnCurrent(false);
            playPairAudio(nextQ, 'sequential');
          }, 680);
          timersRef.current.push(tNext);
        }
      } else {
        // Wrong answer! Flash red, highlight correct interval button in green, and require user to tap it
        audioEngine.playWrongFeedback();
        setFeedbackState('wrong');
        setHadMistakeOnCurrent(true);
        setStreak(0);
      }
    },
    [
      completedCount,
      correctFirstTry,
      feedbackState,
      hadMistakeOnCurrent,
      onCompleteIntervalLevel,
      playPairAudio,
      question,
      score,
      selectedLevel,
      sessionFinished,
      streak,
    ]
  );

  // Compute Line/Space visual geometry hint for current question
  const isNote1OnLine = Math.abs(question.note1.diatonicStep) % 2 === 0;
  const isNote2OnLine = Math.abs(question.note2.diatonicStep) % 2 === 0;
  const geometryLabelEn = `${isNote1OnLine ? 'Line' : 'Space'} → ${
    isNote2OnLine ? 'Line' : 'Space'
  } (${isNote1OnLine === isNote2OnLine ? 'Odd Interval: 3rd/5th/7th' : 'Even Interval: 2nd/4th/6th/8ve'})`;
  const geometryLabelAr = `${isNote1OnLine ? 'خط' : 'مسافة'} ← ${
    isNote2OnLine ? 'خط' : 'مسافة'
  } (${isNote1OnLine === isNote2OnLine ? 'بعد فردي: ثالثة/خامسة/سابعة' : 'بعد زوجي: ثانية/رابعة/سادسة/أوكتاف'})`;

  const currentAccuracy =
    completedCount > 0 ? Math.round((correctFirstTry / completedCount) * 100) : 100;

  const targetMeta = INTERVAL_META[question.intervalId];

  const intervalArcBadgeText =
    feedbackState === 'idle'
      ? question.direction === 'ascending'
        ? lang === 'ar'
          ? '↑ صاعد (Ascending)'
          : '↑ Ascending Interval'
        : lang === 'ar'
        ? '↓ هابط (Descending)'
        : '↓ Descending Interval'
      : `${targetMeta.shortLabel} · ${question.note1.displayLabel} → ${question.note2.displayLabel}`;

  const [activeIntervalChapterIdx, setActiveIntervalChapterIdx] = useState<number>(0);
  const currentIntervalChapter =
    INTERVAL_CHAPTERS[activeIntervalChapterIdx] || INTERVAL_CHAPTERS[0];

  return (
    <div className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* =================================================================== */}
      {/* SUBVIEW 1: INTERVAL TRAINING CAMPAIGN (ORGANIZED BY CHAPTER TABS)   */}
      {/* =================================================================== */}
      {subView === 'levels' && (
        <div className="space-y-3.5">
          {/* Compact Top Header + Continue CTA */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg font-serif shrink-0">
                𝄞𝄢
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold font-display text-slate-900 truncate">
                  {lang === 'ar' ? 'قسم تدريب المسافات والأبعاد' : 'Interval Training Path'}
                </h1>
                <p className="text-xs text-slate-500 truncate">
                  {lang === 'ar'
                    ? 'حدد المسافة الموسيقية بين نغمتين متتاليتين بصرياً وسمعياً'
                    : 'Identify distance between two sequential notes'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startIntervalLevel(selectedLevel)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {lang === 'ar'
                  ? `ابدأ ${selectedLevel.levelNumber}`
                  : `Start ${selectedLevel.levelNumber}`}
              </span>
            </button>
          </div>

          {/* 2 Chapter Selector Tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-200/75 p-1 rounded-xl">
            {INTERVAL_CHAPTERS.map((chap, idx) => {
              const isSelected = idx === activeIntervalChapterIdx;
              return (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() => setActiveIntervalChapterIdx(idx)}
                  className={`py-2 px-3 rounded-lg text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-emerald-950 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="text-xs font-bold truncate">
                    {lang === 'ar' ? `الفصل ${idx + 1}` : `Chapter ${idx + 1}`}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {lang === 'ar' ? chap.badgeAr : chap.badgeEn}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Chapter Banner */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {lang === 'ar' ? currentIntervalChapter.titleAr : currentIntervalChapter.titleEn}
              </h2>
              <p className="text-xs text-slate-600 truncate">
                {lang === 'ar'
                  ? currentIntervalChapter.subtitleAr
                  : currentIntervalChapter.subtitleEn}
              </p>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
              {currentIntervalChapter.levels.length} {lang === 'ar' ? 'تمارين' : 'Drills'}
            </span>
          </div>

          {/* Compact Level Cards for Current Chapter Only */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {currentIntervalChapter.levels.map((lvl) => {
              const isUnlocked =
                progress.unlockAllSandbox ||
                progress.unlockedIntervalLevels?.includes(lvl.id);
              const rec = progress.intervalRecords?.[lvl.id];
              const stars = rec?.stars || 0;

              return (
                <div
                  key={lvl.id}
                  onClick={() => {
                    if (isUnlocked) startIntervalLevel(lvl);
                  }}
                  className={`group rounded-2xl border p-3.5 transition-all duration-150 flex flex-col justify-between gap-2.5 ${
                    isUnlocked
                      ? 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-2xs cursor-pointer'
                      : 'bg-slate-50/70 border-slate-200/70 opacity-75 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                        {lvl.levelNumber}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {lang === 'ar' ? lvl.titleAr : lvl.titleEn}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                          {lang === 'ar' ? lvl.descriptionAr : lvl.descriptionEn}
                        </p>
                      </div>
                    </div>

                    {isUnlocked ? (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              stars >= s
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {lvl.intervalPool.join(' · ')}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {rec && (
                        <span className="text-[11px] font-mono font-semibold text-emerald-700 tabular-nums">
                          {rec.bestAccuracy}%
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isUnlocked
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <span>
                          {isUnlocked
                            ? lang === 'ar'
                              ? 'ابدأ'
                              : 'Start'
                            : lang === 'ar'
                            ? 'مغلق'
                            : 'Locked'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUBVIEW 2: ACTIVE SEQUENTIAL INTERVAL TRAINING STAGE                */}
      {/* =================================================================== */}
      {subView === 'stage' && (
        <div className="space-y-5">
          {/* Top Session Header & Telemetry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                <button
                  type="button"
                  onClick={() => {
                    clearTimers();
                    setSubView('levels');
                  }}
                  className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                >
                  {lang === 'ar' ? '← جميع مستويات الأبعاد' : '← All Interval Levels'}
                </button>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-bold text-slate-700">
                  {selectedLevel.levelNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{selectedLevel.clef} Clef</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold font-display text-slate-900">
                {lang === 'ar' ? selectedLevel.titleAr : selectedLevel.titleEn}
              </h1>
            </div>

            <div className="grid grid-cols-4 gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  {lang === 'ar' ? 'التقدم' : 'Progress'}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums">
                  {completedCount} / {TOTAL_INTERVAL_QUESTIONS}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  {lang === 'ar' ? 'الدقة' : 'Accuracy'}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-700 tabular-nums">
                  {currentAccuracy}%
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  {lang === 'ar' ? 'التتابع' : 'Streak'}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-indigo-700 tabular-nums">
                  {streak}x
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  {lang === 'ar' ? 'النقاط' : 'Score'}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums">
                  {score.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-200"
              style={{
                width: `${Math.min(100, (completedCount / TOTAL_INTERVAL_QUESTIONS) * 100)}%`,
              }}
            />
          </div>

          {/* Step-by-Step Interval Exercise Explanation */}
          <ExerciseLessonCard
            lang={lang}
            levelNumber={selectedLevel.levelNumber}
            titleEn={selectedLevel.titleEn}
            titleAr={selectedLevel.titleAr}
            descriptionEn={selectedLevel.descriptionEn}
            descriptionAr={selectedLevel.descriptionAr}
            mnemonicEn={selectedLevel.tipEn}
            mnemonicAr={selectedLevel.tipAr}
            accentColor="emerald"
            stepsEn={[
              'Odd Intervals (3rd, 5th, 7th) ALWAYS connect Line-to-Line or Space-to-Space.',
              'Even Intervals (2nd, 4th, 6th, Octave) ALWAYS connect Line-to-Space or Space-to-Line.',
              `Intervals in this drill: ${selectedLevel.intervalPool
                .map((id) => `${INTERVAL_META[id].shortLabel} (${INTERVAL_META[id].nameEn})`)
                .join(' · ')}.`,
            ]}
            stepsAr={[
              'الأبعاد الفردية (الثالثة 3rd، الخامسة 5th، السابعة 7th) تنتقل دائماً من خط إلى خط أو من مسافة إلى مسافة.',
              'الأبعاد الزوجية (الثانية 2nd، الرابعة 4th، السادسة 6th، الأوكتاف 8ve) تنتقل دائماً من خط إلى مسافة أو من مسافة إلى خط.',
              `الأبعاد المشمولة في هذا التمرين: ${selectedLevel.intervalPool
                .map((id) => `${INTERVAL_META[id].nameAr} (${INTERVAL_META[id].shortLabel})`)
                .join(' · ')}.`,
            ]}
          />

          {!sessionFinished ? (
            <>
              {/* SVG Staff Rendering Both Sequential Notes + Melodic Arc */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
                {/* Wrong Answer Educational Callout */}
                {feedbackState === 'wrong' && (
                  <div
                    role="status"
                    className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-950 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <strong className="font-bold">
                        {lang === 'ar' ? 'الإجابة الصحيحة:' : 'Correct Interval:'}{' '}
                        {lang === 'ar' ? targetMeta.nameAr : targetMeta.nameEn}
                      </strong>{' '}
                      — {question.note1.displayLabel} ({question.note1.solfegeLabel}) →{' '}
                      {question.note2.displayLabel} ({question.note2.solfegeLabel}) ·{' '}
                      {lang === 'ar' ? targetMeta.visualRuleAr : targetMeta.visualRuleEn}
                    </div>
                    <span className="font-semibold text-red-700">
                      {lang === 'ar'
                        ? `اضغط على زر (${targetMeta.shortLabel}) الأخضر للمتابعة`
                        : `Click the green (${targetMeta.shortLabel}) button below to continue`}
                    </span>
                  </div>
                )}

                <StaffRenderer
                  clef={selectedLevel.clef}
                  feedbackState={feedbackState}
                  intervalPair={{
                    note1: question.note1,
                    note2: question.note2,
                    activeSlot,
                    revealNames: feedbackState !== 'idle',
                    intervalBadgeText: intervalArcBadgeText,
                  }}
                />

                {/* Bottom Controls inside Staff Card: Visual Geometry Helper & Audio Replay Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    {question.direction === 'ascending' ? (
                      <ArrowUpRight className="w-4 h-4 text-indigo-600 shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="font-medium">
                      {lang === 'ar' ? geometryLabelAr : geometryLabelEn}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => playPairAudio(question, 'sequential')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-semibold transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        {lang === 'ar'
                          ? 'إعادة العزف المتتالي (Note 1 → 2)'
                          : 'Replay Sequential (1 → 2)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => playPairAudio(question, 'harmonic')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
                    >
                      <Ear className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {lang === 'ar' ? 'عزف هارموني معاً' : 'Play Harmonic (Together)'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Interval Answer Buttons Deck */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    {lang === 'ar'
                      ? 'اختر البعد الموسيقي الصحيح بين النغمتين:'
                      : 'Select the Interval Distance Between Note 1 and Note 2:'}
                  </span>
                  <span className="text-xs text-indigo-600 font-medium">
                    {lang === 'ar' ? selectedLevel.tipAr : selectedLevel.tipEn}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {selectedLevel.intervalPool.map((intId) => {
                    const meta = INTERVAL_META[intId];
                    const isTargetOnWrong =
                      feedbackState === 'wrong' && question.intervalId === intId;

                    return (
                      <button
                        key={intId}
                        type="button"
                        onClick={() => handleSelectInterval(intId)}
                        className={`flex flex-col items-start justify-between p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer active:scale-95 ${
                          isTargetOnWrong
                            ? 'bg-emerald-600 border-emerald-700 text-white ring-4 ring-emerald-200 shadow-sm'
                            : 'bg-slate-50/80 hover:bg-indigo-50/70 border-slate-200 hover:border-indigo-300 text-slate-900'
                        }`}
                      >
                        <div className="w-full flex items-baseline justify-between gap-2">
                          <span
                            className={`text-lg font-bold font-mono ${
                              isTargetOnWrong ? 'text-white' : 'text-indigo-700'
                            }`}
                          >
                            {meta.shortLabel}
                          </span>
                          <span
                            className={`text-[11px] font-mono ${
                              isTargetOnWrong ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            {selectedLevel.mode === 'specific_quality'
                              ? `${meta.semitones} semitones`
                              : `${meta.diatonicSteps + 1} letters`}
                          </span>
                        </div>

                        <div
                          className={`text-xs sm:text-sm font-bold mt-1 ${
                            isTargetOnWrong ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {lang === 'ar' ? meta.nameAr : meta.nameEn}
                        </div>

                        <div
                          className={`text-[11px] mt-1 line-clamp-1 ${
                            isTargetOnWrong ? 'text-emerald-100' : 'text-slate-500'
                          }`}
                        >
                          {lang === 'ar' ? meta.songHintAr : meta.songHintEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* INTERVAL LEVEL COMPLETE SUMMARY CARD */
            levelSummary && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto text-center space-y-6 shadow-xs">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={`w-10 h-10 ${
                        levelSummary.earnedStars >= s
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-indigo-600">
                    {levelSummary.accuracy >= 80
                      ? lang === 'ar'
                        ? 'أحسنت! اجتزت مستوى الأبعاد بنجاح (≥80%)'
                        : 'Interval Stage Mastered (≥80% Accuracy)'
                      : lang === 'ar'
                      ? 'حاول مرة أخرى للوصول إلى دقة 80%'
                      : 'Keep Practicing to Reach 80% Accuracy'}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-900">
                    {lang === 'ar' ? selectedLevel.titleAr : selectedLevel.titleEn}
                  </h2>
                  {levelSummary.newlyUnlockedId && (
                    <p className="text-sm font-semibold text-emerald-700">
                      ✓ {lang === 'ar' ? 'تم فتح المستوى' : 'Unlocked Level'}{' '}
                      {levelSummary.newlyUnlockedId}!
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500">
                      {lang === 'ar' ? 'دقة الأبعاد' : 'Interval Accuracy'}
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      {levelSummary.accuracy}%
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500">
                      {lang === 'ar' ? 'النقاط' : 'Score'}
                    </div>
                    <div className="text-xl font-bold font-mono text-indigo-700 tabular-nums">
                      {levelSummary.score.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => startIntervalLevel(selectedLevel)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'إعادة التمرين' : 'Replay Level'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const idx = ALL_INTERVAL_LEVELS.findIndex(
                        (l) => l.id === selectedLevel.id
                      );
                      const nextLvl =
                        idx >= 0 && idx + 1 < ALL_INTERVAL_LEVELS.length
                          ? ALL_INTERVAL_LEVELS[idx + 1]
                          : ALL_INTERVAL_LEVELS[0];
                      startIntervalLevel(nextLvl);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer shadow-xs"
                  >
                    <span>{lang === 'ar' ? 'المستوى التالي' : 'Next Interval Level'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubView('levels')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold cursor-pointer"
                  >
                    {lang === 'ar' ? 'قائمة المستويات' : 'All Levels'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
