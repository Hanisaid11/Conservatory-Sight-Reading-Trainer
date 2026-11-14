import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ALL_RHYTHM_LEVELS,
  buildTwoMeasureExercise,
  RHYTHM_CHAPTERS,
  RHYTHM_ELEMENT_META,
  RhythmLevel,
  RhythmSubNote,
  TimingGrade,
} from '../data/rhythmCurriculum';
import { RhythmStaffRenderer } from './RhythmStaffRenderer';
import { ExerciseLessonCard } from './ExerciseLessonCard';
import { audioEngine } from '../services/audioEngine';
import { UserProgressState } from '../services/storageService';
import {
  ChevronRight,
  Drum,
  Ear,
  Lock,
  Play,
  RotateCcw,
  Star,
  Square,
  Volume2,
} from 'lucide-react';

interface RhythmTrainerViewProps {
  progress: UserProgressState;
  lang: 'en' | 'ar';
  onCompleteRhythmLevel: (
    levelId: string,
    accuracy: number,
    bpm: number,
    score: number,
    evaluatedCount: number,
    goodOrPerfectCount: number
  ) => { earnedStars: number; newlyUnlockedRhythmId: string | null };
}

type RhythmPhase = 'idle' | 'listen_demo' | 'count_in' | 'playing' | 'phrase_summary' | 'level_complete';

const PHRASES_PER_LEVEL = 3; // 3 two-measure exercises (6 measures total) per level

