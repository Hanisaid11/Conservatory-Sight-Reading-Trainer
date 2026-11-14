import React from 'react';
import { RhythmSubNote, TimingGrade } from '../data/rhythmCurriculum';

interface RhythmStaffRendererProps {
  notes: RhythmSubNote[];
  timeSignature: [3 | 4, 4];
  grades: Record<string, TimingGrade>;
  timingOffsetsMs?: Record<string, number>;
  holdProgressByNote?: Record<string, number>; // 0 to 1 for sustained notes
  playheadBeat: number | null; // 0 to totalBeats (e.g. 0 to 8 in 4/4)
  countInBeat: number | null;  // 1, 2, 3, 4 during count-in
  staffStyle?: 'percussion_1line' | 'standard_5line';
  lang: 'en' | 'ar';
}

export const RhythmStaffRenderer: React.FC<RhythmStaffRendererProps> = ({
  notes,
  timeSignature,
  grades,
  timingOffsetsMs = {},
  holdProgressByNote = {},
  playheadBeat,
  countInBeat,
  staffStyle = 'percussion_1line',
  lang,
}) => {
  const beatsPerMeasure = timeSignature[0];
  const totalBeats = beatsPerMeasure * 2; // 2 measures per exercise

  // Horizontal layout geometry inside 860x250 viewBox
  const VIEW_W = 860;
  const VIEW_H = 246;
  const STAFF_LEFT = 36;
  const STAFF_RIGHT = 824;
  const MEASURE_1_START = 136;
  const MEASURE_1_END = 472;
  const MEASURE_2_START = 488;
  const MEASURE_2_END = 808;
  const CENTER_BARLINE_X = 476;

  const NOTE_Y = 128; // Vertical center line of rhythm staff
  const STEM_TOP_Y = 66;

  // Map a beat position (0 to totalBeats) to exact SVG X coordinate
  const beatToX = (beat: number): number => {
    const clamped = Math.max(0, Math.min(totalBeats, beat));
    if (clamped < beatsPerMeasure) {
      const ratio = (clamped + 0.32) / (beatsPerMeasure + 0.35);
      return MEASURE_1_START + ratio * (MEASURE_1_END - MEASURE_1_START);
    } else {
      const beatInM2 = clamped - beatsPerMeasure;
      const ratio = (beatInM2 + 0.32) / (beatsPerMeasure + 0.35);
      return MEASURE_2_START + ratio * (MEASURE_2_END - MEASURE_2_START);
    }
  };

  // Continuous playhead X mapping (linear across each measure)
  const playheadToX = (beat: number): number => {
    const clamped = Math.max(0, Math.min(totalBeats, beat));
    if (clamped <= beatsPerMeasure) {
      const ratio = clamped / beatsPerMeasure;
      return MEASURE_1_START + ratio * (CENTER_BARLINE_X - MEASURE_1_START);
    } else {
      const ratio = (clamped - beatsPerMeasure) / beatsPerMeasure;
      return CENTER_BARLINE_X + ratio * (STAFF_RIGHT - 10 - CENTER_BARLINE_X);
    }
  };

  const getGradeColors = (grade: TimingGrade = 'pending') => {
    switch (grade) {
      case 'perfect':
        return {
          stroke: '#059669',
          fill: '#059669',
          halo: 'rgba(5, 150, 105, 0.18)',
          badgeText: '✓',
          badgeBg: '#D1FAE5',
          badgeColor: '#065F46',
        };
      case 'early':
      case 'late':
      case 'early_release':
        return {
          stroke: '#D97706',
          fill: '#D97706',
          halo: 'rgba(217, 119, 6, 0.20)',
          badgeText: grade === 'early' ? 'Early' : grade === 'late' ? 'Late' : 'Hold!',
          badgeBg: '#FEF3C7',
          badgeColor: '#92400E',
        };
      case 'miss':
        return {
          stroke: '#DC2626',
          fill: '#DC2626',
          halo: 'rgba(220, 38, 38, 0.18)',
          badgeText: '✕',
          badgeBg: '#FEE2E2',
          badgeColor: '#991B1B',
        };
      case 'active':
        return {
          stroke: '#4F46E5',
          fill: '#4F46E5',
          halo: 'rgba(79, 70, 229, 0.22)',
          badgeText: '●',
          badgeBg: '#E0E7FF',
          badgeColor: '#3730A3',
        };
      default:
        return {
          stroke: '#0F172A',
          fill: '#0F172A',
          halo: 'transparent',
          badgeText: '',
          badgeBg: 'transparent',
          badgeColor: '#64748B',
        };
    }
  };

  // Group beamed notes by beamGroupId so we can draw crisp horizontal beams
  const beamGroups: Record<string, RhythmSubNote[]> = {};
  notes.forEach((n) => {
    if (n.beamGroupId) {
      if (!beamGroups[n.beamGroupId]) beamGroups[n.beamGroupId] = [];
      beamGroups[n.beamGroupId].push(n);
    }
  });

  return (
    <div className="relative w-full select-none" dir="ltr">
      {/* Count-In Visual Overlay Banner */}
      {countInBeat !== null && (
        <div
          role="status"
          aria-live="assertive"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2 rounded-xl bg-indigo-950 text-white shadow-md border border-indigo-700"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
            {lang === 'ar' ? 'العد التمهيدي (استعد للضغط):' : 'Count-In (Get Ready to Tap):'}
          </span>
          <span className="text-xl font-bold font-mono text-amber-300 tabular-nums">
            {countInBeat} / {beatsPerMeasure}
          </span>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-auto max-h-[256px] mx-auto block"
          role="img"
          aria-label={`Rhythm staff in ${timeSignature[0]}/${timeSignature[1]} time`}
        >
          {/* Warm Paper Backing */}
          <rect
            x={16}
            y={14}
            width={VIEW_W - 32}
            height={VIEW_H - 28}
            rx={14}
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth={1.2}
          />

          {/* Top Measure Labels & Beat Grid Ticks */}
          <text
            x={MEASURE_1_START}
            y={38}
            fontSize="11"
            fontWeight="700"
            fill="#64748B"
            className="font-mono"
          >
            {lang === 'ar' ? 'المازورة ١ (Measure 1)' : 'MEASURE 1'}
          </text>
          <text
            x={MEASURE_2_START}
            y={38}
            fontSize="11"
            fontWeight="700"
            fill="#64748B"
            className="font-mono"
          >
            {lang === 'ar' ? 'المازورة ٢ (Measure 2)' : 'MEASURE 2'}
          </text>

          {/* Subtle Beat Grid Guidelines & Beat Numbers (1..4 | 1..4) */}
          {Array.from({ length: totalBeats }).map((_, bIdx) => {
            const bx = beatToX(bIdx);
            const beatNumInMeasure = (bIdx % beatsPerMeasure) + 1;
            const isCurrentBeat =
              playheadBeat !== null && Math.floor(playheadBeat) === bIdx;

            return (
              <g key={`beat-grid-${bIdx}`}>
                <line
                  x1={bx}
                  y1={56}
                  x2={bx}
                  y2={182}
                  stroke={isCurrentBeat ? '#C7D2FE' : '#F1F5F9'}
                  strokeWidth={isCurrentBeat ? 2 : 1.2}
                  strokeDasharray="3 3"
                />
                <text
                  x={bx}
                  y={52}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={isCurrentBeat ? '#4F46E5' : '#94A3B8'}
                  className="font-mono"
                >
                  {beatNumInMeasure}
                </text>
              </g>
            );
          })}

          {/* Staff Lines: Either 1-Line Percussion Staff or 5-Line Standard Staff */}
          {staffStyle === 'percussion_1line' ? (
            <line
              x1={STAFF_LEFT}
              y1={NOTE_Y}
              x2={STAFF_RIGHT}
              y2={NOTE_Y}
              stroke="#334155"
              strokeWidth={2.2}
            />
          ) : (
            [-2, -1, 0, 1, 2].map((offset) => (
              <line
                key={offset}
                x1={STAFF_LEFT}
                y1={NOTE_Y + offset * 16}
                x2={STAFF_RIGHT}
                y2={NOTE_Y + offset * 16}
                stroke="#334155"
                strokeWidth={1.4}
              />
            ))
          )}

          {/* Left Double Barline */}
          <line
            x1={STAFF_LEFT}
            y1={NOTE_Y - 34}
            x2={STAFF_LEFT}
            y2={NOTE_Y + 34}
            stroke="#0F172A"
            strokeWidth={3.5}
          />
          <line
            x1={STAFF_LEFT + 6}
            y1={NOTE_Y - 34}
            x2={STAFF_LEFT + 6}
            y2={NOTE_Y + 34}
            stroke="#0F172A"
            strokeWidth={1.3}
          />

          {/* Neutral Percussion Clef (Two vertical parallel bars) */}
          <g transform={`translate(${STAFF_LEFT + 22}, ${NOTE_Y - 22})`}>
            <rect x={0} y={0} width={4} height={44} rx={1} fill="#1E293B" />
            <rect x={9} y={0} width={4} height={44} rx={1} fill="#1E293B" />
          </g>

          {/* Time Signature (4/4 or 3/4) */}
          <g transform={`translate(${STAFF_LEFT + 56}, ${NOTE_Y})`}>
            <text
              x={0}
              y={-6}
              textAnchor="middle"
              fontSize="26"
              fontWeight="800"
              fill="#0F172A"
              className="font-serif select-none"
            >
              {timeSignature[0]}
            </text>
            <text
              x={0}
              y={24}
              textAnchor="middle"
              fontSize="26"
              fontWeight="800"
              fill="#0F172A"
              className="font-serif select-none"
            >
              {timeSignature[1]}
            </text>
          </g>

          {/* Center Measure Dividing Barline */}
          <line
            x1={CENTER_BARLINE_X}
            y1={NOTE_Y - 34}
            x2={CENTER_BARLINE_X}
            y2={NOTE_Y + 34}
            stroke="#334155"
            strokeWidth={2.2}
          />

          {/* Final Right Double Barline */}
          <line
            x1={STAFF_RIGHT - 7}
            y1={NOTE_Y - 34}
            x2={STAFF_RIGHT - 7}
            y2={NOTE_Y + 34}
            stroke="#334155"
            strokeWidth={1.5}
          />
          <line
            x1={STAFF_RIGHT}
            y1={NOTE_Y - 34}
            x2={STAFF_RIGHT}
            y2={NOTE_Y + 34}
            stroke="#0F172A"
            strokeWidth={4}
          />

          {/* Render Horizontal Beams for Beamed Eighth Pairs & Sixteenth Quads */}
          {Object.entries(beamGroups).map(([groupId, groupNotes]) => {
            if (groupNotes.length < 2) return null;
            const firstNote = groupNotes[0];
            const lastNote = groupNotes[groupNotes.length - 1];
            const x1 = beatToX(firstNote.startBeatInExercise) + 10.5;
            const x2 = beatToX(lastNote.startBeatInExercise) + 10.5;
            const isSixteenth = firstNote.kind === 'sixteenth_quad';

            return (
              <g key={`beam-${groupId}`}>
                {/* Primary Top Beam */}
                <line
                  x1={x1}
                  y1={STEM_TOP_Y}
                  x2={x2}
                  y2={STEM_TOP_Y}
                  stroke="#0F172A"
                  strokeWidth={5.5}
                  strokeLinecap="square"
                />
                {/* Secondary Beam for Sixteenth Notes (الدوبل كروش) */}
                {isSixteenth && (
                  <line
                    x1={x1}
                    y1={STEM_TOP_Y + 9}
                    x2={x2}
                    y2={STEM_TOP_Y + 9}
                    stroke="#0F172A"
                    strokeWidth={5.2}
                    strokeLinecap="square"
                  />
                )}
              </g>
            );
          })}

          {/* Render All Rhythm Notes & Rests */}
          {notes.map((n) => {
            const x = beatToX(n.startBeatInExercise);
            const grade = grades[n.id] || 'pending';
            const colors = getGradeColors(grade);
            const holdProg = holdProgressByNote[n.id] || 0;
            const offsetMs = timingOffsetsMs[n.id];

            const isHollow = n.kind === 'whole' || n.kind === 'half' || n.kind === 'dotted_half';
            const hasStem = !n.isRest && n.kind !== 'whole';
            const hasDot = n.kind === 'dotted_half' || n.kind === 'dotted_quarter';
            const hasSingleFlag = n.kind === 'eighth_single';

            // Calculate sustain bar width for Half / Dotted Half / Whole / Dotted Quarter notes
            const endX = beatToX(
              Math.min(totalBeats - 0.15, n.startBeatInExercise + n.durationBeats * 0.82)
            );
            const sustainBarWidth = Math.max(26, endX - x);

            return (
              <g key={n.id}>
                {/* Halo on Graded / Active Note */}
                {colors.halo !== 'transparent' && (
                  <circle cx={x} cy={NOTE_Y} r={22} fill={colors.halo} />
                )}

                {/* Sustained Duration Hold Bar (for Whole, Dotted Half, Half, Dotted Quarter) */}
                {n.requiresHold && (
                  <g transform={`translate(${x + 14}, ${NOTE_Y - 4})`}>
                    <rect
                      x={0}
                      y={0}
                      width={sustainBarWidth}
                      height={8}
                      rx={4}
                      fill="#E2E8F0"
                    />
                    <rect
                      x={0}
                      y={0}
                      width={sustainBarWidth * Math.min(1, holdProg)}
                      height={8}
                      rx={4}
                      fill={
                        grade === 'perfect'
                          ? '#10B981'
                          : grade === 'early_release' || grade === 'miss'
                          ? '#EF4444'
                          : '#6366F1'
                      }
                    />
                  </g>
                )}

                {/* REST SYMBOLS (السكتات) */}
                {n.isRest ? (
                  <g>
                    {n.kind === 'rest_whole' && (
                      /* Whole Rest hangs below the line */
                      <g transform={`translate(${x - 11}, ${NOTE_Y})`}>
                        <line x1={-4} y1={0} x2={26} y2={0} stroke="#334155" strokeWidth={2} />
                        <rect x={0} y={0} width={22} height={11} fill={colors.fill} rx={1.5} />
                      </g>
                    )}

                    {n.kind === 'rest_half' && (
                      /* Half Rest sits on top of the line */
                      <g transform={`translate(${x - 11}, ${NOTE_Y - 11})`}>
                        <line x1={-4} y1={11} x2={26} y2={11} stroke="#334155" strokeWidth={2} />
                        <rect x={0} y={0} width={22} height={11} fill={colors.fill} rx={1.5} />
                      </g>
                    )}

                    {n.kind === 'rest_quarter' && (
                      /* Engraved Quarter Rest (سكتة النوار) */
                      <path
                        d={`M ${x - 3} ${NOTE_Y - 24} L ${x + 7} ${NOTE_Y - 10} L ${x - 5} ${NOTE_Y + 2} L ${x + 6} ${NOTE_Y + 14} C ${x - 4} ${NOTE_Y + 12} ${x - 8} ${NOTE_Y + 20} ${x - 1} ${NOTE_Y + 25}`}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={3.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {n.kind === 'rest_eighth' && (
                      /* Engraved Eighth Rest (سكتة الكروش) */
                      <g transform={`translate(${x}, ${NOTE_Y})`}>
                        <circle cx={-3} cy={-8} r={4.2} fill={colors.fill} />
                        <path
                          d="M -2 -8 Q 4 -6 6 -12 L -3 16"
                          fill="none"
                          stroke={colors.stroke}
                          strokeWidth={2.8}
                          strokeLinecap="round"
                        />
                      </g>
                    )}
                  </g>
                ) : (
                  /* SOUNDING NOTE SYMBOLS (النغمات الإيقاعية) */
                  <g>
                    {/* Vertical Stem */}
                    {hasStem && (
                      <line
                        x1={x + 10.5}
                        y1={NOTE_Y}
                        x2={x + 10.5}
                        y2={STEM_TOP_Y}
                        stroke={colors.stroke}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      />
                    )}

                    {/* Single Eighth Flag (for standalone Eighth Note) */}
                    {hasSingleFlag && (
                      <path
                        d={`M ${x + 10.5} ${STEM_TOP_Y} C ${x + 22} ${STEM_TOP_Y + 8} ${x + 24} ${STEM_TOP_Y + 20} ${x + 16} ${STEM_TOP_Y + 30}`}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={3.2}
                        strokeLinecap="round"
                      />
                    )}

                    {/* Notehead (Hollow for Whole/Half, Solid for Quarter/8th/16th) */}
                    {isHollow ? (
                      <ellipse
                        cx={x}
                        cy={NOTE_Y}
                        rx={12}
                        ry={8.4}
                        transform={n.kind === 'whole' ? undefined : `rotate(-18 ${x} ${NOTE_Y})`}
                        fill="#FFFFFF"
                        stroke={colors.stroke}
                        strokeWidth={3.6}
                      />
                    ) : (
                      <ellipse
                        cx={x}
                        cy={NOTE_Y}
                        rx={11.5}
                        ry={8.2}
                        transform={`rotate(-18 ${x} ${NOTE_Y})`}
                        fill={colors.fill}
                      />
                    )}

                    {/* Augmentation Dot for Dotted Half & Dotted Quarter (النقطة) */}
                    {hasDot && (
                      <circle cx={x + 19} cy={NOTE_Y - 6} r={3.6} fill={colors.fill} />
                    )}
                  </g>
                )}

                {/* Subdivision Count Label Below Note ("1", "&", "e", "a") */}
                <text
                  x={x}
                  y={178}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill={n.isRest ? '#94A3B8' : '#334155'}
                  className="font-mono select-none"
                >
                  {n.countLabel}
                </text>

                {/* Real-time Timing Grade Badge & Millisecond Delta */}
                {grade !== 'pending' && grade !== 'active' && (
                  <g transform={`translate(${x}, 205)`}>
                    <rect
                      x={-24}
                      y={-11}
                      width={48}
                      height={18}
                      rx={5}
                      fill={colors.badgeBg}
                    />
                    <text
                      x={0}
                      y={2}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={colors.badgeColor}
                      className="font-mono select-none"
                    >
                      {colors.badgeText}
                      {typeof offsetMs === 'number' && grade !== 'miss'
                        ? ` ${offsetMs > 0 ? '+' : ''}${offsetMs}ms`
                        : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Smooth Animated Visual Playhead Cursor */}
          {playheadBeat !== null && playheadBeat >= 0 && playheadBeat <= totalBeats && (
            <g transform={`translate(${playheadToX(playheadBeat)}, 0)`}>
              <line
                x1={0}
                y1={36}
                x2={0}
                y2={192}
                stroke="#4F46E5"
                strokeWidth={2.8}
                strokeLinecap="round"
              />
              <polygon points="-6,34 6,34 0,44" fill="#4F46E5" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
