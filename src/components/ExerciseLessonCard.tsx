import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Lightbulb, Sparkles, CheckCircle2 } from 'lucide-react';

interface ExerciseLessonCardProps {
  lang: 'en' | 'ar';
  levelNumber: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  mnemonicEn: string;
  mnemonicAr: string;
  stepsEn: string[];
  stepsAr: string[];
  defaultExpanded?: boolean;
  accentColor?: 'indigo' | 'emerald' | 'amber';
}

export const ExerciseLessonCard: React.FC<ExerciseLessonCardProps> = ({
  lang,
  levelNumber,
  titleEn,
  titleAr,
  descriptionEn,
  descriptionAr,
  mnemonicEn,
  mnemonicAr,
  stepsEn,
  stepsAr,
  defaultExpanded = true,
  accentColor = 'indigo',
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  const steps = lang === 'ar' ? stepsAr : stepsEn;
  const title = lang === 'ar' ? titleAr : titleEn;
  const description = lang === 'ar' ? descriptionAr : descriptionEn;
  const mnemonic = lang === 'ar' ? mnemonicAr : mnemonicEn;

  const badgeColors =
    accentColor === 'emerald'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : accentColor === 'amber'
      ? 'bg-amber-50 border-amber-200 text-amber-950'
      : 'bg-indigo-50 border-indigo-200 text-indigo-950';

  const iconColor =
    accentColor === 'emerald'
      ? 'text-emerald-600'
      : accentColor === 'amber'
      ? 'text-amber-600'
      : 'text-indigo-600';

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Collapsible Header Bar */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 bg-slate-50/80 hover:bg-slate-100/70 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${badgeColors}`}
          >
            <BookOpen className={`w-4 h-4 ${iconColor}`} />
          </div>
          <div className={lang === 'ar' ? 'text-right' : 'text-left'}>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
              <span>
                {lang === 'ar'
                  ? `شرح التمرين والدرس النظري (${levelNumber})`
                  : `Exercise Lesson & Theory Guide (${levelNumber})`}
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">{title}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0">
          <span>
            {expanded
              ? lang === 'ar'
                ? 'إخفاء الشرح'
                : 'Hide Lesson'
              : lang === 'ar'
              ? 'عرض شرح التمرين'
              : 'Show Lesson'}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Lesson Body */}
      {expanded && (
        <div className="p-4 sm:p-5 border-t border-slate-100 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">{description}</p>

          {/* Step-by-Step Pedagogical Instructions */}
          {steps.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {steps.map((stepText, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {lang === 'ar' ? `الخطوة ${idx + 1}` : `Step ${idx + 1}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{stepText}</p>
                </div>
              ))}
            </div>
          )}

          {/* Golden Rule / Mnemonic Callout */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${badgeColors}`}>
            <Lightbulb className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="text-xs leading-relaxed">
              <strong className="font-bold">
                {lang === 'ar' ? 'القاعدة الذهبية للتمرين: ' : 'Golden Sight-Reading Rule: '}
              </strong>
              <span>{mnemonic}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
