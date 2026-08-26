import { Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./pages/auth/AuthPage";
import LandingPage from "./pages/auth/LandingPage";
import CandidateLayout from "./layouts/CandidateLayout";
import InterviewerLayout from "./layouts/InterviewerLayout";
import CandidateDashboard from "./pages/candidate/CandidateDashboard";
import CandidateProfile from "./pages/candidate/CandidateProfile";
import CandidateJobs from "./pages/candidate/CandidateJobs";
import CandidateInterviews from "./pages/candidate/CandidateInterviews";
import InterviewInstructions from "./pages/candidate/InterviewInstructions";
import SystemCheck from "./pages/candidate/SystemCheck";
import CandidateLiveInterview from "./pages/candidate/CandidateLiveInterview";
import CandidateResults from "./pages/candidate/CandidateResults";
import PracticeTests from "./pages/candidate/PracticeTests";
import CandidateNotifications from "./pages/candidate/CandidateNotifications";
import CandidateResources from "./pages/candidate/CandidateResources";
import InterviewerDashboard from "./pages/interviewer/InterviewerDashboard";
import Jobs from "./pages/interviewer/Jobs";
import Candidates from "./pages/interviewer/Candidates";
import InterviewManagement from "./pages/interviewer/InterviewManagement";
import LiveMonitoring from "./pages/interviewer/LiveMonitoring";
import LiveInterviewRoom from "./pages/interviewer/LiveInterviewRoom";
import AIAnalysis from "./pages/interviewer/AIAnalysis";
import CandidateComparison from "./pages/interviewer/CandidateComparison";
import Reports from "./pages/interviewer/Reports";
import Recommendation from "./pages/interviewer/Recommendation";
import Settings from "./pages/interviewer/Settings";
import GroupDiscussion from "./pages/interviewer/GroupDiscussion";
import InterviewerNotifications from "./pages/interviewer/InterviewerNotifications";
import CandidateSettings from "./pages/candidate/CandidateSettings";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />

      <Route element={<ProtectedRoute role="candidate" />}><Route path="/candidate" element={<CandidateLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CandidateDashboard />} />
        <Route path="profile" element={<CandidateProfile />} />
        <Route path="jobs" element={<CandidateJobs />} />
        <Route path="interviews" element={<CandidateInterviews />} />
        <Route path="instructions" element={<InterviewInstructions />} />
        <Route path="system-check" element={<SystemCheck />} />
        <Route path="live" element={<CandidateLiveInterview />} />
        <Route path="results" element={<CandidateResults />} />
        <Route path="practice" element={<PracticeTests />} />
        <Route path="notifications" element={<CandidateNotifications />} />
        <Route path="resources" element={<CandidateResources />} />
        <Route path="settings" element={<CandidateSettings />} />
      </Route></Route>

      <Route element={<ProtectedRoute role="interviewer" />}><Route path="/interviewer" element={<InterviewerLayout />}>
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
      </Route><Route path="/interviewer/live-room" element={<LiveInterviewRoom />} /></Route>

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}
