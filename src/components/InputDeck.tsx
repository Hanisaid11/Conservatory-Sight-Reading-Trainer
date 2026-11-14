import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, Piano, Grid, Radio, CheckCircle2 } from 'lucide-react';
import {
  Accidental,
  ALL_NOTES_LIST,
  NATURAL_NOTES_LIST,
  NoteLetter,
  NoteSpec,
} from '../data/curriculum';
import { audioEngine, MicPitchReading } from '../services/audioEngine';

export type InputMethod = 'buttons' | 'piano' | 'microphone';
export type LabelFormat = 'both' | 'solfege' | 'letter';

interface InputDeckProps {
  inputMethod: InputMethod;
  onChangeInputMethod: (method: InputMethod) => void;
  labelFormat: LabelFormat;
  onChangeLabelFormat: (fmt: LabelFormat) => void;
  showPianoHints: boolean;
  onTogglePianoHints: () => void;
  clef: 'treble' | 'bass';
  hasAccidentals: boolean;
  targetNote: NoteSpec;
  feedbackState: 'idle' | 'correct' | 'wrong';
  onSubmitAnswer: (ans: {
    letter: NoteLetter;
    accidental: Accidental;
    midi?: number;
    checkOctave?: boolean;
  }) => void;
  midiConnectedDevices: string[];
}

const NATURAL_BUTTONS: { letter: NoteLetter; solfege: string }[] = [
  { letter: 'C', solfege: 'Do' },
  { letter: 'D', solfege: 'Re' },
  { letter: 'E', solfege: 'Mi' },
  { letter: 'F', solfege: 'Fa' },
  { letter: 'G', solfege: 'Sol' },
  { letter: 'A', solfege: 'La' },
  { letter: 'B', solfege: 'Si' },
];

const CHROMATIC_BUTTONS: {
  letter: NoteLetter;
  accidental: Accidental;
  solfege: string;
  display: string;
  pitchClass: number;
}[] = [
  { letter: 'C', accidental: '#', solfege: 'Do♯ / Re♭', display: 'C♯ / D♭', pitchClass: 1 },
  { letter: 'E', accidental: 'b', solfege: 'Re♯ / Mi♭', display: 'D♯ / E♭', pitchClass: 3 },
  { letter: 'F', accidental: '#', solfege: 'Fa♯ / Sol♭', display: 'F♯ / G♭', pitchClass: 6 },
  { letter: 'G', accidental: '#', solfege: 'Sol♯ / La♭', display: 'G♯ / A♭', pitchClass: 8 },
  { letter: 'B', accidental: 'b', solfege: 'La♯ / Si♭', display: 'A♯ / B♭', pitchClass: 10 },
];

