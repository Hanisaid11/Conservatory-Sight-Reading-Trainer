import { getNoteById, NATURAL_NOTES_LIST, NoteSpec } from './curriculum';

export type IntervalId =
  | '2nd'
  | '3rd'
  | '4th'
  | '5th'
  | '6th'
  | '7th'
  | '8ve'
  | 'm2'
  | 'M2'
  | 'm3'
  | 'M3'
  | 'P4'
  | 'P5'
  | 'M6'
  | 'M7'
  | 'P8';

export interface IntervalMeta {
  id: IntervalId;
  shortLabel: string;
  nameEn: string;
  nameAr: string;
  diatonicSteps: number; // 1 = 2nd, 2 = 3rd, 3 = 4th, 4 = 5th, 5 = 6th, 6 = 7th, 7 = 8ve
  semitones: number;
  visualRuleEn: string;
  visualRuleAr: string;
  songHintEn: string;
  songHintAr: string;
}

export interface GeneratedIntervalQuestion {
  id: string;
  note1: NoteSpec;
  note2: NoteSpec;
  direction: 'ascending' | 'descending';
  intervalId: IntervalId;
  diatonicDistance: number; // 2 to 8 (2nd to 8ve)
  semitoneDistance: number;
}

export interface IntervalLevel {
  id: string;
  chapterId: number;
  levelNumber: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  tipEn: string;
  tipAr: string;
  clef: 'treble' | 'bass';
  mode: 'generic_number' | 'specific_quality';
  allowedDirections: ('ascending' | 'descending')[];
  intervalPool: IntervalId[];
}

export interface IntervalChapter {
  id: number;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  badgeEn: string;
  badgeAr: string;
  levels: IntervalLevel[];
}

