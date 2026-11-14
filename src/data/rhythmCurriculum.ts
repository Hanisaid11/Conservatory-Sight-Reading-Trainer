export type RhythmElementKind =
  | 'whole'           // 4 beats (روند)
  | 'dotted_half'     // 3 beats (بلانش منقوط)
  | 'half'            // 2 beats (بلانش)
  | 'dotted_quarter'  // 1.5 beats (نوار منقوط)
  | 'quarter'         // 1 beat (نوار)
  | 'eighth_pair'     // 2 x 0.5 beats beamed together (كروش مزدوج)
  | 'eighth_single'   // 0.5 beat single eighth with flag (كروش مفرد)
  | 'sixteenth_quad'  // 4 x 0.25 beats double-beamed (دوبل كروش)
  | 'rest_whole'      // 4 beats rest (سكتة الروند)
  | 'rest_half'       // 2 beats rest (سكتة البلانش)
  | 'rest_quarter'    // 1 beat rest (سكتة النوار)
  | 'rest_eighth';    // 0.5 beat rest (سكتة الكروش)

export type TimingGrade = 'pending' | 'active' | 'perfect' | 'early' | 'late' | 'early_release' | 'miss';

export interface RhythmSubNote {
  id: string;
  measureIndex: number; // 0 or 1
  startBeatInExercise: number; // e.g. 0, 0.5, 1.0, ... up to 8.0 (in 4/4) or 6.0 (in 3/4)
  durationBeats: number;       // 4, 3, 2, 1.5, 1, 0.5, 0.25
  isRest: boolean;
  kind: RhythmElementKind;
  beamGroupId?: string;        // links beamed eighths or sixteenths
  beamIndex?: number;          // index within beam group
  beamTotal?: number;          // total notes in beam group (2 or 4)
  countLabel: string;          // e.g. '1', '&', 'e', 'a', '(2)'
  arabicName: string;
  englishName: string;
  requiresHold: boolean;       // true for durationBeats >= 1.5
}

export interface RhythmLevel {
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
  timeSignature: [3 | 4, 4];
  defaultBpm: number;
  introducedKinds: RhythmElementKind[];
  /**
   * Pool of 1-measure building blocks (each summing to timeSignature[0] beats).
   * An exercise combines 2 measures (8 beats in 4/4, or 6 beats in 3/4).
   */
  measureTemplates: RhythmElementKind[][];
}

export interface RhythmChapter {
  id: number;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  badgeEn: string;
  badgeAr: string;
  levels: RhythmLevel[];
}

export const RHYTHM_ELEMENT_META: Record<
  RhythmElementKind,
  {
    nameEn: string;
    nameAr: string;
    beatsLabelEn: string;
    beatsLabelAr: string;
    totalBeats: number;
    isRest: boolean;
  }
