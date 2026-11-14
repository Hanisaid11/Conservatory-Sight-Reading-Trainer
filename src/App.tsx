import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accidental,
  ALL_LEVELS,
  ALL_NOTES_LIST,
  CURRICULUM_CHAPTERS,
  CurriculumLevel,
  getNoteById,
  KeySignature,
  NATURAL_NOTES_LIST,
  NoteLetter,
  NoteSpec,
} from './data/curriculum';
import { ALL_RHYTHM_LEVELS } from './data/rhythmCurriculum';
import { ALL_INTERVAL_LEVELS, INTERVAL_CHAPTERS } from './data/intervalCurriculum';
import { StaffRenderer } from './components/StaffRenderer';
import { InputDeck, InputMethod, LabelFormat } from './components/InputDeck';
import { RhythmTrainerView } from './components/RhythmTrainerView';
import { IntervalTrainerView } from './components/IntervalTrainerView';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ExerciseLessonCard } from './components/ExerciseLessonCard';
import { audioEngine } from './services/audioEngine';
import {
  defaultProgressState,
  loadUserProgress,
  recordIntervalCompletion,
  recordLevelCompletion,
  recordNoteAttempt,
  recordRhythmCompletion,
  saveUserProgress,
  UserProgressState,
} from './services/storageService';
import {
  BookOpen,
  ChevronRight,
  Drum,
  Flame,
  GitCommitHorizontal,
  Globe,
  Lock,
  Music,
  Play,
  RotateCcw,
  Sliders,
  Star,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';

type ActiveTab = 'home' | 'campaign' | 'trainer' | 'intervals' | 'rhythm' | 'sandbox' | 'progress';
type SessionMode = 'campaign' | 'sandbox' | 'weak_notes';
type TimerOption = 60 | 180 | 0; // 60s (1 min), 180s (3 min), 0 (Endless)

const CAMPAIGN_TOTAL_NOTES = 20;

export default function App() {
  // Navigation, Language ('en' | 'ar') & Global Progress State
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activePitchChapterIdx, setActivePitchChapterIdx] = useState<number>(0);
  const [activeIntervalLevelId, setActiveIntervalLevelId] = useState<string | null>(null);
  const [lang, setLang] = useState<'en' | 'ar'>('ar');
  const [progress, setProgress] = useState<UserProgressState>(() => loadUserProgress());
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Input Deck Preferences
  const [inputMethod, setInputMethod] = useState<InputMethod>('buttons');
  const [labelFormat, setLabelFormat] = useState<LabelFormat>('both');
  const [showPianoHints, setShowPianoHints] = useState<boolean>(true);
  const [midiDevices, setMidiDevices] = useState<string[]>([]);

  // Active Level & Pre-Level Guide Card Modal
  const [selectedLevel, setSelectedLevel] = useState<CurriculumLevel>(ALL_LEVELS[0]);
  const [showGuideCard, setShowGuideCard] = useState<boolean>(false);
  const [highlightedGuideNoteId, setHighlightedGuideNoteId] = useState<string | null>(null);

  // Sandbox Custom Practice Configuration
  const [sandboxClef, setSandboxClef] = useState<'treble' | 'bass'>('treble');
  const [sandboxLowStep, setSandboxLowStep] = useState<number>(0); // C4
  const [sandboxHighStep, setSandboxHighStep] = useState<number>(10); // F5
  const [sandboxAccidentals, setSandboxAccidentals] = useState<boolean>(false);
  const [sandboxTimerOption, setSandboxTimerOption] = useState<TimerOption>(60);

  // Active Training Session State
  const [sessionMode, setSessionMode] = useState<SessionMode>('campaign');
  const [sessionPoolIds, setSessionPoolIds] = useState<string[]>(ALL_LEVELS[0].notes);
  const [sessionClef, setSessionClef] = useState<'treble' | 'bass'>('treble');
  const [sessionKeySig, setSessionKeySig] = useState<KeySignature>('C');
  const [sessionTitle, setSessionTitle] = useState<string>('Level 1.1: Middle C & Treble G');

  // Note Queue & Spaced Repetition State
  const [noteQueue, setNoteQueue] = useState<NoteSpec[]>(() => [
    getNoteById('C4'),
    getNoteById('G4'),
    getNoteById('C4'),
  ]);
  const [spacedRepetitionDue, setSpacedRepetitionDue] = useState<
    { noteId: string; turnsRemaining: number }[]
  >([]);

  // Real-time Gameplay Feedback & Scoring Metrics
  const [feedbackState, setFeedbackState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [hadMistakeOnCurrentNote, setHadMistakeOnCurrentNote] = useState<boolean>(false);
  const [notesCompleted, setNotesCompleted] = useState<number>(0);
  const [correctFirstTryCount, setCorrectFirstTryCount] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestSessionStreak, setBestSessionStreak] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [sessionReactionTotalMs, setSessionReactionTotalMs] = useState<number>(0);
  const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);
  const [sessionMissedMap, setSessionMissedMap] = useState<Record<string, number>>({});
  const [sessionFinished, setSessionFinished] = useState<boolean>(false);
  const [earnedStarsOnFinish, setEarnedStarsOnFinish] = useState<number>(0);
  const [newlyUnlockedId, setNewlyUnlockedId] = useState<string | null>(null);

  // Timer Countdown for Sandbox Timed Modes
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const noteAppearedAtRef = useRef<number>(performance.now());
  const transitionTimeoutRef = useRef<number | null>(null);

  const currentNote = noteQueue[0] || getNoteById('C4');
  const upcomingNotes = noteQueue.slice(1, 3);

  const hasAccidentalsInSession = useMemo(() => {
    return sessionPoolIds.some((id) => {
      const n = getNoteById(id);
      return n.accidental !== '';
    });
  }, [sessionPoolIds]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioEngine.setMuted(next);
  };

  // Pick next note using Adaptive Spaced Repetition
  const pickNextNote = useCallback(
    (
      poolIds: string[],
      previousId: string,
      dueList: { noteId: string; turnsRemaining: number }[]
    ): { chosen: NoteSpec; nextDueList: { noteId: string; turnsRemaining: number }[] } => {
      const decremented = dueList.map((item) => ({
        ...item,
        turnsRemaining: item.turnsRemaining - 1,
      }));

      const dueNowIndex = decremented.findIndex(
        (item) => item.turnsRemaining <= 0 && poolIds.includes(item.noteId)
      );

      if (dueNowIndex !== -1) {
        const dueItem = decremented[dueNowIndex];
        const remaining = decremented.filter((_, idx) => idx !== dueNowIndex);
        return {
          chosen: getNoteById(dueItem.noteId),
          nextDueList: remaining,
        };
      }

      const candidates =
        poolIds.length > 1 ? poolIds.filter((id) => id !== previousId) : poolIds;
      const randomId =
        candidates[Math.floor(Math.random() * candidates.length)] || poolIds[0] || 'C4';

      return {
        chosen: getNoteById(randomId),
        nextDueList: decremented,
      };
    },
    []
  );

  // Initialize / Reset a Pitch Training Session
  const startSession = useCallback(
    (config: {
      mode: SessionMode;
      title: string;
      clef: 'treble' | 'bass';
      keySignature: KeySignature;
      poolIds: string[];
      timerSeconds: number | null;
      level?: CurriculumLevel;
    }) => {
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }

      const validPool = config.poolIds.length > 0 ? config.poolIds : ['C4', 'D4', 'E4', 'F4', 'G4'];
      const n1 = getNoteById(validPool[Math.floor(Math.random() * validPool.length)]);
      const n2Candidates = validPool.length > 1 ? validPool.filter((id) => id !== n1.id) : validPool;
      const n2 = getNoteById(n2Candidates[Math.floor(Math.random() * n2Candidates.length)]);
      const n3 = getNoteById(validPool[Math.floor(Math.random() * validPool.length)]);

      setSessionMode(config.mode);
      setSessionTitle(config.title);
      setSessionClef(config.clef);
      setSessionKeySig(config.keySignature);
      setSessionPoolIds(validPool);
      if (config.level) {
        setSelectedLevel(config.level);
      }

      setNoteQueue([n1, n2, n3]);
      setSpacedRepetitionDue([]);
      setFeedbackState('idle');
      setHadMistakeOnCurrentNote(false);
      setNotesCompleted(0);
      setCorrectFirstTryCount(0);
      setCurrentStreak(0);
      setBestSessionStreak(0);
      setScore(0);
      setSessionReactionTotalMs(0);
      setLastReactionMs(null);
      setSessionMissedMap({});
      setSessionFinished(false);
      setEarnedStarsOnFinish(0);
      setNewlyUnlockedId(null);
      setRemainingSeconds(config.timerSeconds);
      noteAppearedAtRef.current = performance.now();
      setActiveTab('trainer');
    },
    []
  );

  // Open Pre-Level Guide Card before starting a Campaign Level
  const handleSelectCampaignLevel = (levelId: string, showGuide = true) => {
    const lvl = ALL_LEVELS.find((l) => l.id === levelId) || ALL_LEVELS[0];
    setSelectedLevel(lvl);
    if (showGuide) {
      setHighlightedGuideNoteId(lvl.newNotes[0] || lvl.notes[0]);
      setShowGuideCard(true);
      const firstNote = getNoteById(lvl.newNotes[0] || lvl.notes[0]);
      audioEngine.playPianoNote(firstNote.frequency, 0.75, 0.25);
    } else {
      setShowGuideCard(false);
      startSession({
        mode: 'campaign',
        title: `Level ${lvl.levelNumber}: ${lvl.title}`,
        clef: lvl.clef,
        keySignature: lvl.keySignature,
        poolIds: lvl.notes,
        timerSeconds: null,
        level: lvl,
      });
    }
  };

  // Start Custom Practice Sandbox Session
  const handleStartSandboxSession = () => {
    const low = Math.min(sandboxLowStep, sandboxHighStep);
    const high = Math.max(sandboxLowStep, sandboxHighStep);
    const sourceList = sandboxAccidentals ? ALL_NOTES_LIST : NATURAL_NOTES_LIST;
    const filteredIds = sourceList
      .filter((n) => n.diatonicStep >= low && n.diatonicStep <= high)
      .map((n) => n.id);

    const lowNote = NATURAL_NOTES_LIST.find((n) => n.diatonicStep === low)?.id || 'C4';
    const highNote = NATURAL_NOTES_LIST.find((n) => n.diatonicStep === high)?.id || 'C5';

    startSession({
      mode: 'sandbox',
      title: `Custom Practice (${sandboxClef === 'treble' ? 'Treble' : 'Bass'} · ${lowNote}–${highNote})`,
      clef: sandboxClef,
      keySignature: 'C',
      poolIds: filteredIds.length > 0 ? filteredIds : ['C4', 'D4', 'E4', 'F4', 'G4'],
      timerSeconds: sandboxTimerOption > 0 ? sandboxTimerOption : null,
    });
  };

  // Start Weak Notes Remedial Session from Analytics Dashboard
  const handleStartWeakNotesPractice = (weakIds: string[]) => {
    const hasBassNotes = weakIds.some((id) => getNoteById(id).diatonicStep < -2);
    startSession({
      mode: 'weak_notes',
      title: 'Targeted Weak Notes Remedial Drill',
      clef: hasBassNotes ? 'bass' : 'treble',
      keySignature: 'C',
      poolIds: weakIds,
      timerSeconds: null,
    });
  };

  // Countdown Timer Effect for Timed Sandbox Mode
  useEffect(() => {
    if (
      activeTab !== 'trainer' ||
      sessionFinished ||
      remainingSeconds === null ||
      remainingSeconds <= 0
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setSessionFinished(true);
          audioEngine.playLevelCompleteFanfare(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeTab, sessionFinished, remainingSeconds]);

  // Evaluate user's answer (from Buttons, Piano, Microphone, or MIDI)
  const handleAnswerSubmission = useCallback(
    (submission: {
      letter: NoteLetter;
      accidental: Accidental;
      midi?: number;
      checkOctave?: boolean;
    }) => {
      if (sessionFinished || feedbackState === 'correct') return;

      let isMatch = false;
      if (submission.checkOctave && typeof submission.midi === 'number') {
        isMatch = submission.midi === currentNote.midi;
      } else {
        const submittedNote = ALL_NOTES_LIST.find(
          (n) =>
            n.letter === submission.letter &&
            n.accidental === submission.accidental &&
            n.octave === currentNote.octave
        );
        if (submittedNote) {
          isMatch = submittedNote.pitchClass === currentNote.pitchClass;
        } else {
          isMatch =
            submission.letter === currentNote.letter &&
            submission.accidental === currentNote.accidental;
        }
      }

      const now = performance.now();
      const reactionMs = Math.round(now - noteAppearedAtRef.current);

      if (isMatch) {
        audioEngine.playCorrectFeedback(currentNote.frequency);
        setFeedbackState('correct');

        const firstTry = !hadMistakeOnCurrentNote;
        const nextCompletedCount = notesCompleted + 1;
        const nextCorrectCount = correctFirstTryCount + (firstTry ? 1 : 0);
        const nextStreak = firstTry ? currentStreak + 1 : 1;
        const multiplier = Math.min(4, 1 + Math.floor(nextStreak / 5));
        const speedBonus = firstTry
          ? Math.max(10, Math.round((2500 - Math.min(2200, reactionMs)) / 25))
          : 10;
        const pointsEarned = (firstTry ? 100 : 25) * multiplier + speedBonus;

        const nextScore = score + pointsEarned;
        const nextTotalReaction = sessionReactionTotalMs + Math.min(reactionMs, 10000);

        setNotesCompleted(nextCompletedCount);
        setCorrectFirstTryCount(nextCorrectCount);
        setCurrentStreak(nextStreak);
        setBestSessionStreak((prev) => Math.max(prev, nextStreak));
        setScore(nextScore);
        setLastReactionMs(reactionMs);
        setSessionReactionTotalMs(nextTotalReaction);

        setProgress((prev) => recordNoteAttempt(prev, currentNote.id, firstTry, reactionMs));

        const isTwentyNoteMode = sessionMode === 'campaign' || sessionMode === 'weak_notes';
        if (isTwentyNoteMode && nextCompletedCount >= CAMPAIGN_TOTAL_NOTES) {
          transitionTimeoutRef.current = window.setTimeout(() => {
            const finalAccuracy = Math.round((nextCorrectCount / CAMPAIGN_TOTAL_NOTES) * 100);
            const avgMs = Math.round(nextTotalReaction / CAMPAIGN_TOTAL_NOTES);
            const finalNpm = avgMs > 0 ? Math.round(60000 / avgMs) : 0;

            if (sessionMode === 'campaign') {
              setProgress((prev) => {
                const res = recordLevelCompletion(
                  prev,
                  selectedLevel.id,
                  finalAccuracy,
                  finalNpm,
                  nextScore,
                  selectedLevel.targetSpeedMs,
                  avgMs
                );
                setEarnedStarsOnFinish(res.earnedStars);
                setNewlyUnlockedId(res.newlyUnlockedLevelId);
                return res.nextState;
              });
            } else {
              setEarnedStarsOnFinish(finalAccuracy >= 80 ? 3 : 1);
            }

            setSessionFinished(true);
            audioEngine.playLevelCompleteFanfare(finalAccuracy >= 80);
          }, 340);
          return;
        }

        transitionTimeoutRef.current = window.setTimeout(() => {
          const lastInQueue = noteQueue[noteQueue.length - 1] || currentNote;
          const { chosen, nextDueList } = pickNextNote(
            sessionPoolIds,
            lastInQueue.id,
            spacedRepetitionDue
          );

          setSpacedRepetitionDue(nextDueList);
          setNoteQueue((prev) => [...prev.slice(1), chosen]);
          setFeedbackState('idle');
          setHadMistakeOnCurrentNote(false);
          noteAppearedAtRef.current = performance.now();
        }, 280);
      } else {
        audioEngine.playWrongFeedback();
        setFeedbackState('wrong');
        setHadMistakeOnCurrentNote(true);
        setCurrentStreak(0);

        setSessionMissedMap((prev) => ({
          ...prev,
          [currentNote.id]: (prev[currentNote.id] || 0) + 1,
        }));

        setSpacedRepetitionDue((prev) => [
          ...prev,
          { noteId: currentNote.id, turnsRemaining: 2 },
          { noteId: currentNote.id, turnsRemaining: 4 },
        ]);
      }
    },
    [
      sessionFinished,
      feedbackState,
      currentNote,
      hadMistakeOnCurrentNote,
      notesCompleted,
      correctFirstTryCount,
      currentStreak,
      score,
      sessionReactionTotalMs,
      sessionMode,
      selectedLevel,
      noteQueue,
      pickNextNote,
      sessionPoolIds,
      spacedRepetitionDue,
    ]
  );

  // Computer Keyboard Shortcut Listener (C, D, E, F, G, A, B) for Pitch Stage
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'trainer' || showGuideCard || sessionFinished) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toUpperCase();
      if (['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(key)) {
        e.preventDefault();
        handleAnswerSubmission({
          letter: key as NoteLetter,
          accidental:
            currentNote.letter === key && currentNote.accidental !== ''
              ? currentNote.accidental
              : '',
          checkOctave: false,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, showGuideCard, sessionFinished, handleAnswerSubmission, currentNote]);

  // Web MIDI API Live Keyboard Listener
  const submitRef = useRef(handleAnswerSubmission);
  useEffect(() => {
    submitRef.current = handleAnswerSubmission;
  }, [handleAnswerSubmission]);

  useEffect(() => {
    if (!('requestMIDIAccess' in navigator)) return;
    let midiAccessInstance: MIDIAccess | null = null;

    const handleMidiMessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 3) return;
      const status = data[0] & 0xf0;
      const midiNote = data[1];
      const velocity = data[2];

      if (status === 0x90 && velocity > 0) {
        // Dispatch Spacebar event if user is in Rhythm Trainer so MIDI keys trigger Rhythm Pad too!
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

        const matched = ALL_NOTES_LIST.find((n) => n.midi === midiNote);
        if (matched) {
          submitRef.current({
            letter: matched.letter,
            accidental: matched.accidental,
            midi: matched.midi,
            checkOctave: true,
          });
        }
      } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
      }
    };

    const updateInputs = (access: MIDIAccess) => {
      const names: string[] = [];
      access.inputs.forEach((input) => {
        if (input.name) names.push(input.name);
        input.onmidimessage = handleMidiMessage;
      });
      setMidiDevices(names);
    };

    navigator
      .requestMIDIAccess()
      .then((access) => {
        midiAccessInstance = access;
        updateInputs(access);
        access.onstatechange = () => updateInputs(access);
      })
      .catch(() => {
        // ignore if MIDI permission not granted
      });

    return () => {
      if (midiAccessInstance) {
        midiAccessInstance.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
      }
    };
  }, []);

  const sessionAccuracy =
    notesCompleted > 0 ? Math.round((correctFirstTryCount / notesCompleted) * 100) : 100;
  const sessionAvgMs =
    notesCompleted > 0 ? Math.round(sessionReactionTotalMs / notesCompleted) : 0;
  const sessionNpm = sessionAvgMs > 0 ? Math.round(60000 / sessionAvgMs) : 0;
  const currentMultiplier = Math.min(4, 1 + Math.floor(currentStreak / 5));

  const nextRecommendedLevel = useMemo(() => {
    for (const lvl of ALL_LEVELS) {
      const rec = progress.levelRecords[lvl.id];
      if (!rec || rec.stars === 0) return lvl;
    }
    return ALL_LEVELS[0];
  }, [progress.levelRecords]);

  const totalEarnedStars =
    Object.values(progress.levelRecords).reduce((s, r) => s + (r.stars || 0), 0) +
    Object.values(progress.rhythmRecords || {}).reduce((s, r) => s + (r.stars || 0), 0) +
    Object.values(progress.intervalRecords || {}).reduce((s, r) => s + (r.stars || 0), 0);
  const totalPossibleStars =
    (ALL_LEVELS.length + ALL_RHYTHM_LEVELS.length + ALL_INTERVAL_LEVELS.length) * 3;

  const currentPitchChapter =
    CURRICULUM_CHAPTERS[activePitchChapterIdx] || CURRICULUM_CHAPTERS[0];

  return (
    <div
      className="h-dvh flex flex-col bg-[#FAF8F5] text-slate-900 overflow-hidden"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* COMPACT MOBILE-FIT TOP STATUS & UTILITY BAR */}
      <header className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border-b border-slate-200">
        {/* Left/Start: Stars & Streak */}
        <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="tabular-nums">
              {totalEarnedStars}/{totalPossibleStars}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="tabular-nums">{progress.streakDays}d</span>
          </span>
        </div>

        {/* Right/End: Compact Action Pills (Unlock All, Mute, Language) */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const updated = {
                ...progress,
                unlockAllSandbox: !progress.unlockAllSandbox,
              };
              setProgress(updated);
              saveUserProgress(updated);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              progress.unlockAllSandbox
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            {progress.unlockAllSandbox ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lang === 'ar' ? 'مفتوح' : 'Unlocked'}</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>{lang === 'ar' ? 'فتح الكل' : 'Unlock All'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-600" />
            ) : (
              <Volume2 className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setLang((l) => (l === 'en' ? 'ar' : 'en'))}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-600" />
            <span>{lang === 'en' ? 'عربي' : 'EN'}</span>
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT AREA (FITS PHONE SCREEN CLEANLY) */}
      <main className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-5">
        {/* ================================================================= */}
        {/* TAB 0: ORGANIZED HOME SECTIONS HUB (FITS 100% ON A PHONE SCREEN)   */}
        {/* ================================================================= */}
        {activeTab === 'home' && (
          <div className="h-full flex flex-col justify-between gap-3">
            {/* Compact Continue Training Banner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-serif shrink-0 shadow-xs">
                  {nextRecommendedLevel.iconGlyph}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-indigo-600">
                    {lang === 'ar' ? 'التمرين التالي المقترح' : 'Next Recommended Exercise'}
                  </div>
                  <h1 className="text-sm sm:text-base font-bold font-display text-slate-900 truncate">
                    {lang === 'ar'
                      ? `${nextRecommendedLevel.levelNumber}: ${nextRecommendedLevel.titleAr}`
                      : `${nextRecommendedLevel.levelNumber}: ${nextRecommendedLevel.title}`}
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectCampaignLevel(nextRecommendedLevel.id, true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'شرح وبدء' : 'Lesson & Start'}</span>
              </button>
            </div>

            {/* 2x2 Grid of the 4 Main Sections (Fits Phone Screen Perfectly) */}
            <div className="grid grid-cols-2 gap-3 flex-1">
              {/* Section 1: Pitch Sight-Reading */}
              <button
                type="button"
                onClick={() => setActiveTab('campaign')}
                className="text-start p-4 rounded-2xl bg-white border-2 border-indigo-200 hover:border-indigo-500 transition-all cursor-pointer flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-serif shadow-xs">
                    𝄞
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {ALL_LEVELS.length} {lang === 'ar' ? 'تمارين' : 'Drills'}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-indigo-600">
                    {lang === 'ar' ? 'القسم الأول' : 'Section 1'}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    {lang === 'ar' ? 'قراءة النغمات' : 'Pitch Reading'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {lang === 'ar'
                      ? 'مفتاح صول 𝄞 ومفتاح فا 𝄢 والخطوط الإضافية'
                      : 'Treble, Bass, Ledger Lines & Keys'}
                  </div>
                </div>
              </button>

              {/* Section 2: Interval Training */}
              <button
                type="button"
                onClick={() => {
                  setActiveIntervalLevelId(null);
                  setActiveTab('intervals');
                }}
                className="text-start p-4 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-500 transition-all cursor-pointer flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg font-serif shadow-xs">
                    𝄞𝄢
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {ALL_INTERVAL_LEVELS.length} {lang === 'ar' ? 'تمارين' : 'Drills'}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-emerald-700">
                    {lang === 'ar' ? 'القسم الثاني' : 'Section 2'}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    {lang === 'ar' ? 'تدريب الأبعاد' : 'Intervals'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {lang === 'ar'
                      ? 'المسافات اللحنية من الثانية حتى الأوكتاف'
                      : '2nds, 3rds, 4ths, 5ths & Octaves'}
                  </div>
                </div>
              </button>

              {/* Section 3: Rhythm Reading Trainer */}
              <button
                type="button"
                onClick={() => setActiveTab('rhythm')}
                className="text-start p-4 rounded-2xl bg-white border-2 border-amber-200 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl font-serif shadow-xs">
                    ♫
                  </div>
                  <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                    {ALL_RHYTHM_LEVELS.length} {lang === 'ar' ? 'تمارين' : 'Drills'}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-amber-700">
                    {lang === 'ar' ? 'القسم الثالث' : 'Section 3'}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    {lang === 'ar' ? 'قراءة الإيقاع' : 'Rhythm Trainer'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {lang === 'ar'
                      ? 'النوار والبلانش والكروش والسكتات مع المترونوم'
                      : 'Pulse, Subdivisions, Rests & Metronome'}
                  </div>
                </div>
              </button>

              {/* Section 4: Custom Practice Mode */}
              <button
                type="button"
                onClick={() => setActiveTab('sandbox')}
                className="text-start p-4 rounded-2xl bg-white border-2 border-violet-200 hover:border-violet-500 transition-all cursor-pointer flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center text-lg font-serif shadow-xs">
                    ♯♭
                  </div>
                  <span className="text-[11px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md">
                    {lang === 'ar' ? 'حر' : 'Custom'}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-xs font-bold text-violet-700">
                    {lang === 'ar' ? 'القسم الرابع' : 'Section 4'}
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    {lang === 'ar' ? 'التمرين المخصص' : 'Custom Arcade'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {lang === 'ar'
                      ? 'اختر المفتاح والمجال الصوتي والمؤقت بحرية'
                      : 'Choose Clef, Note Range & Timer'}
                  </div>
                </div>
              </button>
            </div>

            {/* Bottom Compact Card: Analytics & Weak Notes */}
            <button
              type="button"
              onClick={() => setActiveTab('progress')}
              className="w-full p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                </div>
                <div className="text-start min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {lang === 'ar'
                      ? 'سجل التقدم وخريطة النغمات الضعيفة'
                      : 'Progress & Weakest Notes Heatmap'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {lang === 'ar'
                      ? 'راجع إحصائياتك وتدرب على النغمات التي أخطأت بها'
                      : 'Review accuracy stats and practice weak notes'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: PITCH CURRICULUM (ORGANIZED BY CHAPTER TABS FOR PHONE FIT) */}
        {/* ================================================================= */}
        {activeTab === 'campaign' && (
          <div className="space-y-3.5">
            {/* Compact Top Section Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-serif shrink-0">
                  {currentPitchChapter.iconGlyph}
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-bold font-display text-slate-900 truncate">
                    {lang === 'ar' ? 'قسم قراءة النغمات' : 'Pitch Sight-Reading'}
                  </h1>
                  <p className="text-xs text-slate-500 truncate">
                    {lang === 'ar'
                      ? 'اختر الفصل ثم اضغط (شرح) أو (ابدأ) لأي تمرين'
                      : 'Select a chapter below, then open Lesson or Start Drill'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSelectCampaignLevel(nextRecommendedLevel.id, true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {lang === 'ar'
                    ? `تمرين ${nextRecommendedLevel.levelNumber}`
                    : `Level ${nextRecommendedLevel.levelNumber}`}
                </span>
              </button>
            </div>

            {/* 4 Chapter Selector Tabs (No long vertical stacking!) */}
            <div className="grid grid-cols-4 gap-1.5 bg-slate-200/75 p-1 rounded-xl">
              {CURRICULUM_CHAPTERS.map((chap, idx) => {
                const isSelected = idx === activePitchChapterIdx;
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => setActivePitchChapterIdx(idx)}
                    className={`py-2 px-1.5 rounded-lg text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-indigo-950 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">
                      {lang === 'ar' ? `فصل ${chap.id}` : `Chap ${chap.id}`} {chap.iconGlyph}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {lang === 'ar' ? chap.badgeTextAr : chap.badgeText}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Chapter Title Strip */}
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {lang === 'ar' ? currentPitchChapter.titleAr : currentPitchChapter.title}
                </h2>
                <p className="text-xs text-slate-600 truncate">
                  {lang === 'ar' ? currentPitchChapter.subtitleAr : currentPitchChapter.subtitle}
                </p>
              </div>
              <span className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-100 shrink-0">
                {currentPitchChapter.levels.length} {lang === 'ar' ? 'تمارين' : 'Drills'}
              </span>
            </div>

            {/* Compact Exercise Cards for ONLY the Active Chapter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {currentPitchChapter.levels.map((lvl) => {
                const isUnlocked =
                  progress.unlockAllSandbox || progress.unlockedLevels.includes(lvl.id);
                const rec = progress.levelRecords[lvl.id];
                const stars = rec?.stars || 0;

                return (
                  <div
                    key={lvl.id}
                    className={`rounded-2xl border p-3.5 transition-all duration-150 flex flex-col justify-between gap-2.5 ${
                      isUnlocked
                        ? 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                        : 'bg-slate-50/80 border-slate-200/70 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-700 flex items-center justify-center text-lg font-serif shrink-0">
                          {lvl.iconGlyph}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 font-bold">
                            <span>
                              {lang === 'ar'
                                ? `تمرين ${lvl.levelNumber}`
                                : `Level ${lvl.levelNumber}`}
                            </span>
                            <span>·</span>
                            <span className="text-slate-500 font-normal truncate">
                              {lang === 'ar' ? lvl.subtitleAr : lvl.subtitle}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                            {lang === 'ar' ? lvl.titleAr : lvl.title}
                          </h3>
                          <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                            {lang === 'ar' ? lvl.mnemonicAr : lvl.mnemonic}
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
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        {lvl.notes.slice(0, 5).join(', ')}
                        {lvl.notes.length > 5 ? ` +${lvl.notes.length - 5}` : ''}
                        {rec && (
                          <span className="ms-1.5 font-semibold text-emerald-700 tabular-nums">
                            ({rec.bestAccuracy}%)
                          </span>
                        )}
                      </div>

                      {isUnlocked ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSelectCampaignLevel(lvl.id, true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold transition-colors cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{lang === 'ar' ? 'شرح' : 'Lesson'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectCampaignLevel(lvl.id, false)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{lang === 'ar' ? 'ابدأ' : 'Start'}</span>
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                          <Lock className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'مغلق' : 'Locked'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: INTERACTIVE PITCH SIGHT-READING STAGE                      */}
        {/* ================================================================= */}
        {activeTab === 'trainer' && (
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span className="capitalize">{sessionClef} Clef</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {sessionMode === 'campaign'
                      ? 'Campaign 20-Note Drill'
                      : sessionMode === 'weak_notes'
                      ? 'Adaptive Remedial Drill'
                      : 'Custom Sandbox'}
                  </span>
                  {sessionMode === 'campaign' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setShowGuideCard(true)}
                        className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                      >
                        View Guide Notes
                      </button>
                    </>
                  )}
                </div>
                <h1 className="text-lg sm:text-xl font-bold font-display text-slate-900">
                  {sessionTitle}
                </h1>
              </div>

              <div className="grid grid-cols-5 gap-3 sm:gap-5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                <div>
                  <div className="text-[11px] font-medium text-slate-500">
                    {remainingSeconds !== null ? 'Time Left' : 'Progress'}
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums">
                    {remainingSeconds !== null
                      ? `${Math.floor(remainingSeconds / 60)}:${String(
                          remainingSeconds % 60
                        ).padStart(2, '0')}`
                      : sessionMode === 'sandbox'
                      ? `${notesCompleted} Notes`
                      : `${notesCompleted} / ${CAMPAIGN_TOTAL_NOTES}`}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500">Accuracy</div>
                  <div
                    className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                      sessionAccuracy >= 80 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {sessionAccuracy}%
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500">Speed</div>
                  <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums">
                    {lastReactionMs !== null ? `${lastReactionMs}ms` : '—'}
                    {sessionNpm > 0 && (
                      <span className="hidden sm:inline text-xs font-normal text-slate-500 ml-1">
                        ({sessionNpm} NPM)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500">Streak</div>
                  <div className="text-sm sm:text-base font-bold font-mono text-indigo-700 tabular-nums">
                    {currentStreak}x{' '}
                    <span className="text-xs text-slate-500">({currentMultiplier}x)</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-500">Score</div>
                  <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums">
                    {score.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {(sessionMode === 'campaign' || sessionMode === 'weak_notes') && (
              <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-200"
                  style={{
                    width: `${Math.min(100, (notesCompleted / CAMPAIGN_TOTAL_NOTES) * 100)}%`,
                  }}
                />
              </div>
            )}

            {/* Collapsible Step-by-Step Exercise Explanation on the Pitch Stage */}
            {sessionMode === 'campaign' && (
              <ExerciseLessonCard
                lang={lang}
                levelNumber={selectedLevel.levelNumber}
                titleEn={selectedLevel.title}
                titleAr={selectedLevel.titleAr}
                descriptionEn={selectedLevel.description}
                descriptionAr={selectedLevel.descriptionAr}
                mnemonicEn={selectedLevel.mnemonic}
                mnemonicAr={selectedLevel.mnemonicAr}
                stepsEn={selectedLevel.lessonStepsEn}
                stepsAr={selectedLevel.lessonStepsAr}
                accentColor="indigo"
                defaultExpanded={false}
              />
            )}

            {!sessionFinished ? (
              <>
                <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-5 shadow-xs">
                  <StaffRenderer
                    clef={sessionClef}
                    keySignature={sessionKeySig}
                    activeNote={currentNote}
                    feedbackState={feedbackState}
                    showNoteLabelOnWrong={true}
                    labelFormat={labelFormat}
                    upcomingNotes={upcomingNotes}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 text-xs text-slate-500">
                    <span>
                      {sessionMode === 'campaign'
                        ? selectedLevel.mnemonic
                        : 'Identify the highlighted dark note on the left of the staff.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => audioEngine.playPianoNote(currentNote.frequency, 0.85, 0.25)}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Audition Note Pitch</span>
                    </button>
                  </div>
                </div>

                <InputDeck
                  inputMethod={inputMethod}
                  onChangeInputMethod={setInputMethod}
                  labelFormat={labelFormat}
                  onChangeLabelFormat={setLabelFormat}
                  showPianoHints={showPianoHints}
                  onTogglePianoHints={() => setShowPianoHints((h) => !h)}
                  clef={sessionClef}
                  hasAccidentals={hasAccidentalsInSession}
                  targetNote={currentNote}
                  feedbackState={feedbackState}
                  onSubmitAnswer={handleAnswerSubmission}
                  midiConnectedDevices={midiDevices}
                />
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto text-center space-y-6 shadow-xs">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={`w-10 h-10 transition-transform duration-200 ${
                        earnedStarsOnFinish >= s
                          ? 'text-amber-400 fill-amber-400 scale-105'
                          : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-indigo-600">
                    {sessionAccuracy >= 80
                      ? 'Stage Mastered (≥80% Accuracy)'
                      : 'Keep Practicing to Reach 80% Accuracy'}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-900">
                    {sessionTitle} Complete
                  </h2>
                  {newlyUnlockedId && (
                    <p className="text-sm font-semibold text-emerald-700">
                      ✓ Unlocked Level {newlyUnlockedId}!
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs text-slate-500">Accuracy</div>
                    <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      {sessionAccuracy}%
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs text-slate-500">Reading Speed</div>
                    <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      {sessionNpm} NPM
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs text-slate-500">Avg Reaction</div>
                    <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                      {sessionAvgMs} ms
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs text-slate-500">Final Score</div>
                    <div className="text-xl font-bold font-mono text-indigo-700 tabular-nums">
                      {score.toLocaleString()}
                    </div>
                  </div>
                </div>

                {Object.keys(sessionMissedMap).length > 0 && (
                  <div className="text-left p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                    <div className="text-xs font-bold text-amber-900">
                      Notes Reinforced via Adaptive Spaced Repetition:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(sessionMissedMap).map(([nId, count]) => {
                        const n = getNoteById(nId);
                        return (
                          <span
                            key={nId}
                            className="text-xs font-mono font-semibold text-amber-950"
                          >
                            {n.displayLabel} ({n.solfegeLabel}): {count} missed
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      startSession({
                        mode: sessionMode,
                        title: sessionTitle,
                        clef: sessionClef,
                        keySignature: sessionKeySig,
                        poolIds: sessionPoolIds,
                        timerSeconds:
                          sessionMode === 'sandbox' && sandboxTimerOption > 0
                            ? sandboxTimerOption
                            : null,
                        level: selectedLevel,
                      })
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Replay Drill</span>
                  </button>

                  {sessionMode === 'campaign' && (
                    <button
                      type="button"
                      onClick={() => {
                        const curIdx = ALL_LEVELS.findIndex((l) => l.id === selectedLevel.id);
                        const nextLvl =
                          curIdx >= 0 && curIdx + 1 < ALL_LEVELS.length
                            ? ALL_LEVELS[curIdx + 1]
                            : ALL_LEVELS[0];
                        handleSelectCampaignLevel(nextLvl.id, true);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      <span>Next Level</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('campaign')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <span>All Levels</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: RHYTHM READING TRAINER MODULE (تدريب قراءة الإيقاع)        */}
        {/* ================================================================= */}
        {activeTab === 'rhythm' && (
          <RhythmTrainerView
            progress={progress}
            lang={lang}
            onCompleteRhythmLevel={(
              rhythmLevelId,
              accuracy,
              bpm,
              rScore,
              evaluatedCount,
              goodCount
            ) => {
              let earnedStars = 0;
              let newlyUnlockedRhythmId: string | null = null;
              setProgress((prev) => {
                const res = recordRhythmCompletion(
                  prev,
                  rhythmLevelId,
                  accuracy,
                  bpm,
                  rScore,
                  evaluatedCount,
                  goodCount
                );
                earnedStars = res.earnedStars;
                newlyUnlockedRhythmId = res.newlyUnlockedRhythmId;
                return res.nextState;
              });
              return { earnedStars, newlyUnlockedRhythmId };
            }}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 3B: INTERVAL TRAINING MODULE (تدريب المسافات والأبعاد اللحنية) */}
        {/* ================================================================= */}
        {activeTab === 'intervals' && (
          <IntervalTrainerView
            progress={progress}
            lang={lang}
            initialLevelId={activeIntervalLevelId}
            onCompleteIntervalLevel={(intervalLevelId, accuracy, iScore) => {
              let earnedStars = 0;
              let newlyUnlockedIntervalId: string | null = null;
              setProgress((prev) => {
                const res = recordIntervalCompletion(
                  prev,
                  intervalLevelId,
                  accuracy,
                  iScore
                );
                earnedStars = res.earnedStars;
                newlyUnlockedIntervalId = res.newlyUnlockedIntervalId;
                return res.nextState;
              });
              return { earnedStars, newlyUnlockedIntervalId };
            }}
          />
        )}

        {/* ================================================================= */}
        {/* TAB 4: CUSTOM PRACTICE MODE (SANDBOX CONFIGURATOR)                */}
        {/* ================================================================= */}
        {activeTab === 'sandbox' && (
          <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4">
              <div className="text-xs font-semibold text-indigo-600">
                Configurable Sight-Reading Sandbox
              </div>
              <h1 className="text-2xl font-bold font-display text-slate-900 mt-0.5">
                Custom Practice Mode
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Tailor your clef, pitch range (G2 to C6), chromatic accidentals, and session timer.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  1. Select Clef
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSandboxClef('treble');
                      setSandboxLowStep(0);
                      setSandboxHighStep(10);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      sandboxClef === 'treble'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold">Treble Clef (G)</div>
                    <div className="text-xs text-slate-500 mt-0.5">Right hand / Upper register</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSandboxClef('bass');
                      setSandboxLowStep(-10);
                      setSandboxHighStep(0);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      sandboxClef === 'bass'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold">Bass Clef (F)</div>
                    <div className="text-xs text-slate-500 mt-0.5">Left hand / Lower register</div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  2. Chromatic Accidentals (♯ / ♭)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSandboxAccidentals(false)}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      !sandboxAccidentals
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold">Naturals Only</div>
                    <div className="text-xs text-slate-500 mt-0.5">White keys (C D E F G A B)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSandboxAccidentals(true)}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      sandboxAccidentals
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold">Sharps & Flats On</div>
                    <div className="text-xs text-slate-500 mt-0.5">Includes ♯ and ♭ notes</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  3. Note Range (G2 to C6)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSandboxClef('treble');
                      setSandboxLowStep(0);
                      setSandboxHighStep(4);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    C4–G4 Pentascale
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSandboxClef('treble');
                      setSandboxLowStep(-2);
                      setSandboxHighStep(14);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    Full Treble (A3–C6)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSandboxClef('bass');
                      setSandboxLowStep(-10);
                      setSandboxHighStep(0);
                    }}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    Full Bass (G2–C4)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Lowest Note</label>
                  <select
                    value={sandboxLowStep}
                    onChange={(e) => setSandboxLowStep(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-900"
                  >
                    {NATURAL_NOTES_LIST.map((n) => (
                      <option key={n.id} value={n.diatonicStep}>
                        {n.displayLabel} ({n.solfegeLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Highest Note</label>
                  <select
                    value={sandboxHighStep}
                    onChange={(e) => setSandboxHighStep(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-mono font-semibold text-slate-900"
                  >
                    {NATURAL_NOTES_LIST.map((n) => (
                      <option key={n.id} value={n.diatonicStep}>
                        {n.displayLabel} ({n.solfegeLabel})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-700">
                4. Session Timer Mode
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { val: 60 as TimerOption, label: '1 Minute', sub: '60s Speed Sprint' },
                  { val: 180 as TimerOption, label: '3 Minutes', sub: '180s Endurance' },
                  { val: 0 as TimerOption, label: 'Endless Mode', sub: 'No Time Limit' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setSandboxTimerOption(opt.val)}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      sandboxTimerOption === opt.val
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleStartSandboxSession}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Launch Custom Practice</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: MY PROGRESS & WEAKEST NOTES HEATMAP DASHBOARD              */}
        {/* ================================================================= */}
        {activeTab === 'progress' && (
          <AnalyticsDashboard
            progress={progress}
            lang={lang}
            onPracticeWeakNotes={handleStartWeakNotesPractice}
            onSelectLevel={(lvlId) => handleSelectCampaignLevel(lvlId, true)}
            onSelectRhythmLevel={() => setActiveTab('rhythm')}
            onResetProgress={() => {
              const fresh = { ...defaultProgressState };
              setProgress(fresh);
              saveUserProgress(fresh);
            }}
          />
        )}
      </main>

      {/* =================================================================== */}
      {/* FIXED BOTTOM NAVIGATION BAR (NATIVE PHONE APP SECTIONS)             */}
      {/* =================================================================== */}
      <nav className="shrink-0 bg-white border-t border-slate-200 px-2 py-1.5">
        <div className="max-w-lg mx-auto grid grid-cols-5 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'home'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="text-[11px] mt-0.5">{lang === 'ar' ? 'الأقسام' : 'Sections'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('campaign')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'campaign' || activeTab === 'trainer'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <span className="text-base leading-none font-serif">𝄞</span>
            <span className="text-[11px] mt-0.5">{lang === 'ar' ? 'النغمات' : 'Pitch'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveIntervalLevelId(null);
              setActiveTab('intervals');
            }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'intervals'
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <GitCommitHorizontal className="w-4 h-4" />
            <span className="text-[11px] mt-0.5">{lang === 'ar' ? 'الأبعاد' : 'Intervals'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rhythm')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'rhythm'
                ? 'bg-amber-50 text-amber-800 font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Drum className="w-4 h-4" />
            <span className="text-[11px] mt-0.5">{lang === 'ar' ? 'الإيقاع' : 'Rhythm'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('progress')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'progress' || activeTab === 'sandbox'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <Star className="w-4 h-4" />
            <span className="text-[11px] mt-0.5">{lang === 'ar' ? 'تقدمي' : 'Progress'}</span>
          </button>
        </div>
      </nav>

      {/* =================================================================== */}
      {/* PRE-LEVEL GUIDE CARD MODAL (Interactive Visual & Audio Lesson)      */}
      {/* =================================================================== */}
      {showGuideCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-xl my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-serif shrink-0">
                  {selectedLevel.iconGlyph}
                </div>
                <div>
                  <div className="text-xs font-semibold text-indigo-600">
                    {lang === 'ar'
                      ? `الدرس النظري وشرح التمرين · المستوى ${selectedLevel.levelNumber}`
                      : `Pre-Exercise Lesson & Guide · Level ${selectedLevel.levelNumber}`}
                  </div>
                  <h2 className="text-2xl font-bold font-display text-slate-900 mt-0.5">
                    {lang === 'ar' ? selectedLevel.titleAr : selectedLevel.title}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {lang === 'ar' ? selectedLevel.descriptionAr : selectedLevel.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideCard(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>

            {/* Step-by-Step Pedagogical Explanation Cards */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-800">
                {lang === 'ar'
                  ? 'خطوات فهم وأداء هذا التمرين (Step-by-Step Explanation):'
                  : 'How to Master This Exercise (Step-by-Step):'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(lang === 'ar'
                  ? selectedLevel.lessonStepsAr
                  : selectedLevel.lessonStepsEn
                ).map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                  >
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-mono">
                        {idx + 1}
                      </span>
                      <span>{lang === 'ar' ? `الخطوة ${idx + 1}` : `Step ${idx + 1}`}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>
                  {lang === 'ar'
                    ? 'اضغط على أي نغمة على المدرج أدناه لسماع صوتها الحقيقي على البيانو:'
                    : 'Click any note on the staff below to hear its exact piano pitch:'}
                </span>
                <span className="text-indigo-600">
                  {selectedLevel.newNotes.length}{' '}
                  {lang === 'ar' ? 'نغمات مستهدفة' : 'Focus Notes'}
                </span>
              </div>

              <StaffRenderer
                clef={selectedLevel.clef}
                keySignature={selectedLevel.keySignature}
                guideNotes={selectedLevel.notes.slice(0, 8).map((id) => getNoteById(id))}
                highlightedGuideNoteId={highlightedGuideNoteId}
                onClickGuideNote={(note) => {
                  setHighlightedGuideNoteId(note.id);
                  audioEngine.playPianoNote(note.frequency, 0.9, 0.3);
                }}
              />
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-indigo-950">
                  {lang === 'ar'
                    ? 'القاعدة الذهبية للحفظ السريع (Landmark Rule)'
                    : 'Sight-Reading Landmark Tip'}
                </div>
                <div className="text-sm text-indigo-900">
                  {lang === 'ar' ? selectedLevel.mnemonicAr : selectedLevel.mnemonic}
                </div>
              </div>
              <div className="text-xs font-mono text-indigo-700 shrink-0">
                {lang === 'ar' ? 'الهدف: دقة ≥80% (20 نغمة)' : 'Goal: ≥80% (20 Notes)'}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowGuideCard(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {lang === 'ar' ? 'العودة للمنهج' : 'Back to Curriculum'}
              </button>
              <button
                type="button"
                onClick={() => handleSelectCampaignLevel(selectedLevel.id, false)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {lang === 'ar' ? 'ابدأ تمرين الـ 20 نغمة الآن' : 'Start 20-Note Session'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