export const INTERVAL_META: Record<IntervalId, IntervalMeta> = {
  '2nd': {
    id: '2nd',
    shortLabel: '2nd',
    nameEn: '2nd (Step)',
    nameAr: 'البعد الثاني (درجة متتالية)',
    diatonicSteps: 1,
    semitones: 2,
    visualRuleEn: 'Line to adjacent Space (or Space to adjacent Line)',
    visualRuleAr: 'من خط إلى المسافة المجاورة مباشرة (أو العكس)',
    songHintEn: 'Scale step (Do → Re)',
    songHintAr: 'خطوة سلمية مباشرة (دو ← ري)',
  },
  '3rd': {
    id: '3rd',
    shortLabel: '3rd',
    nameEn: '3rd (Skip)',
    nameAr: 'البعد الثالث (قفزة ثالثة)',
    diatonicSteps: 2,
    semitones: 4,
    visualRuleEn: 'Line to next Line, or Space to next Space',
    visualRuleAr: 'من خط إلى الخط التالي مباشرة، أو من مسافة للمسافة التالية',
    songHintEn: 'Triad skip (Do → Mi)',
    songHintAr: 'قفزة تآلفية (دو ← مي)',
  },
  '4th': {
    id: '4th',
    shortLabel: '4th',
    nameEn: '4th',
    nameAr: 'البعد الرابع (رابعة)',
    diatonicSteps: 3,
    semitones: 5,
    visualRuleEn: 'Line to Space (skipping 1 line & 1 space)',
    visualRuleAr: 'من خط إلى مسافة (أو مسافة لخط) بعبور درجتين',
    songHintEn: 'Here Comes the Bride (Do → Fa)',
    songHintAr: 'مقدمة مارش الزفاف (دو ← فا)',
  },
  '5th': {
    id: '5th',
    shortLabel: '5th',
    nameEn: '5th',
    nameAr: 'البعد الخامس (خامسة)',
    diatonicSteps: 4,
    semitones: 7,
    visualRuleEn: 'Line to Line (skipping 1 middle line), or Space to Space',
    visualRuleAr: 'من خط إلى خط (بتخطي خط بالوسط) أو مسافة لمسافة',
    songHintEn: 'Twinkle Twinkle Little Star / Star Wars (Do → Sol)',
    songHintAr: 'لحن Twinkle Twinkle (دو ← صول)',
  },
  '6th': {
    id: '6th',
    shortLabel: '6th',
    nameEn: '6th',
    nameAr: 'البعد السادس (سادسة)',
    diatonicSteps: 5,
    semitones: 9,
    visualRuleEn: 'Wide Line-to-Space leap',
    visualRuleAr: 'قفزة واسعة من خط إلى مسافة (دو ← لا)',
    songHintEn: 'My Bonnie Lies Over the Ocean (Do → La)',
    songHintAr: 'قفزة السادسة اللحنية (دو ← لا)',
  },
  '7th': {
    id: '7th',
    shortLabel: '7th',
    nameEn: '7th',
    nameAr: 'البعد السابع (سابعة)',
    diatonicSteps: 6,
    semitones: 11,
    visualRuleEn: 'Wide Line-to-Line (skipping 2 lines) or Space-to-Space',
    visualRuleAr: 'قفزة واسعة من خط إلى خط (بتخطي خطين) أو مسافة لمسافة',
    songHintEn: 'One step shy of an Octave (Do → Si)',
    songHintAr: 'أقل من الأوكتاف بدرجة واحدة (دو ← سي)',
  },
  '8ve': {
    id: '8ve',
    shortLabel: '8ve',
    nameEn: 'Octave (8ve)',
    nameAr: 'الأوكتاف (البعد الثامن)',
    diatonicSteps: 7,
    semitones: 12,
    visualRuleEn: 'Line to Space (or Space to Line) spanning 8 letters',
    visualRuleAr: 'نفس اسم النغمة في الطبقة الأعلى أو الأدنى (خط لمسافة)',
    songHintEn: 'Somewhere Over the Rainbow (Do4 → Do5)',
    songHintAr: 'نفس النغمة في الأوكتاف المقابل (دو4 ← دو5)',
  },
  m2: {
    id: 'm2',
    shortLabel: 'm2',
    nameEn: 'Minor 2nd (Half Step)',
    nameAr: 'ثانية صغيرة (نصف بعد)',
    diatonicSteps: 1,
    semitones: 1,
    visualRuleEn: '1 semitone step (e.g., E→F, B→C, or with accidental)',
    visualRuleAr: 'نصف تون (مثل مي←فا أو سي←دو)',
    songHintEn: 'Jaws Theme (1 semitone)',
    songHintAr: 'نصف درجة كروماتية (١ سيميتون)',
  },
  M2: {
    id: 'M2',
    shortLabel: 'M2',
    nameEn: 'Major 2nd (Whole Step)',
    nameAr: 'ثانية كبيرة (بعد كامل)',
    diatonicSteps: 1,
    semitones: 2,
    visualRuleEn: '2 semitones step (e.g., C→D, F→G)',
    visualRuleAr: 'بعد كامل (٢ سيميتون مثل دو←ري)',
    songHintEn: 'Happy Birthday opening step',
    songHintAr: 'بداية لحن Happy Birthday',
  },
  m3: {
    id: 'm3',
    shortLabel: 'm3',
    nameEn: 'Minor 3rd',
    nameAr: 'ثالثة صغيرة (Minor 3rd)',
    diatonicSteps: 2,
    semitones: 3,
    visualRuleEn: 'Skip spanning 3 semitones (e.g., A→C, D→F, E→G)',
    visualRuleAr: 'قفزة ثالثة بمقدار ٣ أنصاف أبعاد (طابع شجي)',
    songHintEn: 'Greensleeves / Brahms Lullaby',
    songHintAr: 'لحن Greensleeves (طابع المينور)',
  },
  M3: {
    id: 'M3',
    shortLabel: 'M3',
    nameEn: 'Major 3rd',
    nameAr: 'ثالثة كبيرة (Major 3rd)',
    diatonicSteps: 2,
    semitones: 4,
    visualRuleEn: 'Skip spanning 4 semitones (e.g., C→E, F→A, G→B)',
    visualRuleAr: 'قفزة ثالثة بمقدار ٤ أنصاف أبعاد (طابع مشرق)',
    songHintEn: 'Oh When the Saints Go Marching In',
    songHintAr: 'تآلف الماجور المشرق (دو ← مي)',
  },
  P4: {
    id: 'P4',
    shortLabel: 'P4',
    nameEn: 'Perfect 4th',
    nameAr: 'رابعة تامة (Perfect 4th)',
    diatonicSteps: 3,
    semitones: 5,
    visualRuleEn: '5 semitones (Line to Space / Space to Line)',
    visualRuleAr: '٥ أنصاف أبعاد (خط إلى مسافة)',
    songHintEn: 'Here Comes the Bride / Amazing Grace',
    songHintAr: 'خمسة أنصاف أبعاد (دو ← فا)',
  },
  P5: {
    id: 'P5',
    shortLabel: 'P5',
    nameEn: 'Perfect 5th',
    nameAr: 'خامسة تامة (Perfect 5th)',
    diatonicSteps: 4,
    semitones: 7,
    visualRuleEn: '7 semitones (Line to Line / Space to Space)',
    visualRuleAr: '٧ أنصاف أبعاد (خط لخط أو مسافة لمسافة)',
    songHintEn: 'Star Wars Main Theme / Twinkle Twinkle',
    songHintAr: 'سبعة أنصاف أبعاد (دو ← صول)',
  },
  M6: {
    id: 'M6',
    shortLabel: 'M6',
    nameEn: 'Major 6th',
    nameAr: 'سادسة كبيرة (Major 6th)',
    diatonicSteps: 5,
    semitones: 9,
    visualRuleEn: '9 semitones wide leap',
    visualRuleAr: '٩ أنصاف أبعاد (دو ← لا)',
    songHintEn: 'My Bonnie Lies Over the Ocean / NBC Chime',
    songHintAr: 'تسعة أنصاف أبعاد (دو ← لا)',
  },
  M7: {
    id: 'M7',
    shortLabel: 'M7',
    nameEn: 'Major 7th',
    nameAr: 'سابعة كبيرة (Major 7th)',
    diatonicSteps: 6,
    semitones: 11,
    visualRuleEn: '11 semitones (1 half-step below Octave)',
    visualRuleAr: '١١ نصف بعد (قبل الأوكتاف بنصف درجة)',
    songHintEn: 'Take On Me (chorus leap)',
    songHintAr: 'أحد عشر نصف بعد (دو ← سي)',
  },
  P8: {
    id: 'P8',
    shortLabel: 'P8',
    nameEn: 'Perfect Octave',
    nameAr: 'أوكتاف تام (Perfect 8ve)',
    diatonicSteps: 7,
    semitones: 12,
    visualRuleEn: '12 semitones (8 letter names apart)',
    visualRuleAr: '١٢ نصف بعد (أوكتاف كامل)',
    songHintEn: 'Somewhere Over the Rainbow',
    songHintAr: 'الأوكتاف الكامل (١٢ سيميتون)',
  },
};

