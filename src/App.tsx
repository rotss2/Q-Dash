import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToasterProvider } from './components/Toaster';
import ErrorBoundary from './components/ErrorBoundary';
import AdminDashboard from './pages/admin/Dashboard';
import AdminCommandCenter from './pages/admin/CommandCenter';
import SurveyBuilder from './pages/admin/SurveyBuilder';
import SurveyAnalytics from './pages/admin/SurveyAnalytics';
import AllSurveys from './pages/admin/AllSurveys';
import AllResponses from './pages/admin/AllResponses';
import QuestionBank from './pages/admin/QuestionBank';
import SurveyResponse from './pages/user/SurveyResponse';
import StudentDashboard from './pages/user/Dashboard';
import SurveyDashboard from './pages/student/SurveyDashboard';
import QuizDashboard from './pages/student/QuizDashboard';
import ExamDashboard from './pages/student/ExamDashboard';
import ReviewMode from './pages/student/ReviewMode';
import StudentProfilePage from './pages/student/StudentProfilePage';
import LiveRoomCreate from './pages/live/LiveRoomCreate';
import JoinLiveRoom from './pages/live/JoinLiveRoom';
import LiveRoomHost from './pages/live/LiveRoomHost';
import LiveRoomStudent from './pages/live/LiveRoomStudent';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';
import Login from './pages/Login';
import Forbidden from './pages/Forbidden';
import RequireAdmin from './components/RequireAdmin';

function App() {
  return (
    <AuthProvider>
      <ToasterProvider>
        <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Survey Response (Public) */}
            <Route path="/survey/:surveyId" element={<SurveyResponse />} />

            {/* Student Dashboard Routes */}
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/surveys" element={<SurveyDashboard />} />
            <Route path="/student/quizzes" element={<QuizDashboard />} />
            <Route path="/student/exams" element={<ExamDashboard />} />
            <Route path="/review/:surveyId" element={<ReviewMode />} />
            <Route path="/profile" element={<StudentProfilePage />} />

            {/* Live Quiz Battle Routes */}
            <Route
              path="/live/create"
              element={
                <RequireAdmin>
                  <LiveRoomCreate />
                </RequireAdmin>
              }
            />
            <Route path="/live/join" element={<JoinLiveRoom />} />
            <Route
              path="/live/host/:roomId"
              element={
                <RequireAdmin>
                  <LiveRoomHost />
                </RequireAdmin>
              }
            />
            <Route path="/live/room/:roomCode" element={<LiveRoomStudent />} />
            <Route
              path="/admin/analytics"
              element={
                <RequireAdmin>
                  <AnalyticsDashboard />
                </RequireAdmin>
              }
            />

            {/* Admin Routes (Protected) */}
            {/* New Command Center - Modern Admin Dashboard */}
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminCommandCenter />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/command-center"
              element={
                <RequireAdmin>
                  <AdminCommandCenter />
                </RequireAdmin>
              }
            />
            {/* Legacy Dashboard - for backward compatibility */}
            <Route
              path="/admin/legacy"
              element={
                <RequireAdmin>
                  <AdminDashboard />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/surveys/new"
              element={
                <RequireAdmin>
                  <SurveyBuilder />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/surveys/:surveyId/edit"
              element={
                <RequireAdmin>
                  <SurveyBuilder />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/surveys/:surveyId/analytics"
              element={
                <RequireAdmin>
                  <SurveyAnalytics />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/surveys/all"
              element={
                <RequireAdmin>
                  <AllSurveys />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/responses/all"
              element={
                <RequireAdmin>
                  <AllResponses />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/question-bank"
              element={
                <RequireAdmin>
                  <QuestionBank />
                </RequireAdmin>
              }
            />

            <Route path="/login" element={<Login />} />
            <Route path="/forbidden" element={<Forbidden />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
        </ErrorBoundary>
      </ToasterProvider>
    </AuthProvider>
  );
}

export default App;
