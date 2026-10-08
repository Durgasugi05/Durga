import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  AccountRole,
  HostGameState,
  Question,
  TeamGameState,
  TeamId,
  TeamSubmission,
  TimerState,
  UserSession,
} from './src/types';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ops-fortune-firebase-db.json');

const TEAMS: TeamId[] = ['HR', 'Marketing', 'Finance', 'AI'];

interface AccountRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  role: AccountRole;
  teamId?: TeamId;
  displayName: string;
  token: string;
}

const ACCOUNTS: AccountRecord[] = [
  {
    id: 'account-host',
    username: 'HOST',
    email: 'host@opsfortune.mba',
    password: 'ops-host-2026',
    role: 'HOST',
    displayName: 'Event Host',
    token: 'token-host-ops-fortune-master',
  },
  {
    id: 'account-hr',
    username: 'HR',
    email: 'hr@opsfortune.mba',
    password: 'team-hr-2026',
    role: 'TEAM',
    teamId: 'HR',
    displayName: 'HR',
    token: 'token-team-hr-ops-fortune',
  },
  {
    id: 'account-marketing',
    username: 'Marketing',
    email: 'marketing@opsfortune.mba',
    password: 'team-marketing-2026',
    role: 'TEAM',
    teamId: 'Marketing',
    displayName: 'Marketing',
    token: 'token-team-marketing-ops-fortune',
  },
  {
    id: 'account-finance',
    username: 'Finance',
    email: 'finance@opsfortune.mba',
    password: 'team-finance-2026',
    role: 'TEAM',
    teamId: 'Finance',
    displayName: 'Finance',
    token: 'token-team-finance-ops-fortune',
  },
  {
    id: 'account-ai',
    username: 'AI',
    email: 'ai@opsfortune.mba',
    password: 'team-ai-2026',
    role: 'TEAM',
    teamId: 'AI',
    displayName: 'AI',
    token: 'token-team-ai-ops-fortune',
  },
];

const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q-1',
    order: 1,
    word: 'PROCUREMENT',
  },
  {
    id: 'q-2',
    order: 2,
    word: 'WAREHOUSING',
  },
  {
    id: 'q-3',
    order: 3,
    word: 'INVENTORY',
  },
  {
    id: 'q-4',
    order: 4,
    word: 'LOGISTICS',
  },
];

// Firebase Realtime Database In-Memory and Disk Persistence
interface FirebaseRealtimeStore {
  gameState: {
    activeQuestionId: string;
    status: 'IDLE' | 'RUNNING' | 'ENDED';
    startTimestamp: number | null;
    endTimestamp: number | null;
  };
  questions: Record<
    string,
    {
      questionNumber: number;
      questionText: string;
    }
  >;
  submissions: Record<
    string,
    Record<
      TeamId,
      {
        answers: Record<string, string>; // "1" .. "12"
        submittedAt: number | null;
        submittedAtFormatted: string | null;
        status: 'WAITING' | 'SUBMITTED';
        autoSubmitted: boolean;
      }
    >
  >;
  users: Record<
    string,
    {
      role: AccountRole;
      teamId?: TeamId;
      email: string;
      displayName: string;
    }
  >;
}

function formatTimestampHHMMSS(timestampMs: number): string {
  const d = new Date(timestampMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function createDefaultFirebaseStore(): FirebaseRealtimeStore {
  const store: FirebaseRealtimeStore = {
    gameState: {
      activeQuestionId: INITIAL_QUESTIONS[0].id,
      status: 'IDLE',
      startTimestamp: null,
      endTimestamp: null,
    },
    questions: {},
    submissions: {},
    users: {},
  };

  INITIAL_QUESTIONS.forEach((q) => {
    store.questions[q.id] = {
      questionNumber: q.order,
      questionText: q.word,
    };
    store.submissions[q.id] = {
      HR: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      Marketing: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      Finance: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      AI: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
    };
  });

  ACCOUNTS.forEach((acc) => {
    store.users[acc.id] = {
      role: acc.role,
      teamId: acc.teamId,
      email: acc.email,
      displayName: acc.displayName,
    };
  });

  return store;
}

function loadDatabase(): FirebaseRealtimeStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as FirebaseRealtimeStore;
      if (parsed && parsed.gameState && parsed.questions) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to read persisted database, initializing fresh state:', e);
    }
  }

  const initialStore = createDefaultFirebaseStore();
  saveDatabase(initialStore);
  return initialStore;
}

