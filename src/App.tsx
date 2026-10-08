import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { UserSession } from './types';
import { useRealtimeGame } from './hooks/useRealtimeGame';
import { LoginScreen } from './components/LoginScreen';
import { HostView } from './components/HostView';
import { ParticipantView } from './components/ParticipantView';

const SESSION_STORAGE_KEY = 'ops_fortune_auth_session_v2';

function AccessDeniedScreen({
  onRedirectToLogin,
  onReturnToTeam,
}: {
  onRedirectToLogin: () => void;
  onReturnToTeam: () => void;
}) {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onRedirectToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onRedirectToLogin]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-6 text-[#03182B]">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-[#D7263D]/30 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-[#D7263D]/10 text-[#D7263D] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-9 h-9" />
        </div>
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-extrabold text-[#D7263D] tracking-tight">
            ACCESS DENIED
          </h1>
          <p className="text-sm text-[#03182B]/85 font-medium leading-relaxed">
            You are not authorized to access this page.
          </p>
        </div>
        <p className="text-xs text-[#03182B]/60 font-mono-tabular">
          Redirecting to login page in {countdown}s...
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRedirectToLogin}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#D7263D] text-white text-xs font-bold hover:bg-[#FF5A0A] transition-colors cursor-pointer"
          >
            Redirect Now
          </button>
          <button
            type="button"
            onClick={onReturnToTeam}
            className="w-full sm:w-auto px-5 py-3 rounded-full border border-[#03182B]/20 text-xs font-bold text-[#03182B] hover:bg-black/5 transition-colors cursor-pointer"
          >
            Return to Team
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');

  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as UserSession;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Track browser back/forward and URL navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  }, []);

  const handleLoginSuccess = useCallback((newSession: UserSession) => {
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch {
      // ignore
    }
    setSession(newSession);

    // Redirect according to role (Section 7)
    if (newSession.role === 'HOST') {
      window.history.replaceState({}, '', '/host');
      setCurrentPath('/host');
    } else {
      window.history.replaceState({}, '', '/team');
      setCurrentPath('/team');
    }
  }, []);

  const handleLogout = useCallback(() => {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSession(null);
    window.history.replaceState({}, '', '/login');
    setCurrentPath('/login');
  }, []);

  const { hostState, teamState, apiCall } = useRealtimeGame(session);

  const handleUpdateDraft = useCallback(
    async (answers: string[]) => {
      await apiCall('/api/team/draft', 'POST', { answers });
    },
    [apiCall]
  );

  const handleSubmitAnswers = useCallback(
    async (answers: string[]) => {
      await apiCall('/api/team/submit', 'POST', { answers });
    },
    [apiCall]
  );

  // 1. Unauthenticated Route Protection
  if (!session) {
    if (currentPath === '/host' || currentPath === '/team') {
      window.history.replaceState({}, '', '/login');
    }
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. Authenticated Route Protection for TEAM attempting to access /host
  if (session.role === 'TEAM' && currentPath === '/host') {
    return <AccessDeniedScreen onRedirectToLogin={handleLogout} onReturnToTeam={() => navigate('/team')} />;
  }

  // 3. HOST User View (At /host or fallback)
  if (session.role === 'HOST') {
    if (currentPath !== '/host') {
      window.history.replaceState({}, '', '/host');
    }
    return (
      <HostView
        session={session}
        hostState={hostState}
        apiCall={apiCall}
        onLogout={handleLogout}
      />
    );
  }

  // 4. TEAM User View (At /team)
  if (currentPath !== '/team') {
    window.history.replaceState({}, '', '/team');
  }

  return (
    <ParticipantView
      session={session}
      teamState={teamState}
      onUpdateDraft={handleUpdateDraft}
      onSubmitAnswers={handleSubmitAnswers}
      onLogout={handleLogout}
    />
  );
}
