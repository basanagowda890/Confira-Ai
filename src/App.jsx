import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import CandidateLayout from "./layouts/CandidateLayout";
import InterviewerLayout from "./layouts/InterviewerLayout";

// Landing & Auth (Lazy loaded for optimal initial bundle)
const LandingPage = lazy(() => import("./pages/auth/LandingPage"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage"));

// Candidate Pages (Lazy loaded on demand)
const CandidateDashboard = lazy(() => import("./pages/candidate/CandidateDashboard"));
const CandidateProfile = lazy(() => import("./pages/candidate/CandidateProfile"));
const CandidateJobs = lazy(() => import("./pages/candidate/CandidateJobs"));
const CandidateInterviews = lazy(() => import("./pages/candidate/CandidateInterviews"));
const CandidateGroupDiscussion = lazy(() => import("./pages/candidate/CandidateGroupDiscussion"));
const InterviewInstructions = lazy(() => import("./pages/candidate/InterviewInstructions"));
const SystemCheck = lazy(() => import("./pages/candidate/SystemCheck"));
const CandidateLiveInterview = lazy(() => import("./pages/candidate/CandidateLiveInterview"));
const CandidateResults = lazy(() => import("./pages/candidate/CandidateResults"));
const PracticeTests = lazy(() => import("./pages/candidate/PracticeTests"));
const CandidateNotifications = lazy(() => import("./pages/candidate/CandidateNotifications"));
const CandidateResources = lazy(() => import("./pages/candidate/CandidateResources"));
const CandidateSettings = lazy(() => import("./pages/candidate/CandidateSettings"));

// Interviewer Pages (Lazy loaded on demand)
const InterviewerDashboard = lazy(() => import("./pages/interviewer/InterviewerDashboard"));
const Jobs = lazy(() => import("./pages/interviewer/Jobs"));
const Candidates = lazy(() => import("./pages/interviewer/Candidates"));
const InterviewManagement = lazy(() => import("./pages/interviewer/InterviewManagement"));
const LiveMonitoring = lazy(() => import("./pages/interviewer/LiveMonitoring"));
const AIAnalysis = lazy(() => import("./pages/interviewer/AIAnalysis"));
const CandidateComparison = lazy(() => import("./pages/interviewer/CandidateComparison"));
const Reports = lazy(() => import("./pages/interviewer/Reports"));
const Recommendation = lazy(() => import("./pages/interviewer/Recommendation"));
const GroupDiscussion = lazy(() => import("./pages/interviewer/GroupDiscussion"));
const InterviewerNotifications = lazy(() => import("./pages/interviewer/InterviewerNotifications"));
const Settings = lazy(() => import("./pages/interviewer/Settings"));

// Lightweight Suspense fallback
function PageFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "12px",
        color: "var(--maroon)"
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          border: "3px solid var(--line, #D9AA90)",
          borderTopColor: "var(--maroon, #A65E46)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }}
      />
      <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--muted, #536176)" }}>
        Loading workspace...
      </span>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* Candidate Protected Routes */}
        <Route element={<ProtectedRoute role="candidate" />}>
          <Route path="/candidate" element={<CandidateLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CandidateDashboard />} />
            <Route path="profile" element={<CandidateProfile />} />
            <Route path="jobs" element={<CandidateJobs />} />
            <Route path="interviews" element={<CandidateInterviews />} />
            <Route path="group-discussion" element={<CandidateGroupDiscussion />} />
            <Route path="instructions" element={<InterviewInstructions />} />
            <Route path="system-check" element={<SystemCheck />} />
            <Route path="live" element={<CandidateLiveInterview />} />
            <Route path="results" element={<CandidateResults />} />
            <Route path="practice" element={<PracticeTests />} />
            <Route path="notifications" element={<CandidateNotifications />} />
            <Route path="resources" element={<CandidateResources />} />
            <Route path="settings" element={<CandidateSettings />} />
          </Route>
        </Route>

        {/* Interviewer Protected Routes */}
        <Route element={<ProtectedRoute role="interviewer" />}>
          <Route path="/interviewer" element={<InterviewerLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<InterviewerDashboard />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="candidates" element={<Candidates />} />
            <Route path="interviews" element={<InterviewManagement />} />
            <Route path="live" element={<LiveMonitoring />} />
            <Route path="analysis" element={<AIAnalysis />} />
            <Route path="comparison" element={<CandidateComparison />} />
            <Route path="reports" element={<Reports />} />
            <Route path="recommendation" element={<Recommendation />} />
            <Route path="group-discussion" element={<GroupDiscussion />} />
            <Route path="notifications" element={<InterviewerNotifications />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="/interviewer/live-room" element={<LiveMonitoring />} />
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
