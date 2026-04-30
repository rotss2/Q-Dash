import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToasterProvider } from './components/Toaster';
import AdminDashboard from './pages/admin/Dashboard';
import SurveyBuilder from './pages/admin/SurveyBuilder';
import SurveyAnalytics from './pages/admin/SurveyAnalytics';
import SurveyResponse from './pages/user/SurveyResponse';

function App() {
  return (
    <AuthProvider>
      <ToasterProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Survey Response (Public) */}
            <Route path="/survey/:surveyId" element={<SurveyResponse />} />
            
            {/* Admin Routes (Auto-logged in) */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/surveys/new" element={<SurveyBuilder />} />
            <Route path="/admin/surveys/:surveyId/edit" element={<SurveyBuilder />} />
            <Route path="/admin/surveys/:surveyId/analytics" element={<SurveyAnalytics />} />
            
            {/* Default redirect to admin */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/login" element={<Navigate to="/admin" replace />} />
            <Route path="/register" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </ToasterProvider>
    </AuthProvider>
  );
}

export default App;