> = {
  whole: {
    nameEn: 'Whole Note (Semibreve)',
    nameAr: 'الروند (Whole Note)',
    beatsLabelEn: '4 Beats (Hold)',
    beatsLabelAr: '٤ نبضات متصلة',
    totalBeats: 4,
    isRest: false,
  },
  dotted_half: {
    nameEn: 'Dotted Half Note',
    nameAr: 'البلانش المنقوط',
    beatsLabelEn: '3 Beats (Hold)',
    beatsLabelAr: '٣ نبضات متصلة',
    totalBeats: 3,
    isRest: false,
  },
  half: {
    nameEn: 'Half Note (Minim)',
    nameAr: 'البلانش (Half Note)',
    beatsLabelEn: '2 Beats (Hold)',
    beatsLabelAr: 'نبضتان متصلتان',
    totalBeats: 2,
    isRest: false,
  },
  dotted_quarter: {
    nameEn: 'Dotted Quarter Note',
    nameAr: 'النوار المنقوط',
    beatsLabelEn: '1½ Beats (Hold)',
    beatsLabelAr: 'نبضة ونصف',
    totalBeats: 1.5,
    isRest: false,
  },
  quarter: {
    nameEn: 'Quarter Note (Crotchet)',
    nameAr: 'النوار (Quarter Note)',
    beatsLabelEn: '1 Beat',
    beatsLabelAr: 'نبضة واحدة',
    totalBeats: 1,
    isRest: false,
  },
  eighth_pair: {
    nameEn: 'Beamed Eighth Notes (Quavers)',
    nameAr: 'الكروش المزدوج (1 &)',
    beatsLabelEn: '½ + ½ Beat',
    beatsLabelAr: 'نصف + نصف نبضة',
    totalBeats: 1,
    isRest: false,
  },
  eighth_single: {
    nameEn: 'Single Eighth Note',
    nameAr: 'الكروش المفرد',
    beatsLabelEn: '½ Beat',
    beatsLabelAr: 'نصف نبضة',
    totalBeats: 0.5,
    isRest: false,
  },
  sixteenth_quad: {
    nameEn: 'Four Sixteenth Notes (Semiquavers)',
    nameAr: 'الدوبل كروش (1 e & a)',
    beatsLabelEn: '4 × ¼ Beat',
    beatsLabelAr: '٤ أرباع النبضة',
    totalBeats: 1,
    isRest: false,
  },
  rest_whole: {
    nameEn: 'Whole Rest',
    nameAr: 'سكتة الروند',
    beatsLabelEn: '4 Beats Silence',
    beatsLabelAr: 'صمت ٤ نبضات',
    totalBeats: 4,
    isRest: true,
  },
  rest_half: {
    nameEn: 'Half Rest',
    nameAr: 'سكتة البلانش',
    beatsLabelEn: '2 Beats Silence',
    beatsLabelAr: 'صمت نبضتين',
    totalBeats: 2,
    isRest: true,
  },
  rest_quarter: {
    nameEn: 'Quarter Rest',
    nameAr: 'سكتة النوار',
    beatsLabelEn: '1 Beat Silence',
    beatsLabelAr: 'صمت نبضة واحدة',
    totalBeats: 1,
    isRest: true,
  },
  rest_eighth: {
    nameEn: 'Eighth Rest',
    nameAr: 'سكتة الكروش',
    beatsLabelEn: '½ Beat Silence',
    beatsLabelAr: 'صمت نصف نبضة',
    totalBeats: 0.5,
    isRest: true,
  },
};

function formatSubBeatLabel(beatInMeasure: number, isRest: boolean): string {
  // beatInMeasure is 0-indexed (0.0 to 3.75)
  const wholeBeat = Math.floor(beatInMeasure + 0.001) + 1;
  const frac = Number((beatInMeasure - Math.floor(beatInMeasure + 0.001)).toFixed(2));
  let lbl = `${wholeBeat}`;
  if (Math.abs(frac - 0.25) < 0.05) lbl = 'e';
  else if (Math.abs(frac - 0.5) < 0.05) lbl = '&';
  else if (Math.abs(frac - 0.75) < 0.05) lbl = 'a';
  return isRest ? `(${lbl})` : lbl;
}

/**
 * Expand two 1-measure templates into a flat array of RhythmSubNotes across 2 measures
 */
