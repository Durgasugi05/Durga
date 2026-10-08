export type TeamId = 'HR' | 'Marketing' | 'Finance' | 'AI';

export type AccountRole = 'HOST' | 'TEAM';

export interface UserSession {
  id: string;
  role: AccountRole;
  teamId?: TeamId;
  displayName: string;
  email: string;
  token: string;
}

export interface UserProfile {
  uid: string;
  role: AccountRole;
  teamId?: TeamId;
  email: string;
  displayName: string;
}

// Stored in Firebase Realtime Database at /questions/{questionId}
export interface FirebaseQuestion {
  questionNumber: number;
  questionText: string;
}

// Client Question representation
export interface Question {
  id: string;
  order: number;
  word: string;
}

// Stored in Firebase Realtime Database at /submissions/{questionId}/{teamId}
export interface FirebaseSubmission {
  answers: Record<string, string>; // "1" .. "12"
  submittedAt: number | null;
  submittedAtFormatted?: string | null;
  status: 'WAITING' | 'SUBMITTED';
}

// Client TeamSubmission representation
export interface TeamSubmission {
  teamId: TeamId;
  questionId: string;
  questionNumber: number;
  questionWord: string;
  answers: string[]; // Exactly 12 strings
  submitted: boolean;
  locked: boolean;
  submittedAt: number | null;
  submittedAtFormatted: string | null;
  autoSubmitted: boolean;
}

export type TimerStatus = 'IDLE' | 'RUNNING' | 'ENDED';

// Stored in Firebase Realtime Database at /gameState
export interface FirebaseGameState {
  activeQuestionId: string;
  status: TimerStatus;
  startTimestamp: number | null;
  endTimestamp: number | null;
}

export interface TimerState {
  status: TimerStatus;
  durationMs: number; // 60000 (60 seconds)
  startedAt: number | null;
  endsAt: number | null;
  serverNow: number;
}

export interface HostGameState {
  role: 'HOST';
  questions: Question[];
  activeQuestionId: string;
  timer: TimerState;
  submissionsByQuestion: Record<string, Record<TeamId, TeamSubmission>>;
}

export interface TeamGameState {
  role: 'TEAM';
  teamId: TeamId;
  activeQuestion: {
    id: string;
    number: number;
    word: string;
  } | null;
  timer: TimerState;
  mySubmission: {
    teamId: TeamId;
    questionId: string;
    questionNumber: number;
    questionWord: string;
    answers: string[];
    submitted: boolean;
    locked: boolean;
    submittedAt: number | null;
    submittedAtFormatted: string | null;
    autoSubmitted: boolean;
  } | null;
}

export interface FirebaseConfigOptions {
  apiKey?: string;
  authDomain?: string;
  databaseURL?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}
