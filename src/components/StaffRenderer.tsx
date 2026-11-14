import React from 'react';
import { KeySignature, NoteSpec } from '../data/curriculum';

interface StaffRendererProps {
  clef: 'treble' | 'bass';
  keySignature?: KeySignature;
  activeNote?: NoteSpec;
  feedbackState?: 'idle' | 'correct' | 'wrong';
  showNoteLabelOnWrong?: boolean;
  labelFormat?: 'both' | 'solfege' | 'letter';
  /**
   * When guideNotes is passed, renders all guide notes side-by-side (for the Pre-Level Guide Card)
   * and allows clicking any note on the staff to audition its sound.
   */
  guideNotes?: NoteSpec[];
  highlightedGuideNoteId?: string | null;
  onClickGuideNote?: (note: NoteSpec) => void;
  upcomingNotes?: NoteSpec[];
  /**
   * When intervalPair is passed, renders two sequential notes on the staff with a melodic arc
   */
  intervalPair?: {
    note1: NoteSpec;
    note2: NoteSpec;
    activeSlot: 1 | 2 | 'both' | null;
    revealNames?: boolean;
    intervalBadgeText?: string;
  };
}

const TOP_LINE_Y = 88;
const STEP_HEIGHT = 11; // Line spacing = 22px

export const StaffRenderer: React.FC<StaffRendererProps> = ({
  clef,
  keySignature = 'C',
  activeNote,
  feedbackState = 'idle',
  showNoteLabelOnWrong = true,
  labelFormat = 'both',
  guideNotes,
  highlightedGuideNoteId,
  onClickGuideNote,
  upcomingNotes = [],
  intervalPair,
}) => {
  const topLineStep = clef === 'treble' ? 10 : -2; // F5 for treble, A3 for bass
  const bottomLineStep = clef === 'treble' ? 2 : -10; // E4 for treble, G2 for bass
  const middleLineStep = clef === 'treble' ? 6 : -6; // B4 for treble, D3 for bass

  const stepToY = (diatonicStep: number): number => {
    return TOP_LINE_Y + (topLineStep - diatonicStep) * STEP_HEIGHT;
  };

  const getLedgerSteps = (diatonicStep: number): number[] => {
    const ledgers: number[] = [];
    if (diatonicStep < bottomLineStep) {
      for (let s = bottomLineStep - 2; s >= diatonicStep; s -= 2) {
        ledgers.push(s);
      }
    } else if (diatonicStep > topLineStep) {
      for (let s = topLineStep + 2; s <= diatonicStep; s += 2) {
        ledgers.push(s);
      }
    }
    return ledgers;
  };

  const formatNoteBadge = (note: NoteSpec): string => {
    if (labelFormat === 'solfege') return `${note.solfegeLabel} (${note.octave})`;
    if (labelFormat === 'letter') return note.displayLabel;
    return `${note.solfegeLabel} · ${note.displayLabel}`;
  };

  const renderNoteOnStaff = (
    note: NoteSpec,
    x: number,
    options: {
      isGhost?: boolean;
      status?: 'idle' | 'correct' | 'wrong';
      showBadge?: boolean;
      isInteractiveGuide?: boolean;
      isHighlighted?: boolean;
    } = {}
  ) => {
    const y = stepToY(note.diatonicStep);
    const ledgers = getLedgerSteps(note.diatonicStep);
    const stemUp = note.diatonicStep < middleLineStep;

    let fillColor = '#0F172A';
    let strokeColor = '#0F172A';
    let glowColor = 'transparent';

    if (options.isGhost) {
      fillColor = '#CBD5E1';
      strokeColor = '#CBD5E1';
    } else if (options.status === 'correct') {
      fillColor = '#059669';
      strokeColor = '#059669';
      glowColor = 'rgba(5, 150, 105, 0.22)';
    } else if (options.status === 'wrong') {
      fillColor = '#DC2626';
      strokeColor = '#DC2626';
      glowColor = 'rgba(220, 38, 38, 0.22)';
    } else if (options.isHighlighted) {
      fillColor = '#4F46E5';
      strokeColor = '#4F46E5';
      glowColor = 'rgba(79, 70, 229, 0.20)';
    }

    const stemX = stemUp ? x + 11.5 : x - 11.5;
    const stemEndY = stemUp ? y - 64 : y + 64;

    return (
      <g
        key={`${note.id}-${x}`}
        className={
          options.isInteractiveGuide
            ? 'cursor-pointer transition-transform duration-150 hover:opacity-90'
            : 'transition-all duration-150'
        }
        onClick={options.isInteractiveGuide && onClickGuideNote ? () => onClickGuideNote(note) : undefined}
      >
        {/* Ledger Lines */}
        {ledgers.map((lStep) => {
          const ly = stepToY(lStep);
          return (
            <line
              key={lStep}
              x1={x - 22}
              y1={ly}
              x2={x + 22}
              y2={ly}
              stroke={options.isGhost ? '#E2E8F0' : '#334155'}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        })}

        {/* Status Halo */}
        {glowColor !== 'transparent' && (
          <circle cx={x} cy={y} r={24} fill={glowColor} />
        )}

        {/* Accidental Symbol (Sharp / Flat) to the left of the notehead */}
        {note.accidental === '#' && (
          <text
            x={x - 30}
            y={y + 8}
            fontSize="26"
            fontWeight="700"
            fill={fillColor}
            className="select-none font-serif"
          >
            ♯
          </text>
        )}
        {note.accidental === 'b' && (
          <text
            x={x - 29}
            y={y + 8}
            fontSize="27"
            fontWeight="700"
            fill={fillColor}
            className="select-none font-serif"
          >
            ♭
          </text>
        )}

        {/* Note Stem */}
        <line
          x1={stemX}
          y1={y}
          x2={stemX}
          y2={stemEndY}
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Tilted Oval Notehead */}
        <ellipse
          cx={x}
          cy={y}
          rx={13}
          ry={9.2}
          transform={`rotate(-18 ${x} ${y})`}
          fill={fillColor}
        />

        {/* Inner highlight on notehead for crisp engraving feel */}
        {!options.isGhost && (
          <ellipse
            cx={x - 2}
            cy={y - 2}
            rx={5}
            ry={2.2}
            transform={`rotate(-18 ${x} ${y})`}
            fill="rgba(255,255,255,0.22)"
          />
        )}

        {/* Interactive Guide Label below staff */}
        {options.showBadge && (
          <g transform={`translate(${x}, 244)`}>
            <rect
              x={-28}
              y={-14}
              width={56}
              height={24}
              rx={6}
              fill={options.isHighlighted ? '#4F46E5' : '#F1F5F9'}
              stroke={options.isHighlighted ? '#4338CA' : '#CBD5E1'}
              strokeWidth={1}
            />
            <text
              x={0}
              y={2}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="600"
              fill={options.isHighlighted ? '#FFFFFF' : '#1E293B'}
              className="font-mono select-none"
            >
              {note.displayLabel}
            </text>
            <text
              x={0}
              y={22}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#64748B"
              className="select-none"
            >
              {note.solfegeLabel}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Key Signature rendering coordinates
  const renderKeySignature = () => {
    if (keySignature === 'C') return null;
    if (keySignature === 'G') {
      // 1 Sharp on F5 (Treble) or F3 (Bass)
      const fStep = clef === 'treble' ? 10 : -4;
      const fy = stepToY(fStep);
      return (
        <g>
          <text
            x={116}
            y={fy + 9}
            fontSize="28"
            fontWeight="700"
            fill="#4F46E5"
            className="select-none font-serif"
          >
            ♯
          </text>
        </g>
      );
    }
    if (keySignature === 'F') {
      // 1 Flat on B4 (Treble) or B2 (Bass)
      const bStep = clef === 'treble' ? 6 : -8;
      const by = stepToY(bStep);
      return (
        <g>
          <text
            x={116}
            y={by + 8}
            fontSize="28"
            fontWeight="700"
            fill="#4F46E5"
            className="select-none font-serif"
          >
            ♭
          </text>
        </g>
      );
    }
    return null;
  };

  const isGuideMode = Array.isArray(guideNotes) && guideNotes.length > 0;
  const viewBoxWidth = isGuideMode ? Math.max(660, 175 + guideNotes.length * 76) : 680;
  const staffEndX = viewBoxWidth - 36;

  return (
    <div className="relative w-full select-none">
      {/* Top Floating Correction / Confirmation Callout */}
      {!isGuideMode && activeNote && feedbackState === 'wrong' && showNoteLabelOnWrong && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2.5 px-4 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-900 shadow-xs"
        >
          <span className="text-xs font-semibold tracking-wide text-red-700">
            Target Note:
          </span>
          <span className="text-sm font-bold font-mono text-red-950">
            {formatNoteBadge(activeNote)}
          </span>
          <span className="text-xs text-red-700">
            — Press {activeNote.solfegeLabel} ({activeNote.displayLabel}) to continue
          </span>
        </div>
      )}

      {!isGuideMode && activeNote && feedbackState === 'correct' && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs"
        >
          <span className="text-xs font-bold text-emerald-700">✓ Correct</span>
          <span className="text-xs font-mono font-semibold text-emerald-950">
            {formatNoteBadge(activeNote)} ({activeNote.frequency} Hz)
          </span>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${isGuideMode ? 280 : 252}`}
          className="w-full h-auto max-h-[260px] mx-auto block"
          role="img"
          aria-label={`${clef === 'treble' ? 'Treble' : 'Bass'} clef musical staff`}
        >
          {/* Subtle Warm Parchment Staff Backing */}
          <rect
            x={16}
            y={20}
            width={viewBoxWidth - 32}
            height={isGuideMode ? 250 : 216}
            rx={14}
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth={1.2}
          />

          {/* Double Barline at Left Margin */}
          <line
            x1={34}
            y1={TOP_LINE_Y}
            x2={34}
            y2={TOP_LINE_Y + 4 * 22}
            stroke="#1E293B"
            strokeWidth={3.5}
          />
          <line
            x1={41}
            y1={TOP_LINE_Y}
            x2={41}
            y2={TOP_LINE_Y + 4 * 22}
            stroke="#1E293B"
            strokeWidth={1.2}
          />

          {/* 5 Horizontal Staff Lines (Top = Line 5, Bottom = Line 1) */}
          {[0, 1, 2, 3, 4].map((idx) => {
            const ly = TOP_LINE_Y + idx * 22;
            const lineNumber = 5 - idx; // 5 down to 1
            return (
              <g key={lineNumber}>
                <line
                  x1={34}
                  y1={ly}
                  x2={staffEndX}
                  y2={ly}
                  stroke="#334155"
                  strokeWidth={1.65}
                />
                {/* Subtle Line Number Reference at far right */}
                <text
                  x={staffEndX + 10}
                  y={ly + 4}
                  fontSize="10"
                  fontWeight="600"
                  fill="#94A3B8"
                  className="font-mono select-none"
                >
                  L{lineNumber}
                </text>
              </g>
            );
          })}

          {/* End Barline */}
          <line
            x1={staffEndX - 6}
            y1={TOP_LINE_Y}
            x2={staffEndX - 6}
            y2={TOP_LINE_Y + 4 * 22}
            stroke="#64748B"
            strokeWidth={1.2}
          />
          <line
            x1={staffEndX}
            y1={TOP_LINE_Y}
            x2={staffEndX}
            y2={TOP_LINE_Y + 4 * 22}
            stroke="#1E293B"
            strokeWidth={3.2}
          />

          {/* Custom Engraved Clef Vector & Landmark Anchor Indicator */}
          {clef === 'treble' ? (
            <g transform="translate(54, 54)">
              {/* Precision Engraved Treble G-Clef SVG Path */}
              <path
                d="M 25 142 C 17 142 12 136 12 129 C 12 122 18 118 23 118 C 28 118 31 122 31 127 C 31 133 24 136 20 134 C 22 138 26 139 30 137 C 35 134 36 126 35 117 L 26 24 C 25 13 19 8 14 14 C 8 21 8 36 17 50 L 38 78 C 49 93 48 113 33 121 C 18 128 3 116 3 98 C 3 79 19 66 34 69 C 44 71 51 80 50 92 C 49 103 40 111 30 109 C 21 107 17 99 20 91 C 22 85 29 83 33 87 C 28 86 24 90 25 96 C 26 101 32 104 37 101 C 42 98 44 91 42 84 C 39 76 30 74 22 77 C 13 81 9 91 11 101 C 13 112 24 117 34 113 C 43 109 45 96 36 83 L 14 53 C 3 38 3 17 13 7 C 21 -1 31 5 32 21 L 41 117 C 42 131 35 142 25 142 Z"
                fill="#1E293B"
              />
              {/* Subtle G4 Line 2 Landmark Indicator Dot */}
              <circle
                cx={62}
                cy={stepToY(4) - 54}
                r={3.2}
                fill="#6366F1"
                opacity={0.65}
              >
                <title>G4 Landmark (Line 2)</title>
              </circle>
            </g>
          ) : (
            <g transform="translate(52, 82)">
              {/* Precision Engraved Bass F-Clef SVG Path */}
              <path
                d="M 18 28 C 12 28 8 23 8 17 C 8 11 13 7 19 7 C 33 7 44 19 44 37 C 44 59 27 77 6 89 L 4 86 C 21 74 34 57 34 36 C 34 21 27 12 18 12 C 14 12 12 15 14 18 C 16 20 21 19 22 23 C 23 26 21 28 18 28 Z"
                fill="#1E293B"
              />
              {/* Bass Clef Two Dots Surrounding Line 4 (F3) */}
              <circle cx={51} cy={19} r={4.2} fill="#1E293B" />
              <circle cx={51} cy={37} r={4.2} fill="#1E293B" />
            </g>
          )}

          {/* Key Signature */}
          {renderKeySignature()}

          {/* Mode 1: Pre-Level Guide Mode (Multiple Notes side-by-side) */}
          {isGuideMode &&
            guideNotes!.map((gNote, idx) => {
              const xPos = 165 + idx * 74;
              return renderNoteOnStaff(gNote, xPos, {
                showBadge: true,
                isInteractiveGuide: true,
                isHighlighted: highlightedGuideNoteId === gNote.id,
              });
            })}

          {/* Mode 2: Active Gameplay Note + Upcoming Queue */}
          {!isGuideMode && !intervalPair && activeNote && (
            <>
              {/* Subtle Upcoming Queue Notes to simulate real sight-reading ahead */}
              {upcomingNotes.slice(0, 2).map((uNote, idx) =>
                renderNoteOnStaff(uNote, 390 + idx * 115, {
                  isGhost: true,
                })
              )}

              {/* Primary Active Note */}
              {renderNoteOnStaff(activeNote, 255, {
                status: feedbackState,
              })}
            </>
          )}

          {/* Mode 3: Sequential Two-Note Interval Training Mode */}
          {!isGuideMode && intervalPair && (() => {
            const x1 = 248;
            const x2 = 432;
            const y1 = stepToY(intervalPair.note1.diatonicStep);
            const y2 = stepToY(intervalPair.note2.diatonicStep);
            const midX = (x1 + x2) / 2;
            const minNoteY = Math.min(y1, y2);
            const arcPeakY = Math.max(28, minNoteY - 36);

            return (
              <g>
                {/* Connecting Melodic Arc from Note 1 to Note 2 */}
                <path
                  d={`M ${x1 + 8} ${y1 - 14} Q ${midX} ${arcPeakY} ${x2 - 8} ${y2 - 14}`}
                  fill="none"
                  stroke={
                    feedbackState === 'correct'
                      ? '#059669'
                      : feedbackState === 'wrong'
                      ? '#DC2626'
                      : '#6366F1'
                  }
                  strokeWidth={2.4}
                  strokeDasharray="5 4"
                />

                {/* Direction & Revealed Interval Distance Pill at Arc Peak */}
                {intervalPair.intervalBadgeText && (
                  <g transform={`translate(${midX}, ${Math.max(36, arcPeakY - 2)})`}>
                    <rect
                      x={-78}
                      y={-13}
                      width={156}
                      height={22}
                      rx={6}
                      fill={
                        feedbackState === 'correct'
                          ? '#D1FAE5'
                          : feedbackState === 'wrong'
                          ? '#FEE2E2'
                          : '#EEF2FF'
                      }
                      stroke={
                        feedbackState === 'correct'
                          ? '#10B981'
                          : feedbackState === 'wrong'
                          ? '#EF4444'
                          : '#C7D2FE'
                      }
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={2}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill={
                        feedbackState === 'correct'
                          ? '#065F46'
                          : feedbackState === 'wrong'
                          ? '#991B1B'
                          : '#3730A3'
                      }
                      className="font-mono select-none"
                    >
                      {intervalPair.intervalBadgeText}
                    </text>
                  </g>
                )}

                {/* Note 1 */}
                {renderNoteOnStaff(intervalPair.note1, x1, {
                  status: feedbackState,
                  isHighlighted:
                    intervalPair.activeSlot === 1 || intervalPair.activeSlot === 'both',
                })}

                {/* Note 2 */}
                {renderNoteOnStaff(intervalPair.note2, x2, {
                  status: feedbackState,
                  isHighlighted:
                    intervalPair.activeSlot === 2 || intervalPair.activeSlot === 'both',
                })}

                {/* Sequential Note Captions below the staff */}
                <text
                  x={x1}
                  y={224}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="700"
                  fill={intervalPair.activeSlot === 1 ? '#4F46E5' : '#475569'}
                  className="font-mono select-none"
                >
                  {intervalPair.revealNames
                    ? `1: ${intervalPair.note1.displayLabel} (${intervalPair.note1.solfegeLabel})`
                    : `Note 1 (${intervalPair.note1.displayLabel})`}
                </text>
                <text
                  x={x2}
                  y={224}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="700"
                  fill={intervalPair.activeSlot === 2 ? '#4F46E5' : '#475569'}
                  className="font-mono select-none"
                >
                  {intervalPair.revealNames
                    ? `2: ${intervalPair.note2.displayLabel} (${intervalPair.note2.solfegeLabel})`
                    : 'Note 2 (?)'}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
};
