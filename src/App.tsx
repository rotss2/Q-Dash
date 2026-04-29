import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToasterProvider } from './components/Toaster';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import SurveyBuilder from './pages/admin/SurveyBuilder';
import SurveyAnalytics from './pages/admin/SurveyAnalytics';
import UserDashboard from './pages/user/Dashboard';
import SurveyResponse from './pages/user/SurveyResponse';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <ToasterProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/survey/:surveyId" element={<SurveyResponse />} />
            
            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRole="admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/surveys/new" element={<SurveyBuilder />} />
              <Route path="/admin/surveys/:surveyId/edit" element={<SurveyBuilder />} />
              <Route path="/admin/surveys/:surveyId/analytics" element={<SurveyAnalytics />} />
            </Route>
            
            {/* User Routes */}
            <Route element={<ProtectedRoute allowedRole="user" />}>
              <Route path="/user" element={<UserDashboard />} />
            </Route>
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </ToasterProvider>
    </AuthProvider>
  );
}

export default App;
