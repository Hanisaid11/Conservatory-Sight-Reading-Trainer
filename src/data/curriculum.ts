export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Accidental = '' | '#' | 'b';
export type ClefType = 'treble' | 'bass' | 'grand';
export type KeySignature = 'C' | 'G' | 'F';

export interface NoteSpec {
  id: string;            // e.g. 'C4', 'F#4', 'Bb3'
  letter: NoteLetter;
  accidental: Accidental;
  solfege: string;       // 'Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'
  solfegeAr: string;     // 'دو', 'ري', 'مي', 'فا', 'صول', 'لا', 'سي'
  octave: number;
  midi: number;          // 60 = C4
  frequency: number;     // Hz
  diatonicStep: number;  // 0 = C4, +1 = D4, -1 = B3
  pitchClass: number;    // 0 = C, 1 = C#/Db, ..., 11 = B
  displayLabel: string;  // e.g. 'C4', 'F♯4', 'B♭4'
  solfegeLabel: string;  // e.g. 'Do', 'Fa♯', 'Si♭'
}

export interface CurriculumLevel {
  id: string;
  chapterId: number;
  levelNumber: string;
  iconGlyph: string;
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  description: string;
  descriptionAr: string;
  mnemonic: string;
  mnemonicAr: string;
  lessonStepsEn: string[];
  lessonStepsAr: string[];
  clef: 'treble' | 'bass';
  keySignature: KeySignature;
  notes: string[];
  newNotes: string[];
  targetSpeedMs: number;
}

export interface CurriculumChapter {
  id: number;
  iconGlyph: string;
  title: string;
  titleAr: string;
  subtitle: string;
  subtitleAr: string;
  badgeText: string;
  badgeTextAr: string;
  accentColor: string;
  levels: CurriculumLevel[];
}

const LETTER_ORDER: NoteLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SOLFEGE_MAP: Record<NoteLetter, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

const SOLFEGE_AR_MAP: Record<NoteLetter, string> = {
  C: 'دو',
  D: 'ري',
  E: 'مي',
  F: 'فا',
  G: 'صول',
  A: 'لا',
  B: 'سي',
};

const SEMITONE_OFFSET: Record<NoteLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

function buildNote(letter: NoteLetter, octave: number, accidental: Accidental = ''): NoteSpec {
  const letterIdx = LETTER_ORDER.indexOf(letter);
  const diatonicStep = (octave - 4) * 7 + letterIdx;
  const accidentalSemitones = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const midi = (octave + 1) * 12 + SEMITONE_OFFSET[letter] + accidentalSemitones;
  const frequency = Number((440 * Math.pow(2, (midi - 69) / 12)).toFixed(2));
  const pitchClass = ((midi % 12) + 12) % 12;
  const accSymbol = accidental === '#' ? '♯' : accidental === 'b' ? '♭' : '';

  return {
    id: `${letter}${accidental}${octave}`,
    letter,
    accidental,
    solfege: SOLFEGE_MAP[letter],
    solfegeAr: `${SOLFEGEGE_AR_SAFE(letter)}${accSymbol}`,
    octave,
    midi,
    frequency,
    diatonicStep,
    pitchClass,
    displayLabel: `${letter}${accSymbol}${octave}`,
    solfegeLabel: `${SOLFEGE_MAP[letter]}${accSymbol}`,
  };
}

function SOLFEGEGE_AR_SAFE(letter: NoteLetter): string {
  return SOLFEGE_AR_MAP[letter] || 'دو';
}

// Build complete note registry from G2 to C6 (including sharps and flats)
export const NOTE_REGISTRY: Record<string, NoteSpec> = {};
export const NATURAL_NOTES_LIST: NoteSpec[] = [];
export const ALL_NOTES_LIST: NoteSpec[] = [];

for (let octave = 2; octave <= 6; octave++) {
  for (const letter of LETTER_ORDER) {
    const step = (octave - 4) * 7 + LETTER_ORDER.indexOf(letter);
    if (step < -10 || step > 14) continue; // G2 is -10, C6 is +14

    const natural = buildNote(letter, octave, '');
    NOTE_REGISTRY[natural.id] = natural;
    NATURAL_NOTES_LIST.push(natural);
    ALL_NOTES_LIST.push(natural);

    if (step < 14 && !['E', 'B'].includes(letter)) {
      const sharp = buildNote(letter, octave, '#');
      NOTE_REGISTRY[sharp.id] = sharp;
      ALL_NOTES_LIST.push(sharp);
    }
    if (step > -10 && !['C', 'F'].includes(letter)) {
      const flat = buildNote(letter, octave, 'b');
      NOTE_REGISTRY[flat.id] = flat;
      ALL_NOTES_LIST.push(flat);
    }
  }
}