export const INTERVAL_CHAPTERS: IntervalChapter[] = [
  {
    id: 1,
    titleEn: 'Chapter 1: Visual Staff Distance (Steps, Skips & Leaps)',
    titleAr: 'الفصل الأول: المسافات البصرية على المدرج (الدرجات والقفزات)',
    subtitleEn:
      'Recognize harmonic and melodic distances instantly using Line-to-Line and Line-to-Space geometry.',
    subtitleAr:
      'تعرف على المسافة بين نغمتين متتاليتين بصرياً وسمعياً باستخدام قاعدة (خط-خط) و(خط-مسافة).',
    badgeEn: 'Visual Intervals',
    badgeAr: 'المسافات الدياتونية',
    levels: [
      {
        id: 'I1.1',
        chapterId: 1,
        levelNumber: 'I1.1',
        titleEn: 'Steps (2nds) vs. Skips (3rds)',
        titleAr: 'البعد الثاني (2nd) مقابل البعد الثالث (3rd)',
        subtitleEn: 'Adjacent Line-to-Space vs. Line-to-Line / Space-to-Space',
        subtitleAr: 'التمييز الفوري بين الخطوة المتتالية (2nd) والقفزة الثلاثية (3rd)',
        descriptionEn:
          'A 2nd moves from a Line to the very next Space (or Space to Line). A 3rd skips a step, moving Line-to-Line or Space-to-Space.',
        descriptionAr:
          'البعد الثاني ينتقل من خط إلى المسافة الملاصقة له، بينما البعد الثالث يقفز من خط إلى الخط التالي أو من مسافة إلى المسافة التالية.',
        tipEn: 'Same type (Line→Line or Space→Space) = Odd number (3rd)! Mixed = Even number (2nd)!',
        tipAr: 'من خط لخط أو مسافة لمسافة = رقم فردي (ثالثة 3rd)! من خط لمسافة = رقم زوجي (ثانية 2nd)!',
        clef: 'treble',
        mode: 'generic_number',
        allowedDirections: ['ascending', 'descending'],
        intervalPool: ['2nd', '3rd'],
      },
      {
        id: 'I1.2',
        chapterId: 1,
        levelNumber: 'I1.2',
        titleEn: 'Adding 4ths & 5ths (Core Landmarks)',
        titleAr: 'إضافة البعد الرابع (4th) والبعد الخامس (5th)',
        subtitleEn: 'Distinguishing 2nds, 3rds, 4ths, and 5ths on the Treble Staff',
        subtitleAr: 'قراءة وتمييز الأبعاد من الثانية حتى الخامسة صعوداً وهبوطاً',
        descriptionEn:
          'A 5th is an odd interval (Line-to-Line with 1 empty line between them, or Space-to-Space). A 4th is an even interval (Line-to-Space).',
        descriptionAr:
          'البعد الخامس فردي (من خط لخط مع ترك خط فارغ بينهما)، بينما البعد الرابع زوجي (من خط إلى مسافة أو العكس).',
        tipEn: 'Check symmetry first: Line-to-Line is ALWAYS a 3rd or 5th; Line-to-Space is a 2nd or 4th!',
        tipAr: 'افحص التماثل أولاً: خط-لخط يكون دائماً (3rd أو 5th)، وخط-لمسافة يكون (2nd أو 4th)!',
        clef: 'treble',
        mode: 'generic_number',
        allowedDirections: ['ascending', 'descending'],
        intervalPool: ['2nd', '3rd', '4th', '5th'],
      },
      {
        id: 'I1.3',
        chapterId: 1,
        levelNumber: 'I1.3',
        titleEn: 'Wide Leaps: 6ths, 7ths & Octaves (8ve)',
        titleAr: 'القفزات الواسعة: السادسة (6th) والسابعة (7th) والأوكتاف (8ve)',
        subtitleEn: 'Full diatonic interval recognition from 2nd up to Octave',
        subtitleAr: 'إتقان جميع المسافات الموسيقية من البعد الثاني حتى الأوكتاف الكامل',
        descriptionEn:
          'Expand your visual span to wide leaps: 6ths (Line-to-Space), 7ths (Line-to-Line skipping two lines), and Octaves (8ve).',
        descriptionAr:
          'وسّع مدى قراءتك البصرية والسمعية ليشمل السادسة والسابعة والأوكتاف التام.',
        tipEn: 'An Octave (8ve) is always one Line and one Space (e.g. Middle C4 line to C5 third space).',
        tipAr: 'الأوكتاف دائماً يربط بين خط ومسافة (مثل دو الوسطى على الخط الإضافي ودو العليا في المسافة الثالثة).',
        clef: 'treble',
        mode: 'generic_number',
        allowedDirections: ['ascending', 'descending'],
        intervalPool: ['2nd', '3rd', '4th', '5th', '6th', '7th', '8ve'],
      },
    ],
  },
  {
    id: 2,
    titleEn: 'Chapter 2: Ear & Staff Quality Mastery (Major, Minor & Perfect)',
    titleAr: 'الفصل الثاني: نوعية الأبعاد (الكبيرة والصغيرة والتامة)',
    subtitleEn:
      'Combine staff sight-reading with ear training to distinguish Minor vs. Major and Perfect intervals.',
    subtitleAr:
      'الربط بين القراءة البصرية والتمييز السمعي للأبعاد الصغيرة (Minor) والكبيرة (Major) والتامة (Perfect).',
    badgeEn: 'Ear + Eye Quality',
    badgeAr: 'الأبعاد التامة والكبيرة والصغيرة',
    levels: [
      {
        id: 'I2.1',
        chapterId: 2,
        levelNumber: 'I2.1',
        titleEn: 'Minor & Major 2nds and 3rds',
        titleAr: 'الثانية والثالثة الصغيرة والكبيرة (m2, M2, m3, M3)',
        subtitleEn: 'Half steps (m2), Whole steps (M2), Minor 3rds (m3) & Major 3rds (M3)',
        subtitleAr: 'التمييز الدقيق بين نصف البعد والبعد الكامل، والثالثة الحزينة والمشرقة',
        descriptionEn:
          'Count both staff steps and half-steps (semitones): m2 = 1 semitone (E–F, B–C), M2 = 2 semitones, m3 = 3 semitones (A–C, D–F), M3 = 4 semitones (C–E, F–A).',
        descriptionAr:
          'الثانية الصغيرة (نصف تون مثل مي-فا)، الثانية الكبيرة (تون كامل مثل دو-ري)، الثالثة الصغيرة (٣ أنصاف أبعاد)، والثالثة الكبيرة (٤ أنصاف أبعاد).',
        tipEn: 'Listen closely as the two notes play: M3 sounds bright and sunny; m3 sounds lyrical and minor.',
        tipAr: 'استمع جيداً للنغمتين المتتاليتين: الثالثة الكبيرة (M3) مشرقة، والثالثة الصغيرة (m3) شجية.',
        clef: 'treble',
        mode: 'specific_quality',
        allowedDirections: ['ascending', 'descending'],
        intervalPool: ['m2', 'M2', 'm3', 'M3'],
      },
      {
        id: 'I2.2',
        chapterId: 2,
        levelNumber: 'I2.2',
        titleEn: 'Bass Clef Intervals & Perfect Consonances',
        titleAr: 'أبعاد مفتاح فا والأبعاد التامة (P4, P5, P8)',
        subtitleEn: 'Reading intervals in Bass Clef from G2 to C4',
        subtitleAr: 'قراءة المسافات اللحنية على مدرج مفتاح فا في المنطقة الغليظة',
        descriptionEn:
          'Practice reading 2nds, 3rds, 4ths, 5ths, and Octaves on the Bass Clef staff while anchoring on F3 and G2.',
        descriptionAr:
          'تدرّب على تحديد المسافة بين نغمتين متتاليتين على مدرج مفتاح فا بدقة وسرعة.',
        tipEn: 'The Line-to-Line and Line-to-Space visual geometry works identically in Bass Clef!',
        tipAr: 'قواعد (خط-خط) و(خط-مسافة) تعمل بنفس الطريقة تماماً في مفتاح فا!',
        clef: 'bass',
        mode: 'generic_number',
        allowedDirections: ['ascending', 'descending'],
        intervalPool: ['2nd', '3rd', '4th', '5th', '8ve'],
      },
      {
        id: 'I2.3',
        chapterId: 2,
        levelNumber: 'I2.3',
        titleEn: 'Conservatory Interval Mastery (m2 to P8)',
        titleAr: 'التحدي الشامل لإتقان الأبعاد الموسيقية (m2 – P8)',
        subtitleEn: 'All core Major, Minor, and Perfect intervals',
        subtitleAr: 'تحديد كافة الأبعاد الموسيقية الصاعدة والهابطة سمعياً وبصرياً',
        descriptionEn:
          'Master the complete palette of conservatory intervals: m2, M2, m3, M3, P4, P5, M6, M7, and P8.',
        descriptionAr:
          'اختبار شامل يجمع الأبعاد الصغيرة والكبيرة والتامة لتطوير الأذن الموسيقية والقراءة الوهلية معاً.',
        tipEn: 'Use the "Replay Sequential" and "Play Harmonic" buttons to compare melodic and harmonic color.',
        tipAr: 'استخدم زر الإعادة اللحنية أو الهارمونية للمقارنة بين صوت النغمتين متتاليتين أو معاً.',
        clef: 'treble',
        mode: 'specific_quality',
        allowedDirections: ['ascending', 'descending'],
        intervalPool: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'M7', 'P8'],
      },
    ],
  },
];