export function buildTwoMeasureExercise(
  measure0: RhythmElementKind[],
  measure1: RhythmElementKind[],
  beatsPerMeasure: 3 | 4
): RhythmSubNote[] {
  const notes: RhythmSubNote[] = [];
  const measures = [measure0, measure1];

  measures.forEach((mKinds, mIdx) => {
    let cursorInMeasure = 0;
    const measureOffset = mIdx * beatsPerMeasure;

    mKinds.forEach((kind, kIdx) => {
      const groupBaseId = `m${mIdx}-k${kIdx}`;

      if (kind === 'eighth_pair') {
        // Expand into 2 beamed eighth sub-notes of 0.5 beats each
        for (let i = 0; i < 2; i++) {
          const beatInM = cursorInMeasure + i * 0.5;
          notes.push({
            id: `${groupBaseId}-e${i}`,
            measureIndex: mIdx,
            startBeatInExercise: measureOffset + beatInM,
            durationBeats: 0.5,
            isRest: false,
            kind: 'eighth_pair',
            beamGroupId: groupBaseId,
            beamIndex: i,
            beamTotal: 2,
            countLabel: formatSubBeatLabel(beatInM, false),
            arabicName: 'كروش',
            englishName: 'Eighth',
            requiresHold: false,
          });
        }
        cursorInMeasure += 1;
      } else if (kind === 'sixteenth_quad') {
        // Expand into 4 double-beamed sixteenth sub-notes of 0.25 beats each
        for (let i = 0; i < 4; i++) {
          const beatInM = cursorInMeasure + i * 0.25;
          notes.push({
            id: `${groupBaseId}-s${i}`,
            measureIndex: mIdx,
            startBeatInExercise: measureOffset + beatInM,
            durationBeats: 0.25,
            isRest: false,
            kind: 'sixteenth_quad',
            beamGroupId: groupBaseId,
            beamIndex: i,
            beamTotal: 4,
            countLabel: formatSubBeatLabel(beatInM, false),
            arabicName: 'دوبل كروش',
            englishName: '16th',
            requiresHold: false,
          });
        }
        cursorInMeasure += 1;
      } else {
        const meta = RHYTHM_ELEMENT_META[kind];
        const dur = meta.totalBeats;
        notes.push({
          id: groupBaseId,
          measureIndex: mIdx,
          startBeatInExercise: measureOffset + cursorInMeasure,
          durationBeats: dur,
          isRest: meta.isRest,
          kind,
          countLabel: formatSubBeatLabel(cursorInMeasure, meta.isRest),
          arabicName: meta.nameAr,
          englishName: meta.nameEn,
          requiresHold: !meta.isRest && dur >= 1.5,
        });
        cursorInMeasure += dur;
      }
    });
  });

  return notes;
}