export const InputDeck: React.FC<InputDeckProps> = ({
  inputMethod,
  onChangeInputMethod,
  labelFormat,
  onChangeLabelFormat,
  showPianoHints,
  onTogglePianoHints,
  clef,
  hasAccidentals,
  targetNote,
  feedbackState,
  onSubmitAnswer,
  midiConnectedDevices,
}) => {
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micReading, setMicReading] = useState<MicPitchReading | null>(null);
  const [micStrictOctave, setMicStrictOctave] = useState(false);
  const [pianoRangeMode, setPianoRangeMode] = useState<'auto' | 'full'>('auto');

  // Manage Microphone lifecycle when switching to/from 'microphone' tab
  useEffect(() => {
    if (inputMethod === 'microphone') {
      let mounted = true;
      setMicError(null);
      audioEngine
        .startMicrophone(
          (reading) => {
            if (mounted) setMicReading(reading);
          },
          (detectedNote) => {
            if (!mounted) return;
            onSubmitAnswer({
              letter: detectedNote.letter,
              accidental: detectedNote.accidental,
              midi: detectedNote.midi,
              checkOctave: micStrictOctave,
            });
          }
        )
        .then((res) => {
          if (!mounted) return;
          if (res.ok) {
            setMicActive(true);
          } else {
            setMicActive(false);
            setMicError(res.error || 'Could not access microphone.');
          }
        });

      return () => {
        mounted = false;
        audioEngine.stopMicrophone();
        setMicActive(false);
        setMicReading(null);
      };
    } else {
      audioEngine.stopMicrophone();
      setMicActive(false);
      setMicReading(null);
    }
  }, [inputMethod, micStrictOctave, onSubmitAnswer]);

  // Determine 2-octave window for Interactive Mini Piano Keyboard
  const getPianoNotes = () => {
    if (pianoRangeMode === 'full') {
      return NATURAL_NOTES_LIST; // G2 to C6
    }
    // Smart 2-octave window centered around active clef & targetNote
    if (clef === 'bass' && targetNote.diatonicStep < 0) {
      // G2 (step -10) to C4 (step 0) -> 18 white keys (2.5 octaves)
      return NATURAL_NOTES_LIST.filter((n) => n.diatonicStep >= -10 && n.diatonicStep <= 2);
    }
    // Treble default: A3 (step -2) to C6 (step 14)
    return NATURAL_NOTES_LIST.filter((n) => n.diatonicStep >= -2 && n.diatonicStep <= 14);
  };

  const whiteKeys = getPianoNotes();

  const findBlackKeyAfter = (whiteNote: NoteSpec): NoteSpec | null => {
    if (['E', 'B'].includes(whiteNote.letter)) return null;
    if (whiteNote.id === 'C6') return null;
    const targetMidi = whiteNote.midi + 1;
    // Prefer matching spelling if targetNote is flat vs sharp
    if (targetNote.midi === targetMidi) return targetNote;
    return ALL_NOTES_LIST.find((n) => n.midi === targetMidi && n.accidental !== '') || null;
  };

  const formatButtonPrimary = (solfege: string, letter: string) => {
    if (labelFormat === 'solfege') return solfege;
    if (labelFormat === 'letter') return letter;
    return `${solfege} (${letter})`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
      {/* Input Deck Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        {/* Segmented Control for 3 Input Modes */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => onChangeInputMethod('buttons')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              inputMethod === 'buttons'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5 text-indigo-600" />
            <span>Solfège / Letters</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeInputMethod('piano')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              inputMethod === 'piano'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Piano className="w-3.5 h-3.5 text-indigo-600" />
            <span>Piano Keyboard</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeInputMethod('microphone')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              inputMethod === 'microphone'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mic Pitch (Sing / Play)</span>
          </button>
        </div>

        {/* Context Options: Label Format, Piano Hints, & MIDI status */}
        <div className="flex flex-wrap items-center gap-2">
          {inputMethod === 'buttons' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              {(['both', 'solfege', 'letter'] as LabelFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onChangeLabelFormat(fmt)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    labelFormat === fmt
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fmt === 'both' ? 'Do (C)' : fmt === 'solfege' ? 'Solfège' : 'Letters'}
                </button>
              ))}
            </div>
          )}

          {inputMethod === 'piano' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTogglePianoHints}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showPianoHints
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {showPianoHints ? 'Key Hints: On' : 'Key Hints: Off'}
              </button>
              <button
                type="button"
                onClick={() => setPianoRangeMode((m) => (m === 'auto' ? 'full' : 'auto'))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {pianoRangeMode === 'auto' ? 'Range: 2-Octave Focus' : 'Range: Full G2–C6'}
              </button>
            </div>
          )}

          {midiConnectedDevices.length > 0 && (
            <span className="text-xs text-emerald-700 font-medium whitespace-nowrap">
              MIDI Active: {midiConnectedDevices[0]}
            </span>
          )}
        </div>
      </div>

      {/* MODE A: SOLFEGE / LETTER ERGONOMIC TOUCH BUTTONS */}
      {inputMethod === 'buttons' && (
        <div className="space-y-3">
          {/* Optional Chromatic Sharp/Flat Row when level uses accidentals */}
          {hasAccidentals && (
            <div className="grid grid-cols-5 gap-2 max-w-2xl mx-auto">
              {CHROMATIC_BUTTONS.map((cb) => {
                const isTargetOnWrong =
                  feedbackState === 'wrong' &&
                  targetNote.accidental !== '' &&
                  targetNote.pitchClass === cb.pitchClass;

                return (
                  <button
                    key={cb.display}
                    type="button"
                    onClick={() =>
                      onSubmitAnswer({
                        letter: targetNote.pitchClass === cb.pitchClass ? targetNote.letter : cb.letter,
                        accidental:
                          targetNote.pitchClass === cb.pitchClass
                            ? targetNote.accidental
                            : cb.accidental,
                        midi:
                          targetNote.pitchClass === cb.pitchClass ? targetNote.midi : undefined,
                        checkOctave: false,
                      })
                    }
                    className={`py-2.5 px-2 rounded-xl border text-center transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                      isTargetOnWrong
                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm ring-2 ring-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold whitespace-nowrap">
                      {labelFormat === 'solfege'
                        ? cb.solfege
                        : labelFormat === 'letter'
                        ? cb.display
                        : cb.display}
                    </div>
                    {labelFormat === 'both' && (
                      <div className="text-[11px] text-slate-300 font-medium whitespace-nowrap">
                        {cb.solfege}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Primary 7 Diatonic Buttons: Do Re Mi Fa Sol La Si */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {NATURAL_BUTTONS.map(({ letter, solfege }) => {
              const isTargetOnWrong =
                feedbackState === 'wrong' &&
                targetNote.letter === letter &&
                targetNote.accidental === '';

              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() =>
                    onSubmitAnswer({
                      letter,
                      accidental: '',
                      checkOctave: false,
                    })
                  }
                  className={`group flex flex-col items-center justify-center min-h-[68px] sm:min-h-[82px] px-2 py-3 rounded-xl border transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                    isTargetOnWrong
                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm ring-4 ring-emerald-200'
                      : 'bg-slate-50/80 hover:bg-indigo-50/70 border-slate-200 hover:border-indigo-300 text-slate-900'
                  }`}
                >
                  <span
                    className={`text-base sm:text-xl font-bold tracking-tight whitespace-nowrap ${
                      isTargetOnWrong
                        ? 'text-white'
                        : 'text-slate-900 group-hover:text-indigo-950'
                    }`}
                  >
                    {formatButtonPrimary(solfege, letter)}
                  </span>
                  {labelFormat === 'both' && (
                    <span
                      className={`text-[11px] font-medium mt-0.5 whitespace-nowrap ${
                        isTargetOnWrong ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      {letter} natural
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE B: INTERACTIVE 2-OCTAVE PIANO KEYBOARD */}
      {inputMethod === 'piano' && (
        <div className="w-full overflow-x-auto pb-2">
          <div className="relative flex min-w-[580px] h-44 sm:h-48 select-none mx-auto max-w-4xl">
            {whiteKeys.map((wNote) => {
              const blackNote = findBlackKeyAfter(wNote);
              const isWhiteTargetOnWrong =
                feedbackState === 'wrong' && targetNote.midi === wNote.midi;
              const isBlackTargetOnWrong =
                blackNote && feedbackState === 'wrong' && targetNote.midi === blackNote.midi;
              const isMiddleC = wNote.id === 'C4';

              return (
                <div key={wNote.id} className="relative flex-1 flex">
                  {/* White Piano Key */}
                  <button
                    type="button"
                    onClick={() =>
                      onSubmitAnswer({
                        letter: wNote.letter,
                        accidental: '',
                        midi: wNote.midi,
                        checkOctave: true,
                      })
                    }
                    className={`w-full h-full rounded-b-xl border border-slate-300 flex flex-col items-center justify-end pb-3 transition-colors duration-100 cursor-pointer active:translate-y-0.5 ${
                      isWhiteTargetOnWrong
                        ? 'bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-300'
                        : isMiddleC
                        ? 'bg-indigo-50/50 hover:bg-indigo-100/60 text-slate-800'
                        : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {(showPianoHints || isMiddleC || isWhiteTargetOnWrong) && (
                      <div className="flex flex-col items-center leading-tight">
                        <span
                          className={`text-[11px] font-bold font-mono ${
                            isWhiteTargetOnWrong
                              ? 'text-white'
                              : isMiddleC
                              ? 'text-indigo-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {wNote.id}
                        </span>
                        {showPianoHints && (
                          <span
                            className={`text-[10px] ${
                              isWhiteTargetOnWrong ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            {wNote.solfege}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Black Piano Key (Sharp / Flat) */}
                  {blackNote && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSubmitAnswer({
                          letter: blackNote.letter,
                          accidental: blackNote.accidental,
                          midi: blackNote.midi,
                          checkOctave: true,
                        });
                      }}
                      style={{ left: '68%', width: '64%' }}
                      className={`absolute top-0 z-20 h-[60%] rounded-b-lg border flex flex-col items-center justify-end pb-2 transition-colors duration-100 cursor-pointer active:translate-y-0.5 ${
                        isBlackTargetOnWrong
                          ? 'bg-emerald-500 border-emerald-600 text-white ring-2 ring-emerald-300'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-950 text-white shadow-sm'
                      }`}
                    >
                      {(showPianoHints || isBlackTargetOnWrong) && (
                        <span className="text-[10px] font-mono font-semibold text-slate-200">
                          {blackNote.displayLabel.replace(/[0-9]/g, '')}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE C: MICROPHONE REAL-TIME AUTOCORRELATION PITCH DETECTOR */}
      {inputMethod === 'microphone' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            {/* Left Status & Controls */}
            <div className="md:col-span-4 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    micActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {micActive ? 'Acoustic Pitch Listener Active' : 'Microphone Offline'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Sing or play the note on your instrument
                  </div>
                </div>
              </div>

              {micError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {micError} — You can also use the Acoustic Pitch Simulator buttons below.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => audioEngine.playPianoNote(targetNote.frequency, 1.1, 0.3)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Hear Target Pitch</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMicStrictOctave((s) => !s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    micStrictOctave
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  {micStrictOctave ? 'Octave: Exact Match' : 'Octave: Voice Flexible'}
                </button>
              </div>
            </div>

            {/* Center Live Pitch & Cents Needle Gauge */}
            <div className="md:col-span-5 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-3.5 min-h-[104px]">
              {micReading ? (
                <div className="w-full space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                        {micReading.note.displayLabel}
                      </span>
                      <span className="text-sm font-semibold text-indigo-600">
                        {micReading.note.solfegeLabel}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      {micReading.frequency.toFixed(1)} Hz ({micReading.cents > 0 ? '+' : ''}
                      {micReading.cents}c)
                    </span>
                  </div>

                  {/* Cents Tuning Deviation Bar (-50c to +50c) */}
                  <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400 z-10" />
                    <div
                      className={`absolute top-0 bottom-0 w-3 rounded-full transition-all duration-75 ${
                        Math.abs(micReading.cents) <= 18 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{
                        left: `calc(${Math.min(
                          95,
                          Math.max(5, 50 + micReading.cents)
                        )}% - 6px)`,
                      }}
                    />
                  </div>

                  {/* Note Stability Lock Progress */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Pitch Lock Stability</span>
                    <span className="font-mono tabular-nums">
                      {Math.round(micReading.holdProgress * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-75"
                      style={{ width: `${Math.round(micReading.holdProgress * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-1 py-2">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Radio className="w-4 h-4 text-emerald-600" />
                    <span>Listening for fundamental frequency (80 Hz – 1,200 Hz)...</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Sing a steady vowel (&ldquo;La&rdquo; or &ldquo;Dah&rdquo;) or play a clear note on your instrument
                  </p>
                </div>
              )}
            </div>

            {/* Right Target Hint / Test Acoustic Trigger */}
            <div className="md:col-span-3 flex flex-col justify-between gap-2">
              <div className="text-xs font-semibold text-slate-600">
                Simulate Acoustic Note Input:
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {NATURAL_BUTTONS.map(({ letter, solfege }) => {
                  const isRight =
                    feedbackState === 'wrong' && targetNote.letter === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() =>
                        onSubmitAnswer({
                          letter,
                          accidental:
                            targetNote.letter === letter ? targetNote.accidental : '',
                          midi: targetNote.letter === letter ? targetNote.midi : undefined,
                          checkOctave: false,
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        isRight
                          ? 'bg-emerald-600 border-emerald-700 text-white'
                          : 'bg-white hover:bg-indigo-50 border-slate-200 text-slate-800'
                      }`}
                      title={`Simulate singing ${solfege} (${letter})`}
                    >
                      {letter}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    onSubmitAnswer({
                      letter: targetNote.letter,
                      accidental: targetNote.accidental,
                      midi: targetNote.midi,
                      checkOctave: true,
                    })
                  }
                  className="py-1.5 px-2 rounded-lg text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center justify-center"
                  title="Simulate singing the exact target frequency"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
