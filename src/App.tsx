import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToasterProvider } from './components/Toaster';
import AdminDashboard from './pages/admin/Dashboard';
import SurveyBuilder from './pages/admin/SurveyBuilder';
import SurveyAnalytics from './pages/admin/SurveyAnalytics';
import AllSurveys from './pages/admin/AllSurveys';
import AllResponses from './pages/admin/AllResponses';
import SurveyResponse from './pages/user/SurveyResponse';
import Login from './pages/Login';
import Forbidden from './pages/Forbidden';
import RequireAdmin from './components/RequireAdmin';

function App() {
  return (
    <AuthProvider>
      <ToasterProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Survey Response (Public) */}
            <Route path="/survey/:surveyId" element={<SurveyResponse />} />

            {/* Admin Routes (Protected) */}
            <Route
              path="/admin"
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

            <Route path="/login" element={<Login />} />
            <Route path="/forbidden" element={<Forbidden />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </ToasterProvider>
    </AuthProvider>
  );
}

export default App;