export const RHYTHM_CHAPTERS: RhythmChapter[] = [
  {
    id: 1,
    titleEn: 'Chapter 1: Basic Pulse & Long Notes (4/4)',
    titleAr: 'الفصل الأول: النبض الأساسي والعلامات الطويلة (4/4)',
    subtitleEn: 'Master steady quarter pulse, sustained half and whole notes, and foundational rests.',
    subtitleAr: 'إتقان نبض النوار المنتظم، وإمساك البلانش والروند، والسكتات الأساسية.',
    badgeEn: '4/4 Foundations',
    badgeAr: 'أساسيات ميزان 4/4',
    levels: [
      {
        id: 'R1.1',
        chapterId: 1,
        levelNumber: 'R1.1',
        titleEn: 'Quarter Notes & Half Notes',
        titleAr: 'النوار والبلانش (Quarter & Half Notes)',
        subtitleEn: 'Crotchet (1 beat) & Minim (2 beats hold)',
        subtitleAr: 'النوار (نبضة واحدة) والبلانش (نبضتان متصلتان)',
        descriptionEn:
          'Tap right on the beat for Quarter Notes (النوار = 1 beat), and press & HOLD across 2 full beats for Half Notes (البلانش = 2 beats).',
        descriptionAr:
          'اضغط مع النبضة تماماً لعلامة النوار (نبضة واحدة)، واضغط مع الاستمرار (Hold) لمدة نبضتين كاملتين لعلامة البلانش.',
        tipEn: 'Hold the drum pad or Spacebar down for the entire 2 beats of every Half Note!',
        tipAr: 'استمر بالضغط على الزر أو المسطرة (Space) طوال نبضتي البلانش ولا تفلت مبكراً!',
        timeSignature: [4, 4],
        defaultBpm: 70,
        introducedKinds: ['quarter', 'half'],
        measureTemplates: [
          ['quarter', 'quarter', 'half'],
          ['half', 'quarter', 'quarter'],
          ['quarter', 'half', 'quarter'],
          ['half', 'half'],
          ['quarter', 'quarter', 'quarter', 'quarter'],
        ],
      },
      {
        id: 'R1.2',
        chapterId: 1,
        levelNumber: 'R1.2',
        titleEn: 'Adding Whole Notes (Semibreve)',
        titleAr: 'إضافة علامة الروند (Whole Note = 4 Beats)',
        subtitleEn: 'Sustaining across an entire 4-beat measure',
        subtitleAr: 'الإمساك المتصل لأربع نبضات كاملة في المازورة',
        descriptionEn:
          'The Whole Note (الروند) is a hollow oval with no stem that rings for all 4 beats of a 4/4 measure. Hold steadily through counts 1 - 2 - 3 - 4.',
        descriptionAr:
          'علامة الروند هي دائرة مفرغة بدون عصا تمتد لأربع نبضات كاملة (1 - 2 - 3 - 4). اضغط واستمر حتى نهاية المازورة.',
        tipEn: 'Count 1 - 2 - 3 - 4 while watching the hold bar fill completely on Whole Notes.',
        tipAr: 'عدّ 1 - 2 - 3 - 4 وراقب شريط الامتلاء الأخضر أثناء إمساك علامة الروند.',
        timeSignature: [4, 4],
        defaultBpm: 72,
        introducedKinds: ['whole', 'half', 'quarter'],
        measureTemplates: [
          ['whole'],
          ['half', 'half'],
          ['quarter', 'quarter', 'half'],
          ['half', 'quarter', 'quarter'],
        ],
      },
      {
        id: 'R1.3',
        chapterId: 1,
        levelNumber: 'R1.3',
        titleEn: 'Quarter Rests & Half Rests',
        titleAr: 'سكتة النوار وسكتة البلانش (Rests)',
        subtitleEn: 'Active silence for 1 beat and 2 beats',
        subtitleAr: 'الالتزام بالصمت الإيقاعي لنبضة أو نبضتين',
        descriptionEn:
          'Music is shaped as much by silence as by sound. Do NOT tap during a Quarter Rest (سكتة النوار = 1 beat silence) or Half Rest (سكتة البلانش = 2 beats silence).',
        descriptionAr:
          'السكتات جزء أساسي من الإيقاع: لا تضغط أبداً أثناء مرور المؤشر على سكتة النوار (نبضة صمت) أو سكتة البلانش (نبضتا صمت).',
        tipEn: 'Release your hold cleanly when a Rest begins so you do not ring into silence.',
        tipAr: 'ارفع يدك في بداية السكتة وتجنب النقر خلالها.',
        timeSignature: [4, 4],
        defaultBpm: 70,
        introducedKinds: ['rest_quarter', 'rest_half', 'quarter', 'half'],
        measureTemplates: [
          ['quarter', 'rest_quarter', 'half'],
          ['half', 'rest_half'],
          ['quarter', 'quarter', 'rest_quarter', 'quarter'],
          ['rest_quarter', 'quarter', 'half'],
          ['quarter', 'rest_quarter', 'quarter', 'rest_quarter'],
        ],
      },
    ],
  },
  {
    id: 2,
    titleEn: 'Chapter 2: Subdivisions & Eighths (الكروش)',
    titleAr: 'الفصل الثاني: التقسيم الثنائي وعلامة الكروش',
    subtitleEn: 'Divide the beat in half ("1 & 2 &") with beamed eighth notes and upbeat syncopations.',
    subtitleAr: 'تقسيم النبضة إلى نصفين (1 & 2 &) مع الكروش المزدوج وسكتة الكروش.',
    badgeEn: 'Eighth Subdivisions',
    badgeAr: 'تقسيمات الكروش',
    levels: [
      {
        id: 'R2.1',
        chapterId: 2,
        levelNumber: 'R2.1',
        titleEn: 'Beamed Eighth Notes (Quavers)',
        titleAr: 'الكروش المزدوج (Beamed Eighths "1 & 2 &")',
        subtitleEn: 'Two even taps per beat (½ + ½ beat)',
        subtitleAr: 'نقرتان متساويتان في النبضة الواحدة',
        descriptionEn:
          'Beamed Eighth Notes (الكروش المزدوج) split one beat into two equal halves: the downbeat ("1") and the upbeat ("&").',
        descriptionAr:
          'يقسم الكروش المزدوج النبضة الواحدة إلى نصفين متساويين: النصف الأول مع دقة المترونوم (1) والنصف الثاني في المنتصف (&).',
        tipEn: 'Subdivide out loud: "1 & 2 & 3 & 4 &" to keep your eighth notes evenly spaced.',
        tipAr: 'انطق التقسيم بصوت مسموع (1 & 2 &) للحفاظ على المسافة الزمنية المتساوية.',
        timeSignature: [4, 4],
        defaultBpm: 68,
        introducedKinds: ['eighth_pair', 'quarter'],
        measureTemplates: [
          ['eighth_pair', 'quarter', 'eighth_pair', 'quarter'],
          ['quarter', 'eighth_pair', 'quarter', 'quarter'],
          ['eighth_pair', 'eighth_pair', 'quarter', 'quarter'],
          ['quarter', 'quarter', 'eighth_pair', 'quarter'],
        ],
      },
      {
        id: 'R2.2',
        chapterId: 2,
        levelNumber: 'R2.2',
        titleEn: 'Mixing Quarter, Half & Eighth Notes',
        titleAr: 'دمج النوار والبلانش والكروش',
        subtitleEn: 'Shifting smoothly between held notes and fast subdivisions',
        subtitleAr: 'الانتقال السلس بين العلامات الممتدة والتقسيمات السريعة',
        descriptionEn:
          'Combine 2-beat Half Notes, 1-beat Quarter Notes, and ½-beat Eighth pairs in flowing two-measure phrases.',
        descriptionAr:
          'اجمع بين البلانش الطويل والنوار والكروش المزدوج في جمل إيقاعية متكاملة من مازورتين.',
        tipEn: 'After holding a 2-beat Half Note, be ready right on beat 3 for the next attack.',
        tipAr: 'بعد إمساك البلانش لنبضتين، استعد فوراً للنقرة التالية في النبضة الثالثة.',
        timeSignature: [4, 4],
        defaultBpm: 72,
        introducedKinds: ['half', 'quarter', 'eighth_pair'],
        measureTemplates: [
          ['half', 'eighth_pair', 'quarter'],
          ['eighth_pair', 'quarter', 'half'],
          ['quarter', 'eighth_pair', 'half'],
          ['eighth_pair', 'eighth_pair', 'half'],
          ['quarter', 'half', 'eighth_pair'],
        ],
      },
      {
        id: 'R2.3',
        chapterId: 2,
        levelNumber: 'R2.3',
        titleEn: 'Eighth Rests & Upbeat Syncopation',
        titleAr: 'سكتة الكروش والنبض الخلفي (Upbeat)',
        subtitleEn: 'Entering on the "&" after a ½-beat rest',
        subtitleAr: 'الدخول على النصف الثاني (&) بعد سكتة الكروش',
        descriptionEn:
          'An Eighth Rest (سكتة الكروش) lasts ½ beat on the downbeat, followed by a single Eighth Note on the "&" upbeat.',
        descriptionAr:
          'تمتد سكتة الكروش لنصف نبضة على الدقة، وتليها علامة كروش مفردة تُعزف في منتصف النبضة (&).',
        tipEn: 'Feel the metronome click on the rest, then tap immediately on the "&" off-beat!',
        tipAr: 'اسمع دقة المترونوم أثناء سكتة الكروش ثم اضغط مباشرة في المنتصف (&).',
        timeSignature: [4, 4],
        defaultBpm: 64,
        introducedKinds: ['rest_eighth', 'eighth_single', 'quarter', 'eighth_pair'],
        measureTemplates: [
          ['quarter', 'rest_eighth', 'eighth_single', 'quarter', 'quarter'],
          ['eighth_pair', 'quarter', 'rest_eighth', 'eighth_single', 'quarter'],
          ['quarter', 'quarter', 'rest_eighth', 'eighth_single', 'quarter'],
          ['rest_eighth', 'eighth_single', 'quarter', 'eighth_pair', 'quarter'],
        ],
      },
    ],
  },
  {
    id: 3,
    titleEn: 'Chapter 3: Dotted Notes & 3/4 Time',
    titleAr: 'الفصل الثالث: العلامات المنقوطة والميزان الثلاثي (3/4)',
    subtitleEn: 'A dot adds half of a note’s value (+50%). Master 3/4 Waltz time and Dotted Quarters.',
    subtitleAr: 'النقطة تضيف نصف قيمة العلامة الزمنية. أتقن ميزان الفالس 3/4 والنوار المنقوط.',
    badgeEn: 'Dotted & 3/4 Meter',
    badgeAr: 'النقطة وميزان 3/4',
    levels: [
      {
        id: 'R3.1',
        chapterId: 3,
        levelNumber: 'R3.1',
        titleEn: 'Dotted Half Note in 3/4 Waltz Time',
        titleAr: 'البلانش المنقوط في الميزان الثلاثي (3/4)',
        subtitleEn: '3 Beats per measure (2 + 1 = 3 beats)',
        subtitleAr: '٣ نبضات في المازورة الواحدة (البلانش المنقوط = ٣ نبضات)',
        descriptionEn:
          'In 3/4 time there are 3 beats per measure. A Dotted Half Note (البلانش المنقوط) equals 2 + 1 = 3 full beats, filling the entire measure.',
        descriptionAr:
          'في ميزان 3/4 توجد ٣ نبضات في كل مازورة. البلانش المنقوط يساوي نبضتين + نبضة = ٣ نبضات كاملة.',
        tipEn: 'Notice the 3-beat count-in (1 - 2 - 3) before you begin tapping!',
        tipAr: 'انتبه إلى أن العدّ التمهيدي في هذا المستوى ثلاثي (1 - 2 - 3)!',
        timeSignature: [3, 4],
        defaultBpm: 74,
        introducedKinds: ['dotted_half', 'half', 'quarter'],
        measureTemplates: [
          ['dotted_half'],
          ['quarter', 'quarter', 'quarter'],
          ['half', 'quarter'],
          ['quarter', 'half'],
          ['quarter', 'eighth_pair', 'quarter'],
        ],
      },
      {
        id: 'R3.2',
        chapterId: 3,
        levelNumber: 'R3.2',
        titleEn: 'Dotted Quarter + Eighth Note',
        titleAr: 'النوار المنقوط مع الكروش المفرد (1½ + ½)',
        subtitleEn: 'Hold across 1½ beats, then tap on the "&" of beat 2',
        subtitleAr: 'إمساك لنبضة ونصف يليه كروش على النصف الثاني (&)',
        descriptionEn:
          'The Dotted Quarter Note (نوار منقوط) lasts 1½ beats (Beat 1 through the downbeat of Beat 2), followed by a single Eighth Note on the "&" of Beat 2.',
        descriptionAr:
          'يمتد النوار المنقوط لنبضة ونصف (يشمل النبضة الأولى وبداية النبضة الثانية)، ثم يأتي الكروش المفرد على الـ (&) قبل النبضة الثالثة.',
        tipEn: 'Count "1 - 2 - &" — press on 1, hold past 2, and tap again on "&"!',
        tipAr: 'اضغط في (1) واستمر حتى تتجاوز دقة (2)، ثم انقر الكروش في منتصف النبضة الثانية (&).',
        timeSignature: [4, 4],
        defaultBpm: 66,
        introducedKinds: ['dotted_quarter', 'eighth_single', 'quarter', 'half'],
        measureTemplates: [
          ['dotted_quarter', 'eighth_single', 'half'],
          ['dotted_quarter', 'eighth_single', 'quarter', 'quarter'],
          ['quarter', 'quarter', 'dotted_quarter', 'eighth_single'],
          ['half', 'dotted_quarter', 'eighth_single'],
        ],
      },
    ],
  },
  {
    id: 4,
    titleEn: 'Chapter 4: Sixteenth Notes (الدوبل كروش)',
    titleAr: 'الفصل الرابع: علامات الدوبل كروش (Sixteenths)',
    subtitleEn: 'Subdivide the beat into 4 rapid pulses ("1 e & a") and conquer full rhythm mastery.',
    subtitleAr: 'تقسيم النبضة الواحدة إلى ٤ أجزاء متساوية (1 e & a) وإتقان القراءة الإيقاعية.',
    badgeEn: 'Sixteenth Mastery',
    badgeAr: 'إتقان الدوبل كروش',
    levels: [
      {
        id: 'R4.1',
        chapterId: 4,
        levelNumber: 'R4.1',
        titleEn: 'Groups of 4 Sixteenth Notes (1 e & a)',
        titleAr: 'مجموعات الدوبل كروش الرباعية (1 e & a)',
        subtitleEn: 'Double-beamed semiquavers (4 × ¼ beat)',
        subtitleAr: 'أربع نقرات متساوية في النبضة الواحدة متصلة بخطين',
        descriptionEn:
          'Four Sixteenth Notes (الدوبل كروش) are connected with a double horizontal beam and divide a single beat into 4 crisp subdivisions: "1 e & a".',
        descriptionAr:
          'ترتبط أربع علامات دوبل كروش بخطين أفقيين مزدوجين وتقسم النبضة الواحدة إلى ٤ نقرات سريعة ومتساوية (1 e & a).',
        tipEn: 'We lowered the default tempo to 58 BPM so you can articulate all 4 sixteenth taps cleanly.',
        tipAr: 'تم ضبط السرعة الافتراضية على 58 BPM لتتمكن من أداء النقرات الأربع بوضوح ودقة.',
        timeSignature: [4, 4],
        defaultBpm: 58,
        introducedKinds: ['sixteenth_quad', 'quarter', 'eighth_pair'],
        measureTemplates: [
          ['sixteenth_quad', 'quarter', 'quarter', 'quarter'],
          ['quarter', 'sixteenth_quad', 'quarter', 'quarter'],
          ['sixteenth_quad', 'quarter', 'sixteenth_quad', 'quarter'],
          ['eighth_pair', 'quarter', 'sixteenth_quad', 'quarter'],
        ],
      },
      {
        id: 'R4.2',
        chapterId: 4,
        levelNumber: 'R4.2',
        titleEn: 'Mixed Rhythm Conservatory Mastery',
        titleAr: 'تمرين الإتقان الإيقاعي الشامل (Mastery Drill)',
        subtitleEn: 'Combining Whole, Half, Dotted, Quarter, Eighth, Sixteenth & Rests',
        subtitleAr: 'دمج كافة العلامات الإيقاعية والمنقوطة والسكتات في تمرين شامل',
        descriptionEn:
          'The ultimate sight-reading rhythm challenge: read unpredictable two-measure combinations featuring dotted quarters, beamed eighths, sixteenth groups, sustained halves, and rests.',
        descriptionAr:
          'التحدي الشامل لقراءة الإيقاع: قراءة جمل متنوعة تجمع بين النوار المنقوط والكروش والدوبل كروش والبلانش والسكتات.',
        tipEn: 'Use the "Listen First" button anytime you want to audition a complex measure.',
        tipAr: 'استخدم زر "استمع أولاً" في أي وقت لسماع العزف المثالي قبل البدء.',
        timeSignature: [4, 4],
        defaultBpm: 62,
        introducedKinds: [
          'dotted_quarter',
          'eighth_single',
          'sixteenth_quad',
          'eighth_pair',
          'half',
          'rest_quarter',
        ],
        measureTemplates: [
          ['dotted_quarter', 'eighth_single', 'eighth_pair', 'quarter'],
          ['sixteenth_quad', 'quarter', 'half'],
          ['quarter', 'rest_quarter', 'sixteenth_quad', 'quarter'],
          ['eighth_pair', 'dotted_quarter', 'eighth_single', 'quarter'],
          ['half', 'sixteenth_quad', 'quarter'],
        ],
      },
    ],
  },
];

export const ALL_RHYTHM_LEVELS: RhythmLevel[] = RHYTHM_CHAPTERS.flatMap((c) => c.levels);