export function getNoteById(id: string): NoteSpec {
  return NOTE_REGISTRY[id] || NOTE_REGISTRY['C4'];
}

export function findClosestNoteByFrequency(freq: number): {
  note: NoteSpec;
  cents: number;
  midiFloat: number;
} | null {
  if (!freq || freq < 80 || freq > 1200) return null;
  const midiFloat = 69 + 12 * Math.log2(freq / 440);
  const nearestMidi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - nearestMidi) * 100);

  const matching =
    NATURAL_NOTES_LIST.find((n) => n.midi === nearestMidi) ||
    ALL_NOTES_LIST.find((n) => n.midi === nearestMidi);

  if (!matching) return null;
  return { note: matching, cents, midiFloat };
}

export const CURRICULUM_CHAPTERS: CurriculumChapter[] = [
  {
    id: 1,
    iconGlyph: '𝄞',
    title: 'Chapter 1: Treble Clef Foundations',
    titleAr: 'الفصل الأول: أساسيات مفتاح صول (Treble Clef)',
    subtitle: 'Master the landmark guide notes, space notes, and line notes of the Treble staff.',
    subtitleAr: 'تعلّم النغمات المرجعية الأساسية، نغمات المسافات، ونغمات الخطوط على مدرج مفتاح صول.',
    badgeText: 'Treble Foundations',
    badgeTextAr: 'أساسيات مفتاح صول',
    accentColor: 'indigo',
    levels: [
      {
        id: '1.1',
        chapterId: 1,
        levelNumber: '1.1',
        iconGlyph: '𝄞',
        title: 'Middle C & Treble G',
        titleAr: 'نغمتا الارتكاز: دو الوسطى (C4) وصول (G4)',
        subtitle: 'Anchor Landmarks (C4 & G4)',
        subtitleAr: 'النقاط المرجعية الأهم في مفتاح صول',
        description:
          'Start with the two most important landmarks in Treble Clef: Middle C on its first ledger line below the staff, and Treble G on the second line where the G-clef spiral curls.',
        descriptionAr:
          'ابدأ بأهم نقطتين مرجعيتين في مفتاح صول: نغمة "دو الوسطى" (C4) التي تقع على خط إضافي صغير أسفل المدرج، ونغمة "صول" (G4) التي تقع على الخط الثاني حيث يلتف حلزون مفتاح صول.',
        mnemonic: 'G-Clef curls around Line 2 (G4). Middle C (C4) sits on its own ledger line below.',
        mnemonicAr: 'حلزون مفتاح صول يلتف حول الخط الثاني (نغمة صول G4)، ودو الوسطى (C4) تجلس على خط إضافي بالأسفل.',
        lessonStepsEn: [
          'Look at the Treble Clef (𝄞): its inner spiral wraps directly around Line 2 from the bottom, naming that line G4 (Sol).',
          'Look below the 5 lines: the note with a short horizontal line through its middle is Middle C (C4 / Do).',
          'In this exercise, quickly distinguish between the low ledger-line C4 and the Line-2 G4.',
        ],
        lessonStepsAr: [
          'انظر إلى رمز مفتاح صول (𝄞): حلزونه الداخلي يلتف مباشرة حول الخط الثاني من الأسفل، ولذلك يُسمى هذا الخط نغمة صول (G4 / Sol).',
          'انظر أسفل الخطوط الخمسة: النغمة التي يخترقها خط أفقي قصير خاص بها هي نغمة دو الوسطى (C4 / Do).',
          'في هذا التمرين، درّب عينك على التمييز الفوري بين دو الوسطى بالأسفل وصول على الخط الثاني.',
        ],
        clef: 'treble',
        keySignature: 'C',
        notes: ['C4', 'G4'],
        newNotes: ['C4', 'G4'],
        targetSpeedMs: 1800,
      },
      {
        id: '1.2',
        chapterId: 1,
        levelNumber: '1.2',
        iconGlyph: '♩',
        title: 'The C Major Pentascale',
        titleAr: 'السلم الخماسي (دو - ري - مي - فا - صول)',
        subtitle: 'Adding D4, E4, and F4',
        subtitleAr: 'إضافة نغمات ري (D4) ومي (E4) وفا (F4)',
        description:
          'Connect Middle C up to Treble G by stepping through D4 (space below line 1), E4 (line 1), and F4 (space 1). Notice how notes alternate Line → Space → Line → Space.',
        descriptionAr:
          'صل بين دو الوسطى ونغمة صول بالصعود خطوة خطوة عبر: ري (D4) تحت الخط الأول، مي (E4) على الخط الأول، وفا (F4) في المسافة الأولى.',
        mnemonic: 'Step up from C4: D4 hangs below Line 1, E4 sits on Line 1, F4 fills Space 1.',
        mnemonicAr: 'تدرّج من دو الوسطى: ري (D4) تلامس الخط الأول من أسفل، مي (E4) على الخط الأول، فا (F4) في المسافة الأولى.',
        lessonStepsEn: [
          'Music notation climbs step-by-step alternating Line and Space.',
          'D4 (Re) sits in the open space right below Line 1.',
          'E4 (Mi) sits directly on Line 1 (bottom line), and F4 (Fa) fills Space 1 between Line 1 and Line 2.',
        ],
        lessonStepsAr: [
          'تتحرك النغمات على المدرج الموسيقي بالتناوب دائماً: خط ← مسافة ← خط ← مسافة.',
          'نغمة ري (D4) تقع في الفراغ أسفل الخط الأول مباشرة (تتدلى تحت الخط الأول).',
          'نغمة مي (E4) تقع على الخط الأول، ونغمة فا (F4) تملأ المسافة الأولى بين الخط الأول والثاني.',
        ],
        clef: 'treble',
        keySignature: 'C',
        notes: ['C4', 'D4', 'E4', 'F4', 'G4'],
        newNotes: ['D4', 'E4', 'F4'],
        targetSpeedMs: 1700,
      },
      {
        id: '1.3',
        chapterId: 1,
        levelNumber: '1.3',
        iconGlyph: '♬',
        title: 'Treble Space Notes (FACE)',
        titleAr: 'نغمات المسافات الأربع في مفتاح صول (F-A-C-E)',
        subtitle: 'F4, A4, C5, and E5',
        subtitleAr: 'فا (F4) · لا (A4) · دو العليا (C5) · مي العليا (E5)',
        description:
          'Read the four interior spaces of the Treble staff from bottom to top. Together they spell the classic word F-A-C-E.',
        descriptionAr:
          'اقرأ المسافات الأربع الداخلية لمدرج مفتاح صول من الأسفل إلى الأعلى: فا - لا - دو - مي، وهي تكوّن الكلمة الإنجليزية الشهيرة (FACE).',
        mnemonic: 'Bottom to top spaces spell F - A - C - E (F4, A4, C5, E5).',
        mnemonicAr: 'المسافات من الأسفل للأعلى (١ إلى ٤): فا (F4) ← لا (A4) ← دو (C5) ← مي (E5) أي كلمة FACE.',
        lessonStepsEn: [
          'Space 1 (bottom space) is F4 (Fa).',
          'Space 2 is A4 (La — 440 Hz tuning reference).',
          'Space 3 is High C (C5 / Do), and Space 4 (top space) is E5 (Mi).',
        ],
        lessonStepsAr: [
          'المسافة الأولى (بين الخط ١ و ٢) هي نغمة فا (F4).',
          'المسافة الثانية (بين الخط ٢ و ٣) هي نغمة لا القياسية (A4 = 440 Hz).',
          'المسافة الثالثة هي دو العليا (C5)، والمسافة الرابعة والأخيرة هي مي العليا (E5).',
        ],
        clef: 'treble',
        keySignature: 'C',
        notes: ['F4', 'A4', 'C5', 'E5'],
        newNotes: ['A4', 'C5', 'E5'],
        targetSpeedMs: 1650,
      },
      {
        id: '1.4',
        chapterId: 1,
        levelNumber: '1.4',
        iconGlyph: '♯',
        title: 'Treble Line Notes (EGBDF)',
        titleAr: 'نغمات الخطوط الخمسة في مفتاح صول (E-G-B-D-F)',
        subtitle: 'E4, G4, B4, D5, and F5',
        subtitleAr: 'مي (E4) · صول (G4) · سي (B4) · ري (D5) · فا (F5)',
        description:
          'Conquer all five lines of the Treble staff from bottom to top: E4, G4, B4, D5, and F5.',
        descriptionAr:
          'أتقن قراءة النغمات الواقعة على الخطوط الخمسة لمدرج صول من الأسفل للأعلى: مي - صول - سي - ري - فا.',
        mnemonic: 'Every Good Boy Does Fine — Lines 1 to 5: E4 · G4 · B4 · D5 · F5.',
        mnemonicAr: 'الخطوط من ١ إلى ٥ بالترتيب: مي (خط ١) · صول (خط ٢) · سي (خط ٣ الأوسط) · ري (خط ٤) · فا (خط ٥ الأعلى).',
        lessonStepsEn: [
          'Line 1 is E4 (Mi) and Line 2 is G4 (Sol).',
          'Line 3 (the exact middle line of the staff) is B4 (Si) — notice stems point down from B4 upward!',
          'Line 4 is D5 (Re) and Line 5 (top line) is F5 (Fa).',
        ],
        lessonStepsAr: [
          'الخط الأول هو مي (E4) والخط الثاني هو صول (G4).',
          'الخط الثالث (خط المنتصف تماماً) هو نغمة سي (B4) — لاحظ أن عصا النوتة تتجه للأسفل بدءاً من الخط الثالث فصاعداً!',
          'الخط الرابع هو ري العليا (D5) والخط الخامس (الأعلى) هو فا العليا (F5).',
        ],
        clef: 'treble',
        keySignature: 'C',
        notes: ['E4', 'G4', 'B4', 'D5', 'F5'],
        newNotes: ['B4', 'D5', 'F5'],
        targetSpeedMs: 1600,
      },
    ],
  },
  {
    id: 2,
    iconGlyph: '𝄞',
    title: 'Chapter 2: Treble Expansion & Ledger Lines',
    titleAr: 'الفصل الثاني: الخطوط الإضافية وتوسيع مدى مفتاح صول',
    subtitle: 'Extend your reading range above F5 up to High C (C6) and below Middle C down to A3.',
    subtitleAr: 'توسيع مدى القراءة فوق الخط الخامس حتى دو الحادة (C6) وتحت دو الوسطى حتى لا القرار (A3).',
    badgeText: 'Ledger Lines & Speed',
    badgeTextAr: 'الخطوط الإضافية والسرعة',
    accentColor: 'emerald',
    levels: [
      {
        id: '2.1',
        chapterId: 2,
        levelNumber: '2.1',
        iconGlyph: '↑',
        title: 'Upper Register Ledger Lines',
        titleAr: 'الخطوط الإضافية العلوية (G5 إلى C6)',
        subtitle: 'G5, A5, B5, and High C (C6)',
        subtitleAr: 'صول (G5) · لا (A5) · سي (B5) · دو الحادة (C6)',
        description:
          'Climb above the top line (F5). G5 sits right on top of the staff, A5 uses 1 upper ledger line, B5 sits above the first ledger line, and High C (C6) sits on the second ledger line.',
        descriptionAr:
          'اصعد فوق الخط الخامس (F5): نغمة صول (G5) تجلس فوق الخط الخامس مباشرة، لا (A5) على الخط الإضافي الأول، سي (B5) فوقه، ودو الحادة (C6) على الخط الإضافي الثاني.',
        mnemonic: 'Above F5: G5 sits on top · A5 = 1st ledger line · C6 = 2nd ledger line.',
        mnemonicAr: 'فوق الخط الخامس: صول (G5) تلامسه من أعلى · لا (A5) = خط إضافي أول · دو (C6) = خط إضافي ثانٍ.',
        lessonStepsEn: [
          'When music goes higher than Line 5 (F5), we draw short Ledger Lines to extend the staff.',
          'G5 (Sol) sits right on top of Line 5 without needing a ledger line.',
          'A5 (La) sits on the 1st upper ledger line; B5 sits above it; High C (C6) sits on the 2nd upper ledger line.',
        ],
        lessonStepsAr: [
          'عندما ترتفع النغمات أعلى من الخط الخامس (F5)، نرسم خطوطاً إضافية قصيرة (Ledger Lines) لتوسيع المدرج.',
          'نغمة صول (G5) ترتكز فوق الخط الخامس مباشرة بدون خط إضافي.',
          'نغمة لا (A5) تقع على الخط الإضافي العلوي الأول، وسي (B5) تعلوه، أما دو الحادة (C6) فتقع على الخط الإضافي العلوي الثاني.',
        ],
        clef: 'treble',
        keySignature: 'C',
        notes: ['F5', 'G5', 'A5', 'B5', 'C6'],
        newNotes: ['G5', 'A5', 'B5', 'C6'],
        targetSpeedMs: 1750,
      },
      {
        id: '2.2',
        chapterId: 2,
        levelNumber: '2.2',
        iconGlyph: '↓',
        title: 'Lower Register Ledger Lines',
        titleAr: 'الخطوط الإضافية السفلية تحت دو الوسطى (A3 & B3)',
        subtitle: 'A3, B3, and Middle C (C4)',
        subtitleAr: 'لا القرار (A3) · سي القرار (B3) · دو الوسطى (C4)',
        description:
          'Read smoothly below Middle C. B3 hangs directly underneath the C4 ledger line, and A3 sits on the second lower ledger line.',
        descriptionAr:
          'اقرأ النغمات الواقعة أسفل دو الوسطى (C4): نغمة سي (B3) تتدلى أسفل خط دو الوسطى مباشرة، ونغمة لا (A3) تقع على الخط الإضافي السفلي الثاني.',
        mnemonic: 'Count down from Middle C (C4): B3 hangs below C4, A3 sits on 2nd ledger line.',
        mnemonicAr: 'انزل من دو الوسطى (C4): سي (B3) تحت الخط الأول الإضافي، ولا (A3) على الخط الإضافي الثاني.',
        lessonStepsEn: [
          'Middle C (C4) uses 1 lower ledger line.',
          'Step down 1 note from C4 to find B3 (Si), hanging right underneath the first ledger line.',
          'Step down one more note to find A3 (La), sitting directly on the second lower ledger line.',
        ],
        lessonStepsAr: [
          'نغمة دو الوسطى (C4) تقع على الخط الإضافي السفلي الأول.',
          'عند النزول درجة واحدة من دو الوسطى نصل إلى سي (B3) التي تقع تحت الخط الإضافي الأول مباشرة.',
          'وعند النزول درجة أخرى نصل إلى لا (A3) التي يخترقها الخط الإضافي السفلي الثاني.',
        ],
        clef: 'treble',
        keySignature: 'C',
        notes: ['A3', 'B3', 'C4', 'D4', 'E4'],
        newNotes: ['A3', 'B3'],
        targetSpeedMs: 1650,
      },
      {
        id: '2.3',
        chapterId: 2,
        levelNumber: '2.3',
        iconGlyph: '★',
        title: 'Full Treble Clef Mastery',
        titleAr: 'إتقان كامل مدى مفتاح صول (من A3 إلى C6)',
        subtitle: 'Speed Drill (A3 to C6)',
        subtitleAr: 'تمرين السرعة الشامل لجميع نغمات مفتاح صول الطبيعية',
        description:
          'Put all natural notes of the Treble Clef together in a comprehensive concert-range speed drill from low A3 up to High C6.',
        descriptionAr:
          'اختبر سرعتك ودقتك في قراءة جميع النغمات الطبيعية لمفتاح صول عبر أكثر من أوكتافين كاملين من A3 حتى C6.',
        mnemonic: 'Use guide landmarks C4, G4, C5, F5, and C6 to instantly anchor intervals.',
        mnemonicAr: 'اعتمد على النقاط المرجعية الخمس (C4, G4, C5, F5, C6) لتحديد أي نغمة بلمح البصر.',
        lessonStepsEn: [
          'Instead of counting from the bottom every time, anchor your eye on the nearest landmark: C4, G4, C5, F5, or C6.',
          'Aim for steady accuracy above 90% and a reaction time under 1.5 seconds per note.',
        ],
        lessonStepsAr: [
          'بدلاً من العد من الأسفل في كل مرة، اربط عينك بأقرب نغمة مرجعية: دو الوسطى (C4)، صول (G4)، دو (C5)، فا (F5)، أو دو الحادة (C6).',
          'الهدف في هذا التمرين الشامل هو تحقيق دقة تتجاوز 90% مع سرعة استجابة أقل من ثانية ونصف للنغمة.',
        ],
        clef: 'treble',
        keySignature: 'C',
        notes: [
          'A3',
          'B3',
          'C4',
          'D4',
          'E4',
          'F4',
          'G4',
          'A4',
          'B4',
          'C5',
          'D5',
          'E5',
          'F5',
          'G5',
          'A5',
          'B5',
          'C6',
        ],
        newNotes: ['A3', 'C4', 'G4', 'C5', 'C6'],
        targetSpeedMs: 1450,
      },
    ],
  },
  {
    id: 3,
    iconGlyph: '𝄢',
    title: 'Chapter 3: Bass Clef Foundations',
    titleAr: 'الفصل الثالث: أساسيات مفتاح فا (Bass Clef)',
    subtitle: 'Build fluent left-hand and low-register sight-reading across the Bass (F) Clef.',
    subtitleAr: 'إتقان القراءة الوهلية لليد اليسرى والمنطقة الغليظة على مدرج مفتاح فا.',
    badgeText: 'Bass Clef',
    badgeTextAr: 'مفتاح فا (Bass)',
    accentColor: 'amber',
    levels: [
      {
        id: '3.1',
        chapterId: 3,
        levelNumber: '3.1',
        iconGlyph: '𝄢',
        title: 'Bass Guide Notes',
        titleAr: 'النغمات المرجعية في مفتاح فا (G2 · F3 · C4)',
        subtitle: 'Low G2, Bass F3, and Middle C4',
        subtitleAr: 'صول الغليظة (G2) · فا (F3) · دو الوسطى (C4)',
        description:
          'Anchor your Bass Clef orientation with three essential guideposts: Bottom line G2, Fourth line F3 (between the two dots of the F-clef), and Middle C4 on the first ledger line above.',
        descriptionAr:
          'ثبّت قراءتك في مفتاح فا عبر ثلاث نقاط ارتكاز رئيسية: صول (G2) على الخط الأول، فا (F3) على الخط الرابع بين نقطتي مفتاح فا، ودو الوسطى (C4) على الخط الإضافي الأول بالأعلى.',
        mnemonic: 'The two Bass Clef dots surround Line 4 (F3). Bottom line is G2; top ledger is C4.',
        mnemonicAr: 'نقطتا مفتاح فا تحيطان بالخط الرابع (نغمة فا F3)، والخط الأول بالأسفل هو صول (G2)، والخط الإضافي بالأعلى هو دو الوسطى (C4).',
        lessonStepsEn: [
          'The Bass Clef (𝄢) is also called the F-Clef because its two dots surround Line 4, marking that line as F3 (Fa).',
          'Line 1 (bottom line) of the Bass staff is low G2 (Sol).',
          'Middle C (C4 / Do) sits on the first ledger line ABOVE the Bass staff.',
        ],
        lessonStepsAr: [
          'يُسمى مفتاح فا (𝄢) بهذا الاسم لأن نقطتيه تحصران الخط الرابع من الأسفل، مما يجعل الخط الرابع نغمة فا (F3).',
          'الخط الأول (السفلي) في مفتاح فا هو نغمة صول الغليظة (G2).',
          'أما دو الوسطى (C4) فتقع على الخط الإضافي الأول أعلى مدرج مفتاح فا.',
        ],
        clef: 'bass',
        keySignature: 'C',
        notes: ['G2', 'F3', 'C4'],
        newNotes: ['G2', 'F3', 'C4'],
        targetSpeedMs: 1800,
      },
      {
        id: '3.2',
        chapterId: 3,
        levelNumber: '3.2',
        iconGlyph: '𝄢',
        title: 'Bass Space Notes (ACEG)',
        titleAr: 'نغمات المسافات في مفتاح فا (A-C-E-G)',
        subtitle: 'A2, C3, E3, and G3',
        subtitleAr: 'لا (A2) · دو (C3) · مي (E3) · صول (G3)',
        description:
          'Learn the four spaces inside the Bass Clef from bottom to top: A2, C3, E3, and G3.',
        descriptionAr:
          'تعلّم قراءة المسافات الأربع داخل مدرج مفتاح فا من الأسفل إلى الأعلى: لا (A2)، دو (C3)، مي (E3)، وصول (G3).',
        mnemonic: 'All Cows Eat Grass — Spaces 1 to 4: A2 · C3 · E3 · G3.',
        mnemonicAr: 'مسافات مفتاح فا من ١ إلى ٤: لا (A2) ← دو (C3) ← مي (E3) ← صول (G3) (تذكّر جملة: All Cows Eat Grass).',
        lessonStepsEn: [
          'Space 1 (bottom space) in Bass Clef is A2 (La).',
          'Space 2 is Bass C (C3 / Do) — one octave below Middle C.',
          'Space 3 is E3 (Mi) and Space 4 (top space) is G3 (Sol).',
        ],
        lessonStepsAr: [
          'المسافة الأولى في مفتاح فا هي نغمة لا (A2).',
          'المسافة الثانية هي نغمة دو (C3) وتبعد أوكتافاً كاملاً أسفل دو الوسطى.',
          'المسافة الثالثة هي مي (E3) والمسافة الرابعة هي صول (G3).',
        ],
        clef: 'bass',
        keySignature: 'C',
        notes: ['A2', 'C3', 'E3', 'G3'],
        newNotes: ['A2', 'C3', 'E3', 'G3'],
        targetSpeedMs: 1700,
      },
      {
        id: '3.3',
        chapterId: 3,
        levelNumber: '3.3',
        iconGlyph: '𝄢',
        title: 'Bass Line Notes (GBDFA)',
        titleAr: 'نغمات الخطوط الخمسة في مفتاح فا (G-B-D-F-A)',
        subtitle: 'G2, B2, D3, F3, and A3',
        subtitleAr: 'صول (G2) · سي (B2) · ري (D3) · فا (F3) · لا (A3)',
        description:
          'Master all five lines of the Bass staff from bottom to top, plus B3 sitting above the top line.',
        descriptionAr:
          'أتقن قراءة الخطوط الخمسة لمدرج مفتاح فا من الأسفل إلى الأعلى، بالإضافة إلى نغمة سي (B3) التي ترتكز فوق الخط الخامس.',
        mnemonic: 'Good Boys Do Fine Always — Lines 1 to 5: G2 · B2 · D3 · F3 · A3.',
        mnemonicAr: 'خطوط مفتاح فا من ١ إلى ٥: صول (G2) · سي (B2) · ري (D3 الخط الأوسط) · فا (F3 خط النقطتين) · لا (A3 الخط الخامس).',
        lessonStepsEn: [
          'Line 1 is G2 (Sol), Line 2 is B2 (Si), and Line 3 (middle line) is D3 (Re).',
          'Line 4 is F3 (Fa — between the clef dots) and Line 5 (top line) is A3 (La).',
          'Right above Line 5 sits B3 (Si), just one step below Middle C4.',
        ],
        lessonStepsAr: [
          'الخط الأول هو صول (G2)، الخط الثاني سي (B2)، والخط الثالث الأوسط هو ري (D3).',
          'الخط الرابع هو فا (F3 بين النقطتين)، والخط الخامس العلوي هو لا (A3).',
          'وفوق الخط الخامس مباشرة تجلس نغمة سي (B3) التي تسبق دو الوسطى (C4) بدرجة واحدة.',
        ],
        clef: 'bass',
        keySignature: 'C',
        notes: ['G2', 'B2', 'D3', 'F3', 'A3', 'B3'],
        newNotes: ['B2', 'D3', 'A3', 'B3'],
        targetSpeedMs: 1650,
      },
    ],
  },
  {
    id: 4,
    iconGlyph: '♯♭',
    title: 'Chapter 4: Accidentals & Key Signatures',
    titleAr: 'الفصل الرابع: علامات التحويل والدليل الموسيقي (♯ / ♭)',
    subtitle: 'Read Sharps (♯), Flats (♭), and Key Signatures in G Major and F Major.',
    subtitleAr: 'تعلّم قراءة الدييز (♯) والبيمول (♭) والعزف في سلالم صول الكبير وفا الكبير.',
    badgeText: 'Chromatics & Keys',
    badgeTextAr: 'علامات التحويل والسلالم',
    accentColor: 'rose',
    levels: [
      {
        id: '4.1',
        chapterId: 4,
        levelNumber: '4.1',
        iconGlyph: '♯',
        title: 'Sharps (♯) & Flats (♭) Recognition',
        titleAr: 'تمييز علامات الدييز (♯) والبيمول (♭)',
        subtitle: 'Chromatic Alterations on the Staff',
        subtitleAr: 'الرفع والنقصان بنصف درجة (المفاتيح السوداء في البيانو)',
        description:
          'A Sharp (♯) raises a note by a half-step (one semitone right on the piano); a Flat (♭) lowers a note by a half-step (one semitone left). Practice reading F♯, C♯, G♯, B♭, and E♭.',
        descriptionAr:
          'علامة الدييز (♯ Sharp) ترفع النغمة نصف درجة لليمين (للمفتاح الأسود المجاور)، وعلامة البيمول (♭ Flat) تخفض النغمة نصف درجة لليسار. تدرّب على قراءة F♯ و C♯ و G♯ و B♭ و E♭.',
        mnemonic: 'Sharp (♯) = +1 semitone higher · Flat (♭) = -1 semitone lower.',
        mnemonicAr: 'الدييز (♯) = رفع نصف تون للأعلى · البيمول (♭) = خفض نصف تون للأسفل.',
        lessonStepsEn: [
          'The accidental symbol (♯ or ♭) is always written on the exact same line or space to the LEFT of the notehead it modifies.',
          'When using Solfège/Letter buttons, tap the top chromatic row (e.g. F♯ or B♭) when you see a sharp or flat.',
          'On the Piano keyboard, play the corresponding black key half a step above (♯) or below (♭) the white key.',
        ],
        lessonStepsAr: [
          'تُكتب علامة التحويل (♯ أو ♭) دائماً على يسار رأس النوتة مباشرة وفي نفس الخط أو المسافة.',
          'عند الإجابة بالأزرار، اختر الصف العلوي المخصص للعلامات المحولة (مثل F♯ أو B♭) عند ظهور علامة الدييز أو البيمول.',
          'على لوحة البيانو، اضغط المفتاح الأسود الواقع على يمين النغمة البيضاء في حال الدييز (♯) أو على يسارها في حال البيمول (♭).',
        ],
        clef: 'treble',
        keySignature: 'C',
        notes: ['C4', 'C#4', 'Eb4', 'F4', 'F#4', 'G4', 'G#4', 'Bb4', 'C5'],
        newNotes: ['C#4', 'Eb4', 'F#4', 'G#4', 'Bb4'],
        targetSpeedMs: 1900,
      },
      {
        id: '4.2',
        chapterId: 4,
        levelNumber: '4.2',
        iconGlyph: '♭',
        title: 'Key of G Major & F Major Drills',
        titleAr: 'تدريبات سلّمي صول الكبير (G Major) وفا الكبير (F Major)',
        subtitle: 'Key Signature Context (F♯ & B♭)',
        subtitleAr: 'قراءة الدليل الموسيقي عند المفتاح (فا دييز F♯ وسي بيمول B♭)',
        description:
          'Practice reading melodies in G Major (which features F♯) and F Major (ซึ่ง features B♭), combining natural scale tones with their signature altered tones.',
        descriptionAr:
          'تدرّب على قراءة النغمات في سياق سلم صول الكبير (الذي يتميز بنغمة فا دييز F♯) وسلم فا الكبير (الذي يتميز بنغمة سي بيمول B♭).',
        mnemonic: 'G Major has 1 Sharp (F♯) · F Major has 1 Flat (B♭).',
        mnemonicAr: 'دليل سلم صول الكبير يحتوي على دييز واحد (F♯) · ودليل سلم فا الكبير يحتوي على بيمول واحد (B♭).',
        lessonStepsEn: [
          'In G Major, the sharp placed on the top line (F5) right after the clef reminds us that F is played as F♯.',
          'In F Major, the flat placed on the middle line (B4) indicates B♭.',
          'Watch carefully for the accidental symbols and match them accurately on the buttons or keyboard!',
        ],
        lessonStepsAr: [
          'في سلم صول الكبير (G Major)، تظهر علامة الدييز (♯) على الخط الخامس في بداية المدرج لتدل على رفع نغمة فا إلى (F♯).',
          'في سلم فا الكبير (F Major)، تتميز الدرجة الرابعة بنغمة سي بيمول (B♭).',
          'راقب علامات التحويل بدقة واختر النغمة المطابقة في كل سؤال.',
        ],
        clef: 'treble',
        keySignature: 'G',
        notes: ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'Bb4', 'C5', 'D5', 'F#5'],
        newNotes: ['F#4', 'Bb4', 'F#5'],
        targetSpeedMs: 1750,
      },
    ],
  },
];

export const ALL_LEVELS: CurriculumLevel[] = CURRICULUM_CHAPTERS.flatMap((c) => c.levels);