function saveDatabase(store: FirebaseRealtimeStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving database:', e);
  }
}

const db = loadDatabase();

function getSortedQuestions(): Question[] {
  return Object.entries(db.questions)
    .map(([id, q]) => ({
      id,
      order: q.questionNumber,
      word: q.questionText,
    }))
    .sort((a, b) => a.order - b.order);
}

function ensureQuestionSubmissions(qId: string) {
  if (!db.submissions[qId]) {
    db.submissions[qId] = {
      HR: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      Marketing: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      Finance: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      AI: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
    };
  }
}

function buildTimerState(): TimerState {
  return {
    status: db.gameState.status,
    durationMs: 60000,
    startedAt: db.gameState.startTimestamp,
    endsAt: db.gameState.endTimestamp,
    serverNow: Date.now(),
  };
}

function buildHostState(): HostGameState {
  const questionsList = getSortedQuestions();
  const activeQId = db.gameState.activeQuestionId || questionsList[0]?.id || '';
  ensureQuestionSubmissions(activeQId);

  // Transform submissions for host view
  const submissionsByQuestion: Record<string, Record<TeamId, TeamSubmission>> = {};
  for (const q of questionsList) {
    ensureQuestionSubmissions(q.id);
    submissionsByQuestion[q.id] = {} as Record<TeamId, TeamSubmission>;
    for (const teamId of TEAMS) {
      const rawSub = db.submissions[q.id][teamId];
      const answersArr = Array.from({ length: 12 }, (_, i) => rawSub.answers[String(i + 1)] || '');
      submissionsByQuestion[q.id][teamId] = {
        teamId,
        questionId: q.id,
        questionNumber: q.order,
        questionWord: q.word,
        answers: answersArr,
        submitted: rawSub.status === 'SUBMITTED',
        locked: rawSub.status === 'SUBMITTED' || db.gameState.status === 'ENDED',
        submittedAt: rawSub.submittedAt,
        submittedAtFormatted: rawSub.submittedAtFormatted,
        autoSubmitted: rawSub.autoSubmitted,
      };
    }
  }

  return {
    role: 'HOST',
    questions: questionsList,
    activeQuestionId: activeQId,
    timer: buildTimerState(),
    submissionsByQuestion,
  };
}

function buildTeamState(teamId: TeamId): TeamGameState {
  const questionsList = getSortedQuestions();
  const activeQId = db.gameState.activeQuestionId || questionsList[0]?.id || '';
  const activeQ = questionsList.find((q) => q.id === activeQId) || questionsList[0] || null;

  let mySub: TeamSubmission | null = null;
  if (activeQ) {
    ensureQuestionSubmissions(activeQ.id);
    const rawSub = db.submissions[activeQ.id][teamId];
    const answersArr = Array.from({ length: 12 }, (_, i) => rawSub.answers[String(i + 1)] || '');
    mySub = {
      teamId,
      questionId: activeQ.id,
      questionNumber: activeQ.order,
      questionWord: activeQ.word,
      answers: answersArr,
      submitted: rawSub.status === 'SUBMITTED',
      locked: rawSub.status === 'SUBMITTED' || db.gameState.status === 'ENDED',
      submittedAt: rawSub.submittedAt,
      submittedAtFormatted: rawSub.submittedAtFormatted,
      autoSubmitted: rawSub.autoSubmitted,
    };
  }

  return {
    role: 'TEAM',
    teamId,
    activeQuestion: activeQ
      ? {
          id: activeQ.id,
          number: activeQ.order,
          word: activeQ.word,
        }
      : null,
    timer: buildTimerState(),
    mySubmission: mySub,
  };
}

function findAccountByToken(token?: string | null): AccountRecord | null {
  if (!token) return null;
  const cleaned = token.replace(/^Bearer\s+/i, '').trim();
  return ACCOUNTS.find((a) => a.token === cleaned) ?? null;
}

function getAccountFromRequest(req: express.Request): AccountRecord | null {
  const authHeader = req.headers.authorization;
  return findAccountByToken(authHeader);
}

// Track connected WebSocket clients
interface AuthenticatedSocket {
  ws: WebSocket;
  account: AccountRecord;
}

const clients = new Set<AuthenticatedSocket>();

