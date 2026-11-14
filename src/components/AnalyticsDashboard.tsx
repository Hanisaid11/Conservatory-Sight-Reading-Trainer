import React from 'react';
import {
  ALL_LEVELS,
  ALL_NOTES_LIST,
  getNoteById,
  NoteSpec,
} from '../data/curriculum';
import { ALL_RHYTHM_LEVELS } from '../data/rhythmCurriculum';
import { UserProgressState } from '../services/storageService';
import { Play, RotateCcw, Star, Award, Flame, Clock, Target, Drum } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface AnalyticsDashboardProps {
  progress: UserProgressState;
  lang?: 'en' | 'ar';
  onPracticeWeakNotes: (weakNoteIds: string[]) => void;
  onSelectLevel: (levelId: string) => void;
  onSelectRhythmLevel?: (rhythmLevelId: string) => void;
  onResetProgress: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  progress,
  lang = 'en',
  onPracticeWeakNotes,
  onSelectLevel,
  onSelectRhythmLevel,
  onResetProgress,
}) => {
  const overallAccuracy =
    progress.totalNotesAnswered > 0
      ? Math.round((progress.totalCorrectNotes / progress.totalNotesAnswered) * 100)
      : 0;

  const avgReactionMs =
    progress.totalNotesAnswered > 0
      ? Math.round(progress.totalReactionMs / progress.totalNotesAnswered)
      : 0;

  const avgNpm = avgReactionMs > 0 ? Math.round(60000 / avgReactionMs) : 0;

  const pitchStarsEarned = Object.values(progress.levelRecords).reduce(
    (sum, r) => sum + (r.stars || 0),
    0
  );
  const rhythmStarsEarned = Object.values(progress.rhythmRecords || {}).reduce(
    (sum, r) => sum + (r.stars || 0),
    0
  );
  const totalStarsEarned = pitchStarsEarned + rhythmStarsEarned;
  const maxStars = (ALL_LEVELS.length + ALL_RHYTHM_LEVELS.length) * 3;

  const rhythmAccuracy =
    progress.totalRhythmNotesEvaluated > 0
      ? Math.round(
          (progress.totalRhythmPerfectOrGood / progress.totalRhythmNotesEvaluated) * 100
        )
      : 0;

  // Compute sorted weak notes based on historical mistake rate & latency
  const trackedNotes = Object.values(progress.noteStats)
    .filter((stat) => stat.seen > 0)
    .map((stat) => {
      const note = getNoteById(stat.noteId);
      const errorRate = stat.mistakes / stat.seen;
      const accuracy = Math.round((stat.correct / stat.seen) * 100);
      const avgMs = Math.round(stat.totalReactionMs / stat.seen);
      const weaknessScore = errorRate * 100 + Math.max(0, (avgMs - 1100) / 50);
      return {
        ...stat,
        note,
        errorRate,
        accuracy,
        avgMs,
        weaknessScore,
      };
    })
    .sort((a, b) => b.weaknessScore - a.weaknessScore);

  const weakNoteIds = trackedNotes
    .filter((n) => n.mistakes > 0 || n.avgMs > 1600)
    .slice(0, 6)
    .map((n) => n.noteId);

  const defaultFallbackWeakIds = ['F4', 'A4', 'E4', 'B4', 'D5', 'F3', 'G3'];
  const practiceTargetIds = weakNoteIds.length >= 2 ? weakNoteIds : defaultFallbackWeakIds;

  // Notes for the visual heatmap (Core concert range G2 to C6)
  const heatmapNotes: NoteSpec[] = ALL_NOTES_LIST.filter(
    (n) => n.accidental === '' || ['C#4', 'Eb4', 'F#4', 'G#4', 'Bb4', 'F#5'].includes(n.id)
  );

  return (
    <div className="space-y-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>{lang === 'ar' ? 'دقة قراءة النغمات' : 'Pitch Accuracy'}</span>
            <Target className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {progress.totalNotesAnswered > 0 ? `${overallAccuracy}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {progress.totalCorrectNotes} / {progress.totalNotesAnswered}{' '}
            {lang === 'ar' ? 'نغمة' : 'notes'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>{lang === 'ar' ? 'متوسط سرعة الاستجابة' : 'Avg Pitch Speed'}</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {avgReactionMs > 0 ? `${avgReactionMs} ms` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {avgNpm > 0
              ? `${avgNpm} NPM`
              : lang === 'ar'
              ? 'أكمل تمريناً للقياس'
              : 'Complete a drill'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>{lang === 'ar' ? 'دقة قراءة الإيقاع' : 'Rhythm Accuracy'}</span>
            <Drum className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {progress.totalRhythmNotesEvaluated > 0 ? `${rhythmAccuracy}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {progress.totalRhythmNotesEvaluated}{' '}
            {lang === 'ar' ? 'علامة إيقاعية' : 'rhythm notes graded'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>{lang === 'ar' ? 'مجموع النجوم' : 'Total Stars'}</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {totalStarsEarned} / {maxStars}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {lang === 'ar'
              ? `${pitchStarsEarned} نغمات · ${rhythmStarsEarned} إيقاع`
              : `${pitchStarsEarned} Pitch · ${rhythmStarsEarned} Rhythm`}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>{lang === 'ar' ? 'أيام التدريب المتتالية' : 'Practice Streak'}</span>
            <Flame className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-bold font-display text-slate-900 tabular-nums">
            {progress.streakDays}{' '}
            {lang === 'ar' ? 'يوم' : progress.streakDays === 1 ? 'Day' : 'Days'}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {lang === 'ar' ? 'حفظ تلقائي للتقدم' : 'Saved in localStorage'}
          </div>
        </div>
      </div>

      {/* Weakest Notes Heatmap Section */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold font-display text-slate-900">
              {lang === 'ar'
                ? 'خريطة النغمات الأضعف وتشخيص الأداء (Weakest Notes Heatmap)'
                : 'Weakest Notes Heatmap & Pitch Diagnostics'}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {lang === 'ar'
                ? 'اضغط على أي نغمة لسماع صوتها المرجعي، أو ابدأ تمريناً مكثفاً للنغمات الأكثر خطأً.'
                : 'Click any note card to audition its reference pitch, or launch a targeted remedial drill for your highest-error notes.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onPracticeWeakNotes(practiceTargetIds)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              {lang === 'ar'
                ? `تدرب على النغمات الضعيفة (${practiceTargetIds.length})`
                : `Practice Weak Notes (${practiceTargetIds.length})`}
            </span>
          </button>
        </div>

        {/* Complete Note Register Heatmap Grid */}
        <div className="space-y-3" dir="ltr">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Complete Register Breakdown (G2 – C6)</span>
            <div className="flex items-center gap-4">
              <span>● Solid (≥90%)</span>
              <span>◆ Moderate (75–89%)</span>
              <span>▲ Struggling (&lt;75%)</span>
              <span>○ Untested</span>
            </div>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-2">
            {heatmapNotes.map((note) => {
              const stat = progress.noteStats[note.id];
              const seen = stat?.seen || 0;
              const accuracy = seen > 0 ? Math.round((stat.correct / seen) * 100) : null;
              const avgMs = seen > 0 ? Math.round(stat.totalReactionMs / seen) : null;

              let cardClasses = 'bg-slate-50 border-slate-200 text-slate-600';
              let statusSymbol = '○';

              if (accuracy !== null) {
                if (accuracy >= 90) {
                  cardClasses = 'bg-emerald-50/90 border-emerald-200 text-emerald-950';
                  statusSymbol = '●';
                } else if (accuracy >= 75) {
                  cardClasses = 'bg-amber-50/90 border-amber-200 text-amber-950';
                  statusSymbol = '◆';
                } else {
                  cardClasses = 'bg-red-50/90 border-red-200 text-red-950';
                  statusSymbol = '▲';
                }
              }

              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => audioEngine.playPianoNote(note.frequency, 0.75, 0.25)}
                  className={`p-2.5 rounded-xl border text-left transition-transform active:scale-95 cursor-pointer ${cardClasses}`}
                  title={`Click to hear ${note.displayLabel} (${note.frequency} Hz)`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono">{note.displayLabel}</span>
                    <span className="text-[10px] font-mono">{statusSymbol}</span>
                  </div>
                  <div className="text-[11px] opacity-80 font-medium">{note.solfegeLabel}</div>
                  <div className="mt-1.5 text-[11px] font-mono font-semibold tabular-nums">
                    {accuracy !== null ? `${accuracy}%` : '—'}
                  </div>
                  <div className="text-[10px] font-mono opacity-75 tabular-nums">
                    {avgMs !== null ? `${avgMs}ms` : 'No data'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Two-Column Level Records: Pitch Levels & Rhythm Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pitch Curriculum Records */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-display text-slate-900">
              {lang === 'ar' ? 'سجل مستويات النغمات (Pitch Levels)' : 'Pitch Curriculum Records'}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-2">Level</th>
                  <th className="py-2.5 px-2">Stars</th>
                  <th className="py-2.5 px-2">Best</th>
                  <th className="py-2.5 pl-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ALL_LEVELS.map((lvl) => {
                  const rec = progress.levelRecords[lvl.id];
                  const isUnlocked =
                    progress.unlockAllSandbox || progress.unlockedLevels.includes(lvl.id);

                  return (
                    <tr key={lvl.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-slate-900">
                          {lvl.levelNumber}: {lvl.title}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                (rec?.stars || 0) >= s
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono tabular-nums text-xs text-slate-700">
                        {rec ? `${rec.bestAccuracy}%` : '—'}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => onSelectLevel(lvl.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            isUnlocked
                              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isUnlocked ? 'Play' : 'Locked'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rhythm Curriculum Records */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-display text-slate-900">
              {lang === 'ar'
                ? 'سجل مستويات الإيقاع (Rhythm Levels)'
                : 'Rhythm Curriculum Records'}
            </h2>

            <button
              type="button"
              onClick={onResetProgress}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-red-700 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{lang === 'ar' ? 'إعادة ضبط' : 'Reset'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-2">Level</th>
                  <th className="py-2.5 px-2">Stars</th>
                  <th className="py-2.5 px-2">Best</th>
                  <th className="py-2.5 pl-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ALL_RHYTHM_LEVELS.map((lvl) => {
                  const rec = progress.rhythmRecords?.[lvl.id];
                  const isUnlocked =
                    progress.unlockAllSandbox ||
                    progress.unlockedRhythmLevels?.includes(lvl.id);

                  return (
                    <tr key={lvl.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-slate-900">
                          {lvl.levelNumber}: {lang === 'ar' ? lvl.titleAr : lvl.titleEn}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                (rec?.stars || 0) >= s
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono tabular-nums text-xs text-slate-700">
                        {rec ? `${rec.bestAccuracy}%` : '—'}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => onSelectRhythmLevel?.(lvl.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            isUnlocked
                              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isUnlocked ? 'Play' : 'Locked'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
