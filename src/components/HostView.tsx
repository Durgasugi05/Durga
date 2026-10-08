import React, { useEffect, useState } from 'react';
import {
  Play,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  LogOut,
  Edit3,
  Clock,
  CheckCircle2,
  Hourglass,
  ExternalLink,
  SlidersHorizontal,
  X,
  Check,
  ChevronRight,
  Database,
  Info,
} from 'lucide-react';
import {
  HostGameState,
  Question,
  TeamId,
  UserSession,
} from '../types';
import { useSynchronizedTimer } from '../hooks/useRealtimeGame';
import { getConnectionStatus, FirebaseConnectionStatus } from '../firebase/firebaseService';

interface HostViewProps {
  session: UserSession;
  hostState: HostGameState | null;
  apiCall: <T = unknown>(path: string, method?: string, body?: unknown) => Promise<T | null>;
  onLogout: () => void;
}

const TEAMS: TeamId[] = ['HR', 'Marketing', 'Finance', 'AI'];

export const HostView: React.FC<HostViewProps> = ({
  session,
  hostState,
  apiCall,
  onLogout,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<TeamId>('HR');

  // Question editing
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState<string>('');

  // Add Question modal/state
  const [isAddingQuestion, setIsAddingQuestion] = useState<boolean>(false);
  const [newQuestionWord, setNewQuestionWord] = useState<string>('');

  // Firebase Info Modal
  const [showFirebaseModal, setShowFirebaseModal] = useState<boolean>(false);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseConnectionStatus>(getConnectionStatus());

  const timerInfo = useSynchronizedTimer(hostState?.timer ?? null);

  const questions = hostState?.questions ?? [];
  const activeQuestion: Question | null =
    questions.find((q) => q.id === hostState?.activeQuestionId) ?? questions[0] ?? null;

  useEffect(() => {
    setFirebaseStatus(getConnectionStatus());
  }, []);

  const handleSelectQuestion = async (questionId: string) => {
    setEditingQuestionId(null);
    await apiCall('/api/host/select-question', 'POST', { questionId });
  };

  const handleStartQuestion = async () => {
    if (!activeQuestion) return;
    await apiCall('/api/host/start-question', 'POST', { questionId: activeQuestion.id });
  };

  const handleNextQuestion = async () => {
    await apiCall('/api/host/questions/next', 'POST');
  };

  const handleEndTimerNow = async () => {
    await apiCall('/api/host/end-timer-now', 'POST');
  };

  const handleAddQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionWord.trim()) return;
    const res = await apiCall<{ createdQuestionId?: string }>('/api/host/questions', 'POST', {
      word: newQuestionWord.trim().toUpperCase(),
    });
    setNewQuestionWord('');
    setIsAddingQuestion(false);
    if (res?.createdQuestionId) {
      await apiCall('/api/host/select-question', 'POST', {
        questionId: res.createdQuestionId,
      });
    }
  };

  const handleStartEdit = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditingWord(q.word);
  };

  const handleSaveEdit = async (questionId: string) => {
    if (!editingWord.trim()) return;
    await apiCall(`/api/host/questions/${questionId}`, 'PUT', {
      word: editingWord.trim().toUpperCase(),
    });
    setEditingQuestionId(null);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (questions.length <= 1) return;
    await apiCall(`/api/host/questions/${questionId}`, 'DELETE');
  };

  const handleMoveQuestion = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    await apiCall('/api/host/questions/reorder', 'POST', {
      orderedIds: reordered.map((q) => q.id),
    });
  };

  const activeSubmissions = activeQuestion
    ? hostState?.submissionsByQuestion[activeQuestion.id]
    : undefined;

  const selectedTeamSubmission = activeSubmissions?.[selectedTeam];

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#03182B] flex flex-col">
      {/* Top Bar: Brand, Navigation Context, Actions */}
      <header className="w-full bg-[#03182B] text-[#F5F5F0] border-b border-[#03182B]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-display text-xl font-extrabold tracking-tight text-[#F5F5F0] whitespace-nowrap">
              OPS FORTUNE
            </span>

            {/* Firebase Realtime Sync Status Badge */}
            <button
              type="button"
              onClick={() => setShowFirebaseModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F5F0]/10 hover:bg-[#F5F5F0]/20 text-[11px] font-mono-tabular text-[#FF5A0A] font-semibold border border-[#F5F5F0]/15 cursor-pointer"
            >
              <Database className="w-3 h-3 text-[#FF5A0A]" />
              <span>Firebase Realtime DB · Multi-Device Sync</span>
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-[#F5F5F0]/75">
            <span>HOST DASHBOARD</span>
            <span>·</span>
            <span>ANSWER COLLECTION SYSTEM</span>
            <span>·</span>
            <span>4 TEAMS (HR · MARKETING · FINANCE · AI)</span>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-full border border-[#F5F5F0]/25 hover:border-[#F5F5F0] text-xs font-semibold text-[#F5F5F0] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out ({session.displayName})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Firebase Realtime Database Status Modal */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 bg-[#03182B]/60 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 border border-[#03182B]/20 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#03182B]/10">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#FF5A0A]" />
                <h3 className="font-display text-xl font-extrabold text-[#03182B]">
                  Firebase Realtime Database
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="p-1 rounded-full text-[#03182B]/60 hover:text-[#D7263D] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#03182B]/80">
              <div className="p-4 rounded-2xl bg-[#F5F5F0] border border-[#03182B]/10 space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-[#03182B]">Database Status:</span>
                  <span className="font-mono-tabular font-bold text-[#FF5A0A]">
                    {firebaseStatus.isConfigured ? 'Connected to Firebase Project' : 'Real-Time Multi-Device Hub Active'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-[#03182B]">Single Deployed URL:</span>
                  <span className="font-mono-tabular text-right truncate max-w-[220px]">
                    {window.location.origin}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-[#03182B]">Synchronization:</span>
                  <span className="font-mono-tabular text-[#D7263D] font-bold">
                    Zero-Refresh Real-Time
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-[#03182B] block mb-1">
                  Database Structure (Single Source of Truth):
                </span>
                <pre className="p-3.5 rounded-xl bg-[#03182B] text-[#F5F5F0] font-mono-tabular text-[11px] overflow-x-auto leading-relaxed">
{`gameState/
  activeQuestionId
  status
  startTimestamp
  endTimestamp
questions/{questionId}/
  questionNumber
  questionText
submissions/{questionId}/{teamId}/
  answers/ { 1..12 }
  submittedAt
  status
users/{userId}/
  role, teamId`}
                </pre>
              </div>

              <p className="text-[#03182B]/70">
                All 5 devices (Host, HR, Marketing, Finance, AI) open the <strong>same URL</strong>. The authenticated login determines their view, and all questions & submissions update simultaneously without browser refresh.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowFirebaseModal(false)}
              className="w-full py-3 rounded-full bg-[#03182B] hover:bg-[#D7263D] text-[#F5F5F0] font-bold text-xs tracking-wide transition-colors cursor-pointer"
            >
              Close Info
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* CURRENT QUESTION & 60-SECOND TIMER BANNER */}
        <section className="bg-[#03182B] text-[#F5F5F0] rounded-3xl p-8 border border-[#03182B] flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <div className="text-xs font-mono-tabular font-bold tracking-widest text-[#FF5A0A] mb-2">
              CURRENT QUESTION
            </div>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#F5F5F0]">
              {activeQuestion
                ? `QUESTION ${activeQuestion.order} — ${activeQuestion.word}`
                : 'NO QUESTION SELECTED'}
            </h1>
            <p className="text-sm text-[#F5F5F0]/70 mt-2">
              Clicking START QUESTION activates this question on all 4 team screens in real time and begins the synchronized 60-second timer.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 shrink-0">
            {/* 60-Second Synchronized Timer */}
            <div className="px-7 py-4 rounded-2xl bg-[#F5F5F0]/5 border border-[#F5F5F0]/15 text-center min-w-[180px]">
              <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-[#F5F5F0]/60 mb-1 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#FF5A0A]" />
                <span>
                  {timerInfo.status === 'RUNNING'
                    ? 'TIME REMAINING'
                    : timerInfo.status === 'ENDED'
                    ? "TIME'S UP"
                    : '60-SECOND TIMER'}
                </span>
              </div>
              <div
                className={`font-mono-tabular text-4xl md:text-5xl font-bold tracking-tight ${
                  timerInfo.isTimeUp
                    ? 'text-[#D7263D]'
                    : timerInfo.status === 'RUNNING'
                    ? 'text-[#FF5A0A]'
                    : 'text-[#F5F5F0]'
                }`}
              >
                {timerInfo.formatted}
              </div>
            </div>

            {/* Host Action Controls */}
            <div className="flex flex-col gap-2.5 w-full sm:w-auto">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartQuestion}
                  className="px-8 py-4 rounded-full bg-[#D7263D] hover:bg-[#FF5A0A] text-[#F5F5F0] font-display font-extrabold text-sm md:text-base tracking-wide transition-colors flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>START QUESTION</span>
                </button>

                {/* Section 13: NEXT QUESTION button */}
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="px-6 py-4 rounded-full bg-[#F5F5F0]/10 hover:bg-[#F5F5F0]/20 text-[#F5F5F0] font-display font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Move to Next Question"
                >
                  <span>NEXT QUESTION</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {timerInfo.status === 'RUNNING' && (
                <button
                  type="button"
                  onClick={handleEndTimerNow}
                  className="px-6 py-2 rounded-full bg-[#F5F5F0]/10 hover:bg-[#D7263D] text-xs font-bold text-[#F5F5F0] transition-colors cursor-pointer whitespace-nowrap"
                >
                  End Timer Now (Lock & Submit)
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 2-COLUMN WORKSPACE: Left = Question Bank | Right = Submissions & 12 Answers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT 5 COLUMNS: QUESTION LIST (ADD, EDIT, DELETE, REORDER) */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-3xl p-6 md:p-7 border border-[#03182B]/15">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#03182B]/10">
                <div>
                  <h2 className="font-display text-xl font-extrabold text-[#03182B]">
                    QUESTION BANK
                  </h2>
                  <p className="text-xs text-[#03182B]/65 mt-0.5">
                    Click to activate, edit, or reorder questions
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingQuestion((prev) => !prev)}
                  className="px-4 py-2 rounded-full bg-[#03182B] hover:bg-[#D7263D] text-[#F5F5F0] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Question</span>
                </button>
              </div>

              {/* Add Question Input Form */}
              {isAddingQuestion && (
                <form
                  onSubmit={handleAddQuestionSubmit}
                  className="mb-5 p-4 rounded-2xl bg-[#F5F5F0] border border-[#03182B]/20 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold tracking-wider text-[#03182B]">
                      ADD QUESTION {questions.length + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingQuestion(false)}
                      className="text-xs text-[#03182B]/60 hover:text-[#D7263D] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={newQuestionWord}
                      onChange={(e) => setNewQuestionWord(e.target.value)}
                      placeholder="e.g., INVENTORY or PROCUREMENT"
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#03182B]/20 font-display font-extrabold text-sm text-[#03182B] uppercase focus:outline-none focus:border-[#D7263D]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-full bg-[#D7263D] hover:bg-[#03182B] text-[#F5F5F0] font-display font-bold text-xs tracking-wide transition-colors cursor-pointer"
                  >
                    Save Question
                  </button>
                </form>
              )}

              {/* Question Items */}
              <div className="space-y-3">
                {questions.map((q, idx) => {
                  const isActive = q.id === activeQuestion?.id;
                  const isEditingThis = editingQuestionId === q.id;

                  return (
                    <div
                      key={q.id}
                      className={`rounded-2xl p-4 border transition-all ${
                        isActive
                          ? 'bg-[#03182B] text-[#F5F5F0] border-[#03182B]'
                          : 'bg-[#F5F5F0]/70 hover:bg-[#F5F5F0] text-[#03182B] border-[#03182B]/15'
                      }`}
                    >
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <div className="text-[11px] font-mono-tabular font-bold opacity-75">
                            EDIT QUESTION {q.order}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingWord}
                              onChange={(e) => setEditingWord(e.target.value)}
                              className="flex-1 px-3 py-1.5 rounded-xl bg-white text-[#03182B] text-sm font-bold uppercase focus:outline-none focus:border-[#D7263D]"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(q.id)}
                              className="p-2 rounded-xl bg-[#FF5A0A] text-[#F5F5F0] hover:bg-[#D7263D] cursor-pointer"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingQuestionId(null)}
                              className="p-2 rounded-xl bg-[#F5F5F0]/20 text-current hover:bg-[#F5F5F0]/30 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handleSelectQuestion(q.id)}
                            className="flex-1 text-left cursor-pointer"
                          >
                            <div
                              className={`text-[11px] font-mono-tabular font-bold tracking-wider ${
                                isActive ? 'text-[#FF5A0A]' : 'text-[#03182B]/60'
                              }`}
                            >
                              QUESTION {q.order} {isActive ? '· ACTIVE' : ''}
                            </div>
                            <div className="font-display text-lg font-extrabold tracking-tight">
                              {q.word}
                            </div>
                          </button>

                          {/* Action icons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(q)}
                              title="Edit Question Text"
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isActive ? 'hover:bg-[#F5F5F0]/15' : 'hover:bg-[#03182B]/10'
                              }`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveQuestion(idx, -1)}
                              title="Move Up"
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 ${
                                isActive ? 'hover:bg-[#F5F5F0]/15' : 'hover:bg-[#03182B]/10'
                              }`}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === questions.length - 1}
                              onClick={() => handleMoveQuestion(idx, 1)}
                              title="Move Down"
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 ${
                                isActive ? 'hover:bg-[#F5F5F0]/15' : 'hover:bg-[#03182B]/10'
                              }`}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>

                            {questions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(q.id)}
                                title="Delete Question"
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isActive
                                    ? 'text-[#F5F5F0]/70 hover:text-[#D7263D] hover:bg-[#F5F5F0]/15'
                                    : 'text-[#03182B]/60 hover:text-[#D7263D] hover:bg-[#03182B]/10'
                                }`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* RIGHT 7 COLUMNS: HOST SUBMISSION VIEW & TEAM ANSWERS */}
          <div className="lg:col-span-7 space-y-6">
            {/* Team Submission Status Grid */}
            <section className="bg-white rounded-3xl p-6 md:p-7 border border-[#03182B]/15">
              <div className="mb-5 pb-4 border-b border-[#03182B]/10">
                <h2 className="font-display text-xl font-extrabold text-[#03182B]">
                  TEAM SUBMISSIONS
                </h2>
                <p className="text-xs text-[#03182B]/65 mt-0.5">
                  {activeQuestion
                    ? `QUESTION ${activeQuestion.order} — ${activeQuestion.word} · Click a team to inspect their 12 answers`
                    : 'Select a question'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TEAMS.map((teamId) => {
                  const sub = activeSubmissions?.[teamId];
                  const isSelected = selectedTeam === teamId;
                  const filledCount =
                    sub?.answers.filter((a) => a && a.trim().length > 0).length ?? 0;

                  return (
                    <button
                      key={teamId}
                      type="button"
                      onClick={() => setSelectedTeam(teamId)}
                      className={`text-left rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#03182B] text-[#F5F5F0] border-[#03182B]'
                          : 'bg-[#F5F5F0]/70 hover:bg-[#F5F5F0] text-[#03182B] border-[#03182B]/15'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-display text-2xl font-extrabold tracking-tight uppercase">
                          {teamId}
                        </span>
                        {sub?.submitted ? (
                          <span
                            className={`text-xs font-mono-tabular font-bold flex items-center gap-1 ${
                              isSelected ? 'text-[#FF5A0A]' : 'text-[#D7263D]'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>✓ SUBMITTED</span>
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-mono-tabular font-semibold flex items-center gap-1 ${
                              isSelected ? 'text-[#F5F5F0]/70' : 'text-[#03182B]/60'
                            }`}
                          >
                            <Hourglass className="w-3.5 h-3.5" />
                            <span>WAITING</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono-tabular pt-2 border-t border-current/10">
                        {sub?.submitted ? (
                          <span>
                            12 answers ({filledCount} filled) · Submitted at {sub.submittedAtFormatted}
                          </span>
                        ) : (
                          <span>
                            {filledCount > 0
                              ? `Typing live (${filledCount}/12 words)`
                              : 'Waiting for team'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Selected Team 12 Answers Display (Section 12: EXACT Submitted Answers) */}
            {activeQuestion && (
              <section className="bg-white rounded-3xl p-6 md:p-7 border border-[#03182B]/15">
                <div className="mb-6 pb-5 border-b border-[#03182B]/10">
                  <h3 className="font-display text-2xl font-extrabold text-[#03182B]">
                    {selectedTeam.toUpperCase()} — SUBMITTED ANSWERS
                  </h3>
                  <div className="text-xs font-mono-tabular text-[#03182B]/70 mt-1 space-x-3">
                    <span>
                      Question: <strong className="text-[#03182B]">{activeQuestion.word}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Submitted at:{' '}
                      <strong className="text-[#D7263D]">
                        {selectedTeamSubmission?.submittedAtFormatted ??
                          (selectedTeamSubmission?.submitted
                            ? 'Submitted'
                            : 'Waiting / Typing')}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* 12 Submitted Answers (Exact Words Typed by Team) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from({ length: 12 }, (_, idx) => {
                    const word = selectedTeamSubmission?.answers[idx]?.trim() ?? '';
                    return (
                      <div
                        key={idx}
                        className="flex items-center px-4 py-3 rounded-2xl bg-[#F5F5F0]/80 border border-[#03182B]/10"
                      >
                        <span className="font-mono-tabular text-xs font-bold text-[#03182B]/50 w-7 shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="font-display text-base font-extrabold text-[#03182B]">
                          {word || (
                            <span className="text-[#03182B]/35 font-normal italic">
                              [empty]
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