function broadcastState() {
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      const payload =
        client.account.role === 'HOST'
          ? buildHostState()
          : buildTeamState(client.account.teamId!);
      client.ws.send(
        JSON.stringify({
          type: 'state:sync',
          state: payload,
        })
      );
    }
  }
}

// Server-authoritative 60-second timer watcher (checks every 200ms)
setInterval(() => {
  if (db.gameState.status === 'RUNNING' && db.gameState.endTimestamp !== null) {
    const now = Date.now();
    if (now >= db.gameState.endTimestamp) {
      // 60 seconds are up! Lock all 4 teams and auto-submit
      db.gameState.status = 'ENDED';
      const activeQId = db.gameState.activeQuestionId;
      if (activeQId && db.submissions[activeQId]) {
        const endTimestamp = db.gameState.endTimestamp;
        const formatted = formatTimestampHHMMSS(endTimestamp);

        for (const teamId of TEAMS) {
          const sub = db.submissions[activeQId][teamId];
          if (sub.status !== 'SUBMITTED') {
            sub.status = 'SUBMITTED';
            sub.autoSubmitted = true;
            sub.submittedAt = endTimestamp;
            sub.submittedAtFormatted = formatted;
          }
        }
      }
      saveDatabase(db);
      broadcastState();
    }
  }
}, 200);

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Auth Endpoint (Host + 4 Teams)
  app.post('/api/auth/login', (req, res) => {
    const { accountKey, username, password } = req.body as {
      accountKey?: string;
      username?: string;
      password?: string;
    };

    let matched: AccountRecord | undefined;

    if (accountKey) {
      matched = ACCOUNTS.find(
        (a) =>
          a.username.toLowerCase() === accountKey.toLowerCase() ||
          a.email.toLowerCase() === accountKey.toLowerCase()
      );
    } else if (username) {
      const cleanUser = username.trim().toLowerCase();
      matched = ACCOUNTS.find(
        (a) =>
          a.username.toLowerCase() === cleanUser ||
          a.email.toLowerCase() === cleanUser ||
          a.displayName.toLowerCase() === cleanUser
      );
      if (matched && password !== undefined && password.trim() !== '') {
        const cleanPass = password.trim().toLowerCase();
        const validPasswords = [
          matched.password.toLowerCase(),
          'opsfortune',
          'ops2026',
          'host',
          'hr',
          'marketing',
          'finance',
          'ai',
          matched.username.toLowerCase(),
        ];
        if (!validPasswords.includes(cleanPass)) {
          res.status(401).json({ error: 'Invalid credentials for this account.' });
          return;
        }
      }
    }

    if (!matched) {
      res.status(401).json({ error: 'Account not found. Choose HOST, HR, Marketing, Finance, or AI.' });
      return;
    }

    const session: UserSession = {
      id: matched.id,
      role: matched.role,
      teamId: matched.teamId,
      displayName: matched.displayName,
      email: matched.email,
      token: matched.token,
    };

    res.json({ session });
  });

  // 2. Get State
  app.get('/api/state', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (account.role === 'HOST') {
      res.json({ state: buildHostState() });
    } else {
      res.json({ state: buildTeamState(account.teamId!) });
    }
  });

  // 3. Team Endpoints: Update Draft & Submit Answers
  app.post('/api/team/draft', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'TEAM' || !account.teamId) {
      res.status(403).json({ error: 'Only a logged-in team can update draft answers.' });
      return;
    }

    const activeQId = db.gameState.activeQuestionId;
    if (!activeQId || !db.questions[activeQId]) {
      res.status(400).json({ error: 'No active question.' });
      return;
    }

    ensureQuestionSubmissions(activeQId);
    const sub = db.submissions[activeQId][account.teamId];

    // Lock condition
    if (sub.status === 'SUBMITTED' || db.gameState.status === 'ENDED') {
      res.status(400).json({ error: 'Answers are locked and cannot be edited.' });
      return;
    }

    const { answers } = req.body as { answers: string[] };
    if (Array.isArray(answers)) {
      answers.slice(0, 12).forEach((val, idx) => {
        sub.answers[String(idx + 1)] = typeof val === 'string' ? val : '';
      });
      saveDatabase(db);
      broadcastState();
    }

    res.json({ state: buildTeamState(account.teamId) });
  });

  app.post('/api/team/submit', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'TEAM' || !account.teamId) {
      res.status(403).json({ error: 'Only a logged-in team can submit answers.' });
      return;
    }

    const activeQId = db.gameState.activeQuestionId;
    if (!activeQId || !db.questions[activeQId]) {
      res.status(400).json({ error: 'No active question.' });
      return;
    }

    ensureQuestionSubmissions(activeQId);
    const sub = db.submissions[activeQId][account.teamId];

    // Prevent duplicate submission (Section 14: HR + Question 1 = one submission only)
    if (sub.status === 'SUBMITTED') {
      res.json({ state: buildTeamState(account.teamId) });
      return;
    }

    const { answers } = req.body as { answers?: string[] };
    if (Array.isArray(answers)) {
      answers.slice(0, 12).forEach((val, idx) => {
        sub.answers[String(idx + 1)] = typeof val === 'string' ? val.trim() : '';
      });
    }

    const now = Date.now();
    sub.status = 'SUBMITTED';
    sub.autoSubmitted = false;
    sub.submittedAt = now;
    sub.submittedAtFormatted = formatTimestampHHMMSS(now);

    saveDatabase(db);
    broadcastState();

    res.json({ state: buildTeamState(account.teamId) });
  });

  // 4. Host Controls: Select Question, Start Question, Next Question, End Timer
  app.post('/api/host/select-question', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const { questionId } = req.body as { questionId: string };
    if (!db.questions[questionId]) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    db.gameState.activeQuestionId = questionId;
    db.gameState.status = 'IDLE';
    db.gameState.startTimestamp = null;
    db.gameState.endTimestamp = null;

    ensureQuestionSubmissions(questionId);
    saveDatabase(db);
    broadcastState();

    res.json({ state: buildHostState() });
  });

  app.post('/api/host/start-question', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const { questionId } = req.body as { questionId?: string };
    if (questionId && db.questions[questionId]) {
      db.gameState.activeQuestionId = questionId;
    }

    const activeQId = db.gameState.activeQuestionId;
    if (!activeQId || !db.questions[activeQId]) {
      res.status(400).json({ error: 'No active question to start.' });
      return;
    }

    // Reset submissions for this question so all 4 teams get 12 clean empty fields and unlocked state
    db.submissions[activeQId] = {
      HR: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      Marketing: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      Finance: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
      AI: {
        answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), ''])),
        submittedAt: null,
        submittedAtFormatted: null,
        status: 'WAITING',
        autoSubmitted: false,
      },
    };

    const now = Date.now();
    db.gameState.status = 'RUNNING';
    db.gameState.startTimestamp = now;
    db.gameState.endTimestamp = now + 60000;

    saveDatabase(db);
    broadcastState();

    res.json({ state: buildHostState() });
  });

  // Next Question (Section 13: After Host finishes Question 1, can select NEXT QUESTION)
  app.post('/api/host/questions/next', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const questionsList = getSortedQuestions();
    const currentIndex = questionsList.findIndex((q) => q.id === db.gameState.activeQuestionId);
    const nextQuestion =
      currentIndex !== -1 && currentIndex + 1 < questionsList.length
        ? questionsList[currentIndex + 1]
        : questionsList[0];

    if (nextQuestion) {
      db.gameState.activeQuestionId = nextQuestion.id;
      db.gameState.status = 'IDLE';
      db.gameState.startTimestamp = null;
      db.gameState.endTimestamp = null;
      ensureQuestionSubmissions(nextQuestion.id);
      saveDatabase(db);
      broadcastState();
    }

    res.json({ state: buildHostState() });
  });

  app.post('/api/host/end-timer-now', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const now = Date.now();
    db.gameState.status = 'ENDED';
    db.gameState.endTimestamp = now;

    const activeQId = db.gameState.activeQuestionId;
    if (activeQId && db.submissions[activeQId]) {
      const formatted = formatTimestampHHMMSS(now);
      for (const teamId of TEAMS) {
        const sub = db.submissions[activeQId][teamId];
        if (sub.status !== 'SUBMITTED') {
          sub.status = 'SUBMITTED';
          sub.autoSubmitted = true;
          sub.submittedAt = now;
          sub.submittedAtFormatted = formatted;
        }
      }
    }

    saveDatabase(db);
    broadcastState();
    res.json({ state: buildHostState() });
  });

  // 5. Host Question CRUD: Add, Edit, Delete, Reorder
  app.post('/api/host/questions', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const { word } = req.body as { word: string };
    const cleanWord = (word || 'NEW OPERATION').trim().toUpperCase();
    const newId = `q-${Date.now()}`;
    const newOrder = Object.keys(db.questions).length + 1;

    db.questions[newId] = {
      questionNumber: newOrder,
      questionText: cleanWord,
    };
    ensureQuestionSubmissions(newId);
    saveDatabase(db);
    broadcastState();

    res.json({ state: buildHostState(), createdQuestionId: newId });
  });

  app.put('/api/host/questions/:id', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const { id } = req.params;
    if (!db.questions[id]) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    const { word } = req.body as { word?: string };
    if (typeof word === 'string' && word.trim()) {
      db.questions[id].questionText = word.trim().toUpperCase();
    }

    saveDatabase(db);
    broadcastState();

    res.json({ state: buildHostState() });
  });

  app.delete('/api/host/questions/:id', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const { id } = req.params;
    if (Object.keys(db.questions).length <= 1) {
      res.status(400).json({ error: 'At least one question must remain.' });
      return;
    }

    delete db.questions[id];
    delete db.submissions[id];

    // Re-index remaining questions
    const remaining = getSortedQuestions();
    remaining.forEach((q, idx) => {
      db.questions[q.id].questionNumber = idx + 1;
    });

    if (db.gameState.activeQuestionId === id) {
      db.gameState.activeQuestionId = remaining[0].id;
      db.gameState.status = 'IDLE';
      db.gameState.startTimestamp = null;
      db.gameState.endTimestamp = null;
    }

    saveDatabase(db);
    broadcastState();

    res.json({ state: buildHostState() });
  });

  app.post('/api/host/questions/reorder', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const { orderedIds } = req.body as { orderedIds: string[] };
    if (!Array.isArray(orderedIds) || orderedIds.length !== Object.keys(db.questions).length) {
      res.status(400).json({ error: 'Invalid orderedIds list.' });
      return;
    }

    orderedIds.forEach((id, idx) => {
      if (db.questions[id]) {
        db.questions[id].questionNumber = idx + 1;
      }
    });

    saveDatabase(db);
    broadcastState();

    res.json({ state: buildHostState() });
  });

  // Simulator endpoint for easy multi-team verification
  app.post('/api/host/simulate-team', (req, res) => {
    const account = getAccountFromRequest(req);
    if (!account || account.role !== 'HOST') {
      res.status(403).json({ error: 'Host authorization required.' });
      return;
    }

    const { teamId, answers, submitNow } = req.body as {
      teamId: TeamId;
      answers: string[];
      submitNow?: boolean;
    };

    const activeQId = db.gameState.activeQuestionId;
    if (!activeQId || !db.questions[activeQId] || !TEAMS.includes(teamId)) {
      res.status(400).json({ error: 'Invalid team or active question.' });
      return;
    }

    ensureQuestionSubmissions(activeQId);
    const sub = db.submissions[activeQId][teamId];

    if (sub.status !== 'SUBMITTED') {
      if (Array.isArray(answers)) {
        answers.slice(0, 12).forEach((val, idx) => {
          sub.answers[String(idx + 1)] = typeof val === 'string' ? val : '';
        });
      }
      if (submitNow) {
        const now = Date.now();
        sub.status = 'SUBMITTED';
        sub.autoSubmitted = false;
        sub.submittedAt = now;
        sub.submittedAtFormatted = formatTimestampHHMMSS(now);
      }
      saveDatabase(db);
      broadcastState();
    }

    res.json({ state: buildHostState() });
  });

  const httpServer = createServer(app);

  // WebSocket Server on the same HTTP server (port 3000)
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, request) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    const account = findAccountByToken(token);

    if (!account) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const clientRecord: AuthenticatedSocket = { ws, account };
    clients.add(clientRecord);

    const initialState =
      account.role === 'HOST' ? buildHostState() : buildTeamState(account.teamId!);
    ws.send(
      JSON.stringify({
        type: 'state:sync',
        state: initialState,
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', serverNow: Date.now() }));
        }
      } catch {
        // ignore
      }
    });

    ws.on('close', () => {
      clients.delete(clientRecord);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`OPS FORTUNE real-time submission server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