export const RhythmTrainerView: React.FC<RhythmTrainerViewProps> = ({
  progress,
  lang,
  onCompleteRhythmLevel,
}) => {
  const [subView, setSubView] = useState<'levels' | 'stage'>('levels');
  const [selectedLevel, setSelectedLevel] = useState<RhythmLevel>(ALL_RHYTHM_LEVELS[0]);
  const [bpm, setBpm] = useState<number>(70);
  const [staffStyle, setStaffStyle] = useState<'percussion_1line' | 'standard_5line'>('percussion_1line');

  // Exercise & Phrase state
  const [phraseIndex, setPhraseIndex] = useState<number>(0); // 0 to PHRASES_PER_LEVEL - 1
  const [notes, setNotes] = useState<RhythmSubNote[]>(() =>
    buildTwoMeasureExercise(
      ALL_RHYTHM_LEVELS[0].measureTemplates[0],
      ALL_RHYTHM_LEVELS[0].measureTemplates[1],
      4
    )
  );

  // Real-time Playback & Grading State
  const [phase, setPhase] = useState<RhythmPhase>('idle');
  const [grades, setGrades] = useState<Record<string, TimingGrade>>({});
  const [timingOffsetsMs, setTimingOffsetsMs] = useState<Record<string, number>>({});
  const [holdProgressByNote, setHoldProgressByNote] = useState<Record<string, number>>({});
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  const [countInBeat, setCountInBeat] = useState<number | null>(null);
  const [activeMetronomeBeat, setActiveMetronomeBeat] = useState<number | null>(null);

  // User Tap / Hold Live Feedback Banner
  const [isHoldingPad, setIsHoldingPad] = useState<boolean>(false);
  const [liveHoldRatio, setLiveHoldRatio] = useState<number>(0);
  const [lastFeedbackBadge, setLastFeedbackBadge] = useState<{
    grade: TimingGrade;
    labelEn: string;
    labelAr: string;
    deltaMs?: number;
  } | null>(null);

  // Cumulative Level Scoring across phrases
  const [cumulativeStats, setCumulativeStats] = useState<{
    totalUnits: number;
    earnedPoints: number; // 1.0 for perfect, 0.75 for early/late, 0 for miss
    score: number;
  }>({ totalUnits: 0, earnedPoints: 0, score: 0 });

  const [levelSummary, setLevelSummary] = useState<{
    accuracy: number;
    earnedStars: number;
    newlyUnlockedId: string | null;
    score: number;
  } | null>(null);

  // High-precision AudioContext timing refs
  const rafRef = useRef<number | null>(null);
  const startAudioTimeRef = useRef<number>(0);
  const lastClickedWholeBeatRef = useRef<number>(-999);
  const demoPlayedNotesRef = useRef<Set<string>>(new Set());

  // Mutable refs for real-time evaluation during animation frame loop
  const gradesRef = useRef<Record<string, TimingGrade>>({});
  const offsetsRef = useRef<Record<string, number>>({});
  const holdProgRef = useRef<Record<string, number>>({});
  const activeHeldNoteRef = useRef<{
    note: RhythmSubNote;
    pressAudioTime: number;
    initialGrade: 'perfect' | 'early' | 'late';
  } | null>(null);
  const restViolationsRef = useRef<number>(0);

  const beatsPerMeasure = selectedLevel.timeSignature[0];
  const totalExerciseBeats = beatsPerMeasure * 2;
  const secPerBeat = 60 / bpm;

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioEngine.stopRhythmPadHold();
    setIsHoldingPad(false);
    setLiveHoldRatio(0);
    setCountInBeat(null);
    setActiveMetronomeBeat(null);
  }, []);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  // Generate a fresh 2-measure rhythm exercise from the level's template pool
  const generatePhraseNotes = useCallback((lvl: RhythmLevel, pIdx: number): RhythmSubNote[] => {
    const pool = lvl.measureTemplates;
    const m0 = pool[pIdx % pool.length];
    const m1 = pool[(pIdx + 1 + Math.floor(Math.random() * (pool.length - 1 || 1))) % pool.length];
    return buildTwoMeasureExercise(m0, m1, lvl.timeSignature[0]);
  }, []);

  const selectRhythmLevel = (lvl: RhythmLevel) => {
    stopLoop();
    setSelectedLevel(lvl);
    setBpm(lvl.defaultBpm);
    setPhraseIndex(0);
    const initialNotes = generatePhraseNotes(lvl, 0);
    setNotes(initialNotes);
    setGrades({});
    setTimingOffsetsMs({});
    setHoldProgressByNote({});
    setPlayheadBeat(null);
    setLastFeedbackBadge(null);
    setCumulativeStats({ totalUnits: 0, earnedPoints: 0, score: 0 });
    setLevelSummary(null);
    setPhase('idle');
    setSubView('stage');
  };

  // Finalize and score the current 2-measure phrase once the playhead reaches totalExerciseBeats
  const finalizePhraseEvaluation = useCallback(() => {
    stopLoop();
    setPlayheadBeat(null);

    const finalGrades: Record<string, TimingGrade> = { ...gradesRef.current };
    let phraseTotal = 0;
    let phrasePoints = 0;
    let phraseScore = 0;

    notes.forEach((n) => {
      phraseTotal += 1;
      const g = finalGrades[n.id];
      if (n.isRest) {
        // If rest was not violated, mark it as 'perfect'!
        if (g !== 'miss') {
          finalGrades[n.id] = 'perfect';
          phrasePoints += 1;
          phraseScore += 80;
        }
      } else {
        if (!g || g === 'pending' || g === 'active') {
          finalGrades[n.id] = 'miss';
        } else if (g === 'perfect') {
          phrasePoints += 1;
          phraseScore += 120;
        } else if (g === 'early' || g === 'late' || g === 'early_release') {
          phrasePoints += 0.75;
          phraseScore += 85;
        }
      }
    });

    gradesRef.current = finalGrades;
    setGrades({ ...finalGrades });

    const nextTotalUnits = cumulativeStats.totalUnits + phraseTotal;
    const nextEarnedPoints = cumulativeStats.earnedPoints + phrasePoints;
    const nextScore = cumulativeStats.score + phraseScore;

    setCumulativeStats({
      totalUnits: nextTotalUnits,
      earnedPoints: nextEarnedPoints,
      score: nextScore,
    });

    if (phraseIndex + 1 >= PHRASES_PER_LEVEL) {
      const finalAccuracy =
        nextTotalUnits > 0 ? Math.round((nextEarnedPoints / nextTotalUnits) * 100) : 100;
      const res = onCompleteRhythmLevel(
        selectedLevel.id,
        finalAccuracy,
        bpm,
        nextScore,
        nextTotalUnits,
        Math.round(nextEarnedPoints)
      );
      setLevelSummary({
        accuracy: finalAccuracy,
        earnedStars: res.earnedStars,
        newlyUnlockedId: res.newlyUnlockedRhythmId,
        score: nextScore,
      });
      setPhase('level_complete');
      audioEngine.playLevelCompleteFanfare(finalAccuracy >= 80);
    } else {
      setPhase('phrase_summary');
    }
  }, [
    bpm,
    cumulativeStats,
    notes,
    onCompleteRhythmLevel,
    phraseIndex,
    selectedLevel.id,
    stopLoop,
  ]);

  /**
   * Start either:
   * - 'listen_demo': Computer plays the 2 measures with metronome so user can listen first
   * - 'count_in' -> 'playing': 1-measure count-in followed by live user tap evaluation
   */
  const startRhythmRun = useCallback(
    (mode: 'demo' | 'practice') => {
      stopLoop();

      gradesRef.current = {};
      offsetsRef.current = {};
      holdProgRef.current = {};
      activeHeldNoteRef.current = null;
      restViolationsRef.current = 0;
      demoPlayedNotesRef.current = new Set();

      setGrades({});
      setTimingOffsetsMs({});
      setHoldProgressByNote({});
      setLastFeedbackBadge(null);

      const startAudioTime = audioEngine.getAudioTime() + 0.08;
      startAudioTimeRef.current = startAudioTime;
      lastClickedWholeBeatRef.current = -999;

      const countInBeats = mode === 'practice' ? beatsPerMeasure : 0;
      setPhase(mode === 'demo' ? 'listen_demo' : 'count_in');

      const tick = () => {
        const nowAudio = audioEngine.getAudioTime();
        const elapsedSec = nowAudio - startAudioTimeRef.current;
        const rawBeat = elapsedSec / secPerBeat; // 0 .. (countInBeats + totalExerciseBeats)

        const currentWholeBeat = Math.floor(rawBeat);

        // Trigger Metronome Click on every integer beat
        if (
          rawBeat >= 0 &&
          currentWholeBeat > lastClickedWholeBeatRef.current &&
          currentWholeBeat < countInBeats + totalExerciseBeats
        ) {
          lastClickedWholeBeatRef.current = currentWholeBeat;
          const beatInMeasure = (currentWholeBeat % beatsPerMeasure) + 1;
          setActiveMetronomeBeat(beatInMeasure);
          audioEngine.playMetronomeClick(beatInMeasure === 1);
        }

        // Phase 1: Count-In Measure (only in practice mode)
        if (rawBeat < countInBeats) {
          const cBeat = Math.min(beatsPerMeasure, Math.max(1, Math.floor(rawBeat) + 1));
          setCountInBeat(cBeat);
          setPlayheadBeat(null);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        // Phase 2: Exercise Measures (0 to totalExerciseBeats)
        setCountInBeat(null);
        const exerciseBeat = rawBeat - countInBeats;

        if (mode === 'practice') {
          setPhase('playing');
        }

        if (exerciseBeat <= totalExerciseBeats) {
          setPlayheadBeat(exerciseBeat);

          if (mode === 'demo') {
            // In "Listen First" Demo mode, trigger computer audio for each sounding note
            notes.forEach((n) => {
              if (
                !n.isRest &&
                exerciseBeat >= n.startBeatInExercise &&
                !demoPlayedNotesRef.current.has(n.id)
              ) {
                demoPlayedNotesRef.current.add(n.id);
                audioEngine.playRhythmNoteDemo(n.durationBeats * secPerBeat);
                gradesRef.current[n.id] = 'perfect';
                setGrades({ ...gradesRef.current });
              }
              if (!n.isRest && n.requiresHold && exerciseBeat >= n.startBeatInExercise) {
                const prog = Math.min(
                  1,
                  Math.max(0, (exerciseBeat - n.startBeatInExercise) / n.durationBeats)
                );
                holdProgRef.current[n.id] = prog;
                setHoldProgressByNote({ ...holdProgRef.current });
              }
            });
          } else {
            // In live Practice mode: update active hold progress bar & mark missed notes
            if (activeHeldNoteRef.current) {
              const held = activeHeldNoteRef.current;
              const heldDurationSec = Math.max(0, nowAudio - held.pressAudioTime);
              const targetDurationSec = held.note.durationBeats * secPerBeat;
              const ratio = Math.min(1, heldDurationSec / (targetDurationSec * 0.85));
              holdProgRef.current[held.note.id] = ratio;
              setHoldProgressByNote({ ...holdProgRef.current });
              setLiveHoldRatio(ratio);
            }

            // Auto-mark notes as 'miss' if playhead has passed their onset by > 165ms without a tap
            const missThresholdBeats = 0.165 / secPerBeat;
            let gradesChanged = false;
            notes.forEach((n) => {
              const g = gradesRef.current[n.id];
              if (!n.isRest && (!g || g === 'pending')) {
                if (exerciseBeat > n.startBeatInExercise + missThresholdBeats) {
                  gradesRef.current[n.id] = 'miss';
                  gradesChanged = true;
                }
              } else if (n.isRest && (!g || g === 'pending')) {
                // Once a rest is cleanly passed without a stray tap, mark it 'perfect'
                if (exerciseBeat >= n.startBeatInExercise + n.durationBeats - 0.05) {
                  gradesRef.current[n.id] = 'perfect';
                  gradesChanged = true;
                }
              }
            });
            if (gradesChanged) {
              setGrades({ ...gradesRef.current });
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        } else {
          // Exercise finished!
          if (mode === 'demo') {
            stopLoop();
            setPlayheadBeat(null);
            setPhase('idle');
          } else {
            finalizePhraseEvaluation();
          }
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [beatsPerMeasure, finalizePhraseEvaluation, notes, secPerBeat, stopLoop, totalExerciseBeats]
  );

  /**
   * Handle User Drum Pad / Spacebar Press Down (`pointerdown` / `keydown`)
   */
  const handlePadDown = useCallback(() => {
    if (isHoldingPad) return;
    setIsHoldingPad(true);
    audioEngine.startRhythmPadHold();

    // Only grade taps during the active playing phase (or right at the boundary of count-in -> beat 0)
    if (phase !== 'playing' && phase !== 'count_in') return;

    const nowAudio = audioEngine.getAudioTime();
    const elapsedSec = nowAudio - startAudioTimeRef.current;
    const countInSec = beatsPerMeasure * secPerBeat;
    const exerciseSec = elapsedSec - countInSec;
    const exerciseBeat = exerciseSec / secPerBeat;

    // Ignore taps far before the end of count-in
    if (exerciseSec < -0.18) return;

    // 1. Check if the user tapped inside an active Rest (سكتة)!
    const activeRest = notes.find(
      (n) =>
        n.isRest &&
        exerciseBeat >= n.startBeatInExercise + 0.08 &&
        exerciseBeat <= n.startBeatInExercise + n.durationBeats - 0.08
    );

    // Find closest ungraded sounding note within ±220ms
    let closestNote: RhythmSubNote | null = null;
    let minAbsDiffMs = Infinity;
    let signedDiffMs = 0;

    notes.forEach((n) => {
      if (n.isRest) return;
      const g = gradesRef.current[n.id];
      if (g && g !== 'pending') return;
      const expectedSec = n.startBeatInExercise * secPerBeat;
      const diffMs = Math.round((exerciseSec - expectedSec) * 1000);
      const absDiff = Math.abs(diffMs);
      if (absDiff < minAbsDiffMs) {
        minAbsDiffMs = absDiff;
        signedDiffMs = diffMs;
        closestNote = n;
      }
    });

    if (closestNote && minAbsDiffMs <= 130) {
      const targetNote = closestNote as RhythmSubNote;
      const initialGrade: 'perfect' | 'early' | 'late' =
        minAbsDiffMs <= 60 ? 'perfect' : signedDiffMs < 0 ? 'early' : 'late';

      offsetsRef.current[targetNote.id] = signedDiffMs;
      setTimingOffsetsMs({ ...offsetsRef.current });

      if (targetNote.requiresHold) {
        gradesRef.current[targetNote.id] = 'active';
        activeHeldNoteRef.current = {
          note: targetNote,
          pressAudioTime: nowAudio,
          initialGrade,
        };
        setLiveHoldRatio(0.08);
      } else {
        gradesRef.current[targetNote.id] = initialGrade;
        holdProgRef.current[targetNote.id] = 1;
        setHoldProgressByNote({ ...holdProgRef.current });
      }

      setGrades({ ...gradesRef.current });
      setLastFeedbackBadge({
        grade: initialGrade,
        labelEn:
          initialGrade === 'perfect'
            ? 'Perfect Timing!'
            : initialGrade === 'early'
            ? 'Slightly Early'
            : 'Slightly Late',
        labelAr:
          initialGrade === 'perfect'
            ? 'توقيت ممتاز!'
            : initialGrade === 'early'
            ? 'مبكر قليلاً'
            : 'متأخر قليلاً',
        deltaMs: signedDiffMs,
      });
    } else if (activeRest) {
      // Tapped during a Rest!
      gradesRef.current[activeRest.id] = 'miss';
      setGrades({ ...gradesRef.current });
      restViolationsRef.current += 1;
      audioEngine.playWrongFeedback();
      setLastFeedbackBadge({
        grade: 'miss',
        labelEn: 'Tapped During a Rest!',
        labelAr: 'نقرت أثناء السكتة!',
      });
    } else if (closestNote && minAbsDiffMs <= 260) {
      const targetNote = closestNote as RhythmSubNote;
      gradesRef.current[targetNote.id] = 'miss';
      offsetsRef.current[targetNote.id] = signedDiffMs;
      setGrades({ ...gradesRef.current });
      setTimingOffsetsMs({ ...offsetsRef.current });
      setLastFeedbackBadge({
        grade: 'miss',
        labelEn: signedDiffMs < 0 ? 'Too Early (>130ms)' : 'Too Late (>130ms)',
        labelAr: signedDiffMs < 0 ? 'مبكر جداً' : 'متأخر جداً',
        deltaMs: signedDiffMs,
      });
    }
  }, [beatsPerMeasure, isHoldingPad, notes, phase, secPerBeat]);

  /**
   * Handle User Drum Pad / Spacebar Release (`pointerup` / `keyup`)
   * Evaluates Hold Duration for Half Notes (البلانش), Dotted Notes, and Whole Notes (الروند)
   */
  const handlePadUp = useCallback(() => {
    if (!isHoldingPad) return;
    setIsHoldingPad(false);
    audioEngine.stopRhythmPadHold();

    const held = activeHeldNoteRef.current;
    if (!held) return;
    activeHeldNoteRef.current = null;

    const nowAudio = audioEngine.getAudioTime();
    const heldSec = Math.max(0, nowAudio - held.pressAudioTime);
    const expectedSec = held.note.durationBeats * secPerBeat;
    const holdRatio = heldSec / expectedSec;

    holdProgRef.current[held.note.id] = Math.min(1, holdRatio);
    setHoldProgressByNote({ ...holdProgRef.current });

    if (holdRatio >= 0.65) {
      // Held long enough! Keep onset grade
      gradesRef.current[held.note.id] = held.initialGrade;
      setGrades({ ...gradesRef.current });
    } else if (holdRatio >= 0.35) {
      // Released a bit early on a long note
      gradesRef.current[held.note.id] = 'early_release';
      setGrades({ ...gradesRef.current });
      setLastFeedbackBadge({
        grade: 'early_release',
        labelEn: `Released Early (Held ${Math.round(holdRatio * 100)}%)`,
        labelAr: `أفلت النغمة مبكراً (${Math.round(holdRatio * 100)}%)`,
      });
    } else {
      // Released way too early (treated a Half/Whole note like a short tap)
      gradesRef.current[held.note.id] = 'miss';
      setGrades({ ...gradesRef.current });
      setLastFeedbackBadge({
        grade: 'miss',
        labelEn: 'Hold Long Notes Full Duration!',
        labelAr: 'يجب إمساك العلامات الطويلة لكامل مدتها!',
      });
    }
  }, [isHoldingPad, secPerBeat]);

  // Spacebar Keyboard Listener for TAP / HOLD
  useEffect(() => {
    if (subView !== 'stage') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
        e.preventDefault();
        handlePadDown();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handlePadUp();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [subView, handlePadDown, handlePadUp]);

  // Advance to next phrase within the Rhythm Level
  const handleNextPhrase = () => {
    const nextIdx = phraseIndex + 1;
    setPhraseIndex(nextIdx);
    const nextNotes = generatePhraseNotes(selectedLevel, nextIdx);
    setNotes(nextNotes);
    setGrades({});
    setTimingOffsetsMs({});
    setHoldProgressByNote({});
    setPlayheadBeat(null);
    setLastFeedbackBadge(null);
    setPhase('idle');
  };

  const [activeRhythmChapterIdx, setActiveRhythmChapterIdx] = useState<number>(0);
  const currentRhythmChapter = RHYTHM_CHAPTERS[activeRhythmChapterIdx] || RHYTHM_CHAPTERS[0];

  return (
    <div className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* ===================================================================== */}
      {/* VIEW 1: RHYTHM CURRICULUM (ORGANIZED BY CHAPTER TABS FOR MOBILE FIT)  */}
      {/* ===================================================================== */}
      {subView === 'levels' && (
        <div className="space-y-3.5">
          {/* Compact Top Header + Continue CTA */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xl font-serif shrink-0">
                ♫
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold font-display text-slate-900 truncate">
                  {lang === 'ar' ? 'قسم تدريب قراءة الإيقاع' : 'Rhythm Reading Trainer'}
                </h1>
                <p className="text-xs text-slate-500 truncate">
                  {lang === 'ar'
                    ? 'اختر الفصل ثم اضغط على التمرين للبدء مع المترونوم'
                    : 'Select a chapter and tap an exercise to practice'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => selectRhythmLevel(selectedLevel)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <Drum className="w-3.5 h-3.5" />
              <span>
                {lang === 'ar'
                  ? `ابدأ ${selectedLevel.levelNumber}`
                  : `Start ${selectedLevel.levelNumber}`}
              </span>
            </button>
          </div>

          {/* 4 Chapter Selector Tabs */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-200/75 p-1 rounded-xl">
            {RHYTHM_CHAPTERS.map((chap, idx) => {
              const isSelected = idx === activeRhythmChapterIdx;
              return (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() => setActiveRhythmChapterIdx(idx)}
                  className={`py-2 px-2 rounded-lg text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white text-amber-900 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="text-[11px] font-bold truncate">
                    {lang === 'ar' ? `الفصل ${idx + 1}` : `Chap ${idx + 1}`}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {lang === 'ar' ? chap.badgeAr : chap.badgeEn}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Chapter Banner */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {lang === 'ar' ? currentRhythmChapter.titleAr : currentRhythmChapter.titleEn}
              </h2>
              <p className="text-xs text-slate-600 truncate">
                {lang === 'ar' ? currentRhythmChapter.subtitleAr : currentRhythmChapter.subtitleEn}
              </p>
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-white px-2.5 py-1 rounded-lg border border-amber-200 shrink-0">
              {currentRhythmChapter.levels.length} {lang === 'ar' ? 'تمارين' : 'Drills'}
            </span>
          </div>

          {/* Compact Level Cards for Current Chapter Only */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {currentRhythmChapter.levels.map((lvl) => {
              const isUnlocked =
                progress.unlockAllSandbox ||
                progress.unlockedRhythmLevels.includes(lvl.id);
              const rec = progress.rhythmRecords[lvl.id];
              const stars = rec?.stars || 0;

              return (
                <div
                  key={lvl.id}
                  onClick={() => {
                    if (isUnlocked) selectRhythmLevel(lvl);
                  }}
                  className={`group rounded-2xl border p-3.5 transition-all duration-150 flex flex-col justify-between gap-2.5 ${
                    isUnlocked
                      ? 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-2xs cursor-pointer'
                      : 'bg-slate-50/80 border-slate-200/70 opacity-75 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-xs font-mono font-bold shrink-0">
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

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div className="text-[11px] text-slate-500 truncate">
                      <span className="font-mono font-semibold text-slate-700">
                        {lvl.timeSignature[0]}/{lvl.timeSignature[1]} · {lvl.defaultBpm} BPM
                      </span>
                      {' · '}
                      {lvl.introducedKinds
                        .map((k) =>
                          lang === 'ar'
                            ? RHYTHM_ELEMENT_META[k].nameAr
                            : RHYTHM_ELEMENT_META[k].nameEn
                        )
                        .join('، ')}
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
                            ? 'bg-amber-600 text-white'
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

      {/* ===================================================================== */}
      {/* VIEW 2: INTERACTIVE RHYTHM STAGE (METRONOME, STAFF & TAP/HOLD PAD)    */}
      {/* ===================================================================== */}
      {subView === 'stage' && (
        <div className="space-y-5">
          {/* Top Stage Bar & Metronome Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                <button
                  type="button"
                  onClick={() => {
                    stopLoop();
                    setSubView('levels');
                  }}
                  className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                >
                  {lang === 'ar' ? '← جميع مستويات الإيقاع' : '← All Rhythm Levels'}
                </button>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-bold text-slate-700">
                  {selectedLevel.levelNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {lang === 'ar'
                    ? `الجملة ${phraseIndex + 1} من ${PHRASES_PER_LEVEL}`
                    : `Phrase ${phraseIndex + 1} of ${PHRASES_PER_LEVEL}`}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold font-display text-slate-900">
                {lang === 'ar' ? selectedLevel.titleAr : selectedLevel.titleEn}
              </h1>
            </div>

            {/* Metronome BPM Slider & Visual Beat Dots ([ 1 ] [ 2 ] [ 3 ] [ 4 ]) */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Visual Pendulum / Beat Dots */}
              <div className="flex items-center gap-1.5" dir="ltr">
                {Array.from({ length: beatsPerMeasure }).map((_, idx) => {
                  const beatNum = idx + 1;
                  const isActive = activeMetronomeBeat === beatNum;
                  const isDownbeat = beatNum === 1;
                  return (
                    <div
                      key={beatNum}
                      className={`w-8 h-8 rounded-lg font-mono text-xs font-bold flex items-center justify-center border transition-all duration-75 ${
                        isActive
                          ? isDownbeat
                            ? 'bg-amber-500 border-amber-600 text-white scale-110 shadow-xs'
                            : 'bg-indigo-600 border-indigo-700 text-white scale-105'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                      title={isDownbeat ? 'Beat 1 (Accented Tick)' : `Beat ${beatNum} (Tock)`}
                    >
                      {beatNum}
                    </div>
                  );
                })}
              </div>

              {/* BPM Control Slider (40 to 140 BPM) */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <label
                  htmlFor="bpm-slider"
                  className="text-xs font-bold font-mono text-slate-800 whitespace-nowrap tabular-nums"
                >
                  {bpm} BPM
                </label>
                <input
                  id="bpm-slider"
                  type="range"
                  min={40}
                  max={140}
                  value={bpm}
                  disabled={phase === 'count_in' || phase === 'playing'}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-24 sm:w-28 accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Toggle 1-Line Percussion Staff vs 5-Line Standard Staff */}
              <button
                type="button"
                onClick={() =>
                  setStaffStyle((s) =>
                    s === 'percussion_1line' ? 'standard_5line' : 'percussion_1line'
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                {staffStyle === 'percussion_1line'
                  ? lang === 'ar'
                    ? 'مدرج إيقاعي (خط ١)'
                    : '1-Line Staff'
                  : lang === 'ar'
                  ? 'مدرج قياسي (٥ خطوط)'
                  : '5-Line Staff'}
              </button>
            </div>
          </div>

          {/* Interactive Step-by-Step Rhythm Exercise Explanation */}
          <ExerciseLessonCard
            lang={lang}
            levelNumber={selectedLevel.levelNumber}
            titleEn={selectedLevel.titleEn}
            titleAr={selectedLevel.titleAr}
            descriptionEn={selectedLevel.descriptionEn}
            descriptionAr={selectedLevel.descriptionAr}
            mnemonicEn={selectedLevel.tipEn}
            mnemonicAr={selectedLevel.tipAr}
            accentColor="amber"
            stepsEn={[
              `Time Signature: ${selectedLevel.timeSignature[0]}/${selectedLevel.timeSignature[1]} (${selectedLevel.timeSignature[0]} beats per measure). Wait for the 1-measure count-in before tapping.`,
              `Symbols in this drill: ${selectedLevel.introducedKinds
                .map((k) => `${RHYTHM_ELEMENT_META[k].nameEn} = ${RHYTHM_ELEMENT_META[k].beatsLabelEn}`)
                .join(' · ')}.`,
              'Tap within ±60ms of the beat for Perfect green grading, and keep holding the button/Spacebar across Half, Dotted, and Whole notes!',
            ]}
            stepsAr={[
              `الميزان الزمني: ${selectedLevel.timeSignature[0]}/${selectedLevel.timeSignature[1]} (${selectedLevel.timeSignature[0]} نبضات في كل مازورة). انتظر انتهاء مازورة العد التمهيدي قبل البدء بالنقر.`,
              `العلامات في هذا التمرين: ${selectedLevel.introducedKinds
                .map((k) => `${RHYTHM_ELEMENT_META[k].nameAr} (${RHYTHM_ELEMENT_META[k].beatsLabelAr})`)
                .join(' · ')}.`,
              'اضغط بدقة مع النبضة (±60ms) للحصول على تقييم ممتاز (أخضر)، واستمر بالضغط طوال مدة البلانش والروند ولا تلمس الزر أثناء السكتات!',
            ]}
          />

          {/* SVG Rhythm Staff Stage */}
          {phase !== 'level_complete' ? (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                <RhythmStaffRenderer
                  notes={notes}
                  timeSignature={selectedLevel.timeSignature}
                  grades={grades}
                  timingOffsetsMs={timingOffsetsMs}
                  holdProgressByNote={holdProgressByNote}
                  playheadBeat={playheadBeat}
                  countInBeat={countInBeat}
                  staffStyle={staffStyle}
                  lang={lang}
                />

                {/* Action Controls Bar: Listen First, Start Count-In & Tap, New Phrase */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {phase === 'idle' || phase === 'phrase_summary' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startRhythmRun('practice')}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>
                            {lang === 'ar'
                              ? 'ابدأ العد التمهيدي والعزف (Count-in & Tap)'
                              : 'Start Count-In & Tap'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => startRhythmRun('demo')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-sm font-semibold transition-colors cursor-pointer"
                        >
                          <Ear className="w-4 h-4 text-emerald-700" />
                          <span>{lang === 'ar' ? 'استمع أولاً (Listen First)' : 'Listen First'}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          stopLoop();
                          setPlayheadBeat(null);
                          setPhase('idle');
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-sm font-semibold transition-colors cursor-pointer"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        <span>{lang === 'ar' ? 'إيقاف' : 'Stop'}</span>
                      </button>
                    )}

                    {phase === 'phrase_summary' && (
                      <button
                        type="button"
                        onClick={handleNextPhrase}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        <span>
                          {lang === 'ar' ? 'الجملة التالية ←' : 'Next Phrase →'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Grading Window Legend */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="text-emerald-700 font-semibold">
                      ● {lang === 'ar' ? 'ممتاز (±60ms)' : 'Perfect (±60ms)'}
                    </span>
                    <span className="text-amber-700 font-semibold">
                      ◆ {lang === 'ar' ? 'مبكر/متأخر (±130ms)' : 'Good (±61–130ms)'}
                    </span>
                    <span className="text-red-700 font-semibold">
                      ▲ {lang === 'ar' ? 'خطأ (>130ms أو سكتة)' : 'Miss (>130ms / Rest)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* HUGE ERGONOMIC "TAP / HOLD" DRUM PAD DECK */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-600">
                    {lang === 'ar'
                      ? 'اضغط مع الاستمرار على زر الطبل أدناه أو مفتاح المسطرة (Spacebar) أو أي مفتاح MIDI:'
                      : 'Press & HOLD the Drum Pad below, press Spacebar, or play any connected MIDI key:'}
                  </div>

                  {/* Live Timing Badge Feedback */}
                  {lastFeedbackBadge && (
                    <div
                      className={`px-3 py-1 rounded-lg text-xs font-bold font-mono ${
                        lastFeedbackBadge.grade === 'perfect'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : lastFeedbackBadge.grade === 'miss'
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {lang === 'ar' ? lastFeedbackBadge.labelAr : lastFeedbackBadge.labelEn}
                      {typeof lastFeedbackBadge.deltaMs === 'number'
                        ? ` (${lastFeedbackBadge.deltaMs > 0 ? '+' : ''}${
                            lastFeedbackBadge.deltaMs
                          }ms)`
                        : ''}
                    </div>
                  )}
                </div>

                {/* Giant Touch-Responsive Drum Pad Button */}
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handlePadDown();
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    handlePadUp();
                  }}
                  onPointerLeave={() => {
                    if (isHoldingPad) handlePadUp();
                  }}
                  onPointerCancel={() => {
                    if (isHoldingPad) handlePadUp();
                  }}
                  className={`relative w-full min-h-[132px] sm:min-h-[148px] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-75 select-none cursor-pointer overflow-hidden ${
                    isHoldingPad
                      ? 'bg-indigo-600 border-indigo-700 text-white scale-[0.99] shadow-inner'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-950 text-white shadow-sm'
                  }`}
                >
                  {/* Filling Hold Progress Bar Overlay inside the Drum Pad */}
                  {isHoldingPad && liveHoldRatio > 0 && (
                    <div
                      className="absolute bottom-0 left-0 top-0 bg-emerald-500/30 transition-all duration-75 pointer-events-none"
                      style={{ width: `${Math.round(liveHoldRatio * 100)}%` }}
                    />
                  )}

                  <div className="relative z-10 flex items-center gap-3">
                    <Drum className="w-7 h-7 text-amber-400" />
                    <span className="text-xl sm:text-2xl font-bold font-display tracking-tight">
                      {isHoldingPad
                        ? lang === 'ar'
                          ? 'ممسك بالنغمة... (HOLDING)'
                          : 'HOLDING NOTE...'
                        : lang === 'ar'
                        ? 'اضغط / امسك الإيقاع هنا (TAP / HOLD)'
                        : 'TAP / HOLD RHYTHM PAD'}
                    </span>
                  </div>

                  <span className="relative z-10 text-xs text-slate-300 font-mono">
                    {lang === 'ar'
                      ? 'مفتاح الاختصار: مسطرة المسافة [Spacebar] — امسك للبلانش والروند'
                      : 'Shortcut: [Spacebar] — Hold down for Half (2 beats) & Whole (4 beats) notes'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* LEVEL COMPLETE SUMMARY CARD */
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
                        ? 'أحسنت! اجتزت المستوى بنجاح (≥80%)'
                        : 'Rhythm Stage Passed (≥80% Accuracy)'
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

                <div className="grid grid-cols-3 gap-3 text-left">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500">
                      {lang === 'ar' ? 'دقة الإيقاع' : 'Rhythm Accuracy'}
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      {levelSummary.accuracy}%
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs text-slate-500">
                      {lang === 'ar' ? 'السرعة' : 'Tempo'}
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      {bpm} BPM
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
                    onClick={() => selectRhythmLevel(selectedLevel)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'إعادة التمرين' : 'Replay Level'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const idx = ALL_RHYTHM_LEVELS.findIndex((l) => l.id === selectedLevel.id);
                      const nextLvl =
                        idx >= 0 && idx + 1 < ALL_RHYTHM_LEVELS.length
                          ? ALL_RHYTHM_LEVELS[idx + 1]
                          : ALL_RHYTHM_LEVELS[0];
                      selectRhythmLevel(nextLvl);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer shadow-xs"
                  >
                    <span>{lang === 'ar' ? 'المستوى التالي' : 'Next Rhythm Level'}</span>
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
