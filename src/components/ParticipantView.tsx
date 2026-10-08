import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Lock, CheckCircle2 } from 'lucide-react';
import { TeamGameState, UserSession } from '../types';
import { useSynchronizedTimer } from '../hooks/useRealtimeGame';

interface ParticipantViewProps {
  session: UserSession;
  teamState: TeamGameState | null;
  onUpdateDraft: (answers: string[]) => Promise<void>;
  onSubmitAnswers: (answers: string[]) => Promise<void>;
  onLogout: () => void;
}

export const ParticipantView: React.FC<ParticipantViewProps> = ({
  session,
  teamState,
  onUpdateDraft,
  onSubmitAnswers,
  onLogout,
}) => {
  const [localAnswers, setLocalAnswers] = useState<string[]>(
    Array.from({ length: 12 }, () => '')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lastTrackedQuestionKeyRef = useRef<string>('');
  const draftDebounceRef = useRef<number | null>(null);
  const autoSubmitTriggeredRef = useRef<boolean>(false);
  const latestAnswersRef = useRef<string[]>(localAnswers);

  const timerInfo = useSynchronizedTimer(teamState?.timer ?? null);

  const teamId = teamState?.teamId || session.teamId || 'TEAM';
  const activeQuestionId = teamState?.activeQuestion?.id ?? '';
  const timerStartedAt = teamState?.timer?.startedAt ?? 0;
  const questionRoundKey = `${activeQuestionId}:${timerStartedAt}`;

  // Local storage key to protect participant input across temporary network loss
  const draftStorageKey = `ops_fortune_draft_${teamId}_${activeQuestionId}`;

  useEffect(() => {
    latestAnswersRef.current = localAnswers;
    // Cache draft locally in session storage
    if (activeQuestionId) {
      try {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(localAnswers));
      } catch {
        // ignore
      }
    }
  }, [localAnswers, activeQuestionId, draftStorageKey]);

  // Whenever host switches question or starts a new round, sync local 12 inputs
  useEffect(() => {
    if (!teamState) return;
    if (lastTrackedQuestionKeyRef.current !== questionRoundKey) {
      lastTrackedQuestionKeyRef.current = questionRoundKey;
      autoSubmitTriggeredRef.current = false;

      // Check if draft exists in sessionStorage from current session
      let cachedAnswers: string[] | null = null;
      try {
        const raw = sessionStorage.getItem(draftStorageKey);
        if (raw) cachedAnswers = JSON.parse(raw);
      } catch {
        // ignore
      }

      const serverAnswers =
        teamState.mySubmission?.answers ?? Array.from({ length: 12 }, () => '');

      // Prioritize submitted/server answers if already submitted, or cached if typing
      if (teamState.mySubmission?.submitted) {
        setLocalAnswers(Array.from({ length: 12 }, (_, i) => serverAnswers[i] ?? ''));
      } else if (cachedAnswers && Array.isArray(cachedAnswers) && cachedAnswers.some((a) => a)) {
        setLocalAnswers(Array.from({ length: 12 }, (_, i) => cachedAnswers?.[i] ?? serverAnswers[i] ?? ''));
      } else {
        setLocalAnswers(Array.from({ length: 12 }, (_, i) => serverAnswers[i] ?? ''));
      }
    }
  }, [teamState, questionRoundKey, draftStorageKey]);

  const isLocked =
    Boolean(teamState?.mySubmission?.locked) ||
    Boolean(teamState?.mySubmission?.submitted) ||
    timerInfo.isTimeUp;

  // Auto-submit when timer reaches 0:00 if not already submitted
  useEffect(() => {
    if (
      timerInfo.isTimeUp &&
      teamState?.timer?.status !== 'IDLE' &&
      !teamState?.mySubmission?.submitted &&
      !autoSubmitTriggeredRef.current
    ) {
      autoSubmitTriggeredRef.current = true;
      onSubmitAnswers(latestAnswersRef.current);
    }
  }, [
    timerInfo.isTimeUp,
    teamState?.timer?.status,
    teamState?.mySubmission?.submitted,
    onSubmitAnswers,
  ]);

  const handleInputChange = (index: number, value: string) => {
    if (isLocked) return;
    const updated = [...localAnswers];
    updated[index] = value;
    setLocalAnswers(updated);

    if (draftDebounceRef.current) {
      window.clearTimeout(draftDebounceRef.current);
    }
    draftDebounceRef.current = window.setTimeout(() => {
      onUpdateDraft(updated);
    }, 250);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || isSubmitting) return;
    if (draftDebounceRef.current) {
      window.clearTimeout(draftDebounceRef.current);
    }
    setIsSubmitting(true);
    try {
      await onSubmitAnswers(localAnswers);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeQuestion = teamState?.activeQuestion;
  const isSubmitted = Boolean(teamState?.mySubmission?.submitted);
  const isTimeUp = timerInfo.isTimeUp;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#03182B] flex flex-col justify-between">
      {/* Top Bar: Clean minimal header */}
      <header className="w-full bg-[#03182B] text-[#F5F5F0] border-b border-[#03182B]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-display text-xl font-extrabold tracking-tight">
            OPS FORTUNE
          </div>

          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs font-semibold tracking-widest text-[#F5F5F0]/60 mr-2">
                TEAM:
              </span>
              <span className="font-display text-lg font-extrabold text-[#FF5A0A]">
                {teamState?.teamId || session.teamId || session.displayName}
              </span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-1.5 rounded-full border border-[#F5F5F0]/20 hover:border-[#F5F5F0]/60 text-xs font-medium text-[#F5F5F0]/80 hover:text-[#F5F5F0] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Participant Screen */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 md:py-10 flex flex-col gap-8">
        {/* Question & 60-Second Timer Card */}
        <section className="bg-[#03182B] text-[#F5F5F0] rounded-3xl p-8 md:p-10 border border-[#03182B] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="text-xs md:text-sm font-mono-tabular font-bold tracking-widest text-[#FF5A0A] mb-2">
              {activeQuestion ? `QUESTION ${activeQuestion.number}` : 'STANDBY'}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#F5F5F0] leading-none">
              {activeQuestion ? activeQuestion.word : 'WAITING FOR QUESTION'}
            </h1>
          </div>

          {/* Large Synchronized Timer */}
          <div className="flex flex-col items-center justify-center px-8 py-5 rounded-2xl bg-[#F5F5F0]/5 border border-[#F5F5F0]/15 min-w-[200px]">
            <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-[#F5F5F0]/60 mb-1">
              TIME REMAINING
            </div>
            <div
              className={`font-mono-tabular text-5xl md:text-6xl font-bold tracking-tight leading-none ${
                isTimeUp
                  ? 'text-[#D7263D]'
                  : timerInfo.remainingMs <= 10000 && timerInfo.status === 'RUNNING'
                  ? 'text-[#FF5A0A]'
                  : 'text-[#F5F5F0]'
              }`}
            >
              {timerInfo.formatted}
            </div>
          </div>
        </section>

        {/* Section 10: TIME'S UP / YOUR ANSWERS HAVE BEEN SUBMITTED banner */}
        {(isTimeUp || isSubmitted) && (
          <section
            className={`rounded-3xl p-6 border text-center transition-all ${
              isTimeUp
                ? 'bg-[#D7263D] text-[#F5F5F0] border-[#D7263D]'
                : 'bg-[#03182B] text-[#F5F5F0] border-[#03182B]'
            }`}
          >
            <div className="space-y-1">
              {isTimeUp && (
                <div className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">
                  TIME&apos;S UP
                </div>
              )}
              <div className="font-display text-xl md:text-2xl font-bold tracking-wide flex items-center justify-center gap-2">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <span>
                  {isTimeUp ? 'YOUR ANSWERS HAVE BEEN SUBMITTED.' : 'ANSWERS SUBMITTED'}
                </span>
              </div>
            </div>
            <p className="text-xs text-white/80 mt-2 font-mono-tabular tracking-wider uppercase">
              SUBMITTED / WAITING FOR HOST
            </p>
          </section>
        )}

        {/* Exactly 12 Empty Answer Fields */}
        <form onSubmit={handleManualSubmit} className="bg-white rounded-3xl p-6 md:p-8 border border-[#03182B]/15">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#03182B]/10">
            <h2 className="font-display text-lg md:text-xl font-extrabold tracking-tight text-[#03182B]">
              ENTER 12 ASSOCIATED WORDS
            </h2>
            {isLocked && (
              <span className="text-xs font-mono-tabular font-semibold text-[#D7263D] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                LOCKED
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {localAnswers.map((ans, idx) => (
              <div
                key={idx}
                className={`flex items-center rounded-2xl border px-4 py-3 transition-colors ${
                  isLocked
                    ? 'bg-[#F5F5F0] border-[#03182B]/15 opacity-80'
                    : 'bg-[#F5F5F0]/60 border-[#03182B]/20 focus-within:border-[#D7263D] focus-within:bg-white'
                }`}
              >
                <span className="font-mono-tabular text-sm font-bold text-[#03182B]/60 w-8 shrink-0 select-none">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={ans}
                  disabled={isLocked}
                  onChange={(e) => handleInputChange(idx, e.target.value)}
                  placeholder={isLocked ? '' : `Associated word ${idx + 1}`}
                  aria-label={`Associated word ${idx + 1}`}
                  className="w-full bg-transparent text-[#03182B] font-medium text-base focus:outline-none disabled:cursor-not-allowed"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isLocked || isSubmitting}
              className={`w-full md:w-auto min-w-[280px] px-10 py-4 rounded-full font-display font-extrabold text-base tracking-wide transition-colors ${
                isLocked
                  ? 'bg-[#03182B]/20 text-[#03182B]/50 cursor-not-allowed'
                  : 'bg-[#D7263D] hover:bg-[#FF5A0A] text-[#F5F5F0] cursor-pointer'
              }`}
            >
              {isSubmitted ? 'ANSWERS SUBMITTED' : isSubmitting ? 'SUBMITTING...' : 'SUBMIT ANSWERS'}
            </button>
          </div>
        </form>
      </main>

      <footer className="w-full py-4 px-6 border-t border-[#03182B]/10 text-center text-xs text-[#03182B]/60">
        OPS FORTUNE · MBA Operations Management Event
      </footer>
    </div>
  );
};