export const ALL_INTERVAL_LEVELS: IntervalLevel[] = INTERVAL_CHAPTERS.flatMap((c) => c.levels);

/**
 * Generate a random valid two-note interval question for a given IntervalLevel
 */
export function generateIntervalQuestion(
  level: IntervalLevel,
  previousQuestionId?: string
): GeneratedIntervalQuestion {
  const minStep = level.clef === 'treble' ? 0 : -10; // C4..A5 for treble, G2..C4 for bass
  const maxStep = level.clef === 'treble' ? 12 : 0;

  const naturalCandidates = NATURAL_NOTES_LIST.filter(
    (n) => n.diatonicStep >= minStep && n.diatonicStep <= maxStep
  );

  // Build all valid pairs matching level.intervalPool
  const validPairs: GeneratedIntervalQuestion[] = [];

  for (const targetIntervalId of level.intervalPool) {
    const meta = INTERVAL_META[targetIntervalId];
    const reqSteps = meta.diatonicSteps;

    for (const n1 of naturalCandidates) {
      for (const dir of level.allowedDirections) {
        const targetStep = dir === 'ascending' ? n1.diatonicStep + reqSteps : n1.diatonicStep - reqSteps;
        if (targetStep < minStep || targetStep > maxStep) continue;

        const baseN2 = naturalCandidates.find((n) => n.diatonicStep === targetStep);
        if (!baseN2) continue;

        if (level.mode === 'generic_number') {
          const semitones = Math.abs(baseN2.midi - n1.midi);
          validPairs.push({
            id: `${n1.id}-${baseN2.id}-${targetIntervalId}`,
            note1: n1,
            note2: baseN2,
            direction: dir,
            intervalId: targetIntervalId,
            diatonicDistance: reqSteps + 1,
            semitoneDistance: semitones,
          });
        } else {
          // specific_quality mode: ensure exact semitone distance matches meta.semitones
          const naturalSemitones = Math.abs(baseN2.midi - n1.midi);
          if (naturalSemitones === meta.semitones) {
            validPairs.push({
              id: `${n1.id}-${baseN2.id}-${targetIntervalId}`,
              note1: n1,
              note2: baseN2,
              direction: dir,
              intervalId: targetIntervalId,
              diatonicDistance: reqSteps + 1,
              semitoneDistance: naturalSemitones,
            });
          } else if (Math.abs(naturalSemitones - meta.semitones) === 1) {
            // Try sharp or flat on note2 if it exists in registry
            const neededMidi = dir === 'ascending' ? n1.midi + meta.semitones : n1.midi - meta.semitones;
            const sharpId = `${baseN2.letter}#${baseN2.octave}`;
            const flatId = `${baseN2.letter}b${baseN2.octave}`;
            const altNote =
              getNoteById(sharpId).midi === neededMidi
                ? getNoteById(sharpId)
                : getNoteById(flatId).midi === neededMidi
                ? getNoteById(flatId)
                : null;

            if (altNote && altNote.id !== 'C4') {
              validPairs.push({
                id: `${n1.id}-${altNote.id}-${targetIntervalId}`,
                note1: n1,
                note2: altNote,
                direction: dir,
                intervalId: targetIntervalId,
                diatonicDistance: reqSteps + 1,
                semitoneDistance: meta.semitones,
              });
            }
          }
        }
      }
    }
  }

  const filtered =
    validPairs.length > 1 && previousQuestionId
      ? validPairs.filter((p) => p.id !== previousQuestionId)
      : validPairs;

  const chosen =
    filtered[Math.floor(Math.random() * filtered.length)] ||
    validPairs[0] || {
      id: 'C4-G4-5th',
      note1: getNoteById('C4'),
      note2: getNoteById('G4'),
      direction: 'ascending',
      intervalId: '5th',
      diatonicDistance: 5,
      semitoneDistance: 7,
    };

  return chosen;
}
