import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/Dashboard.js';
import { DashboardLayout } from './layouts/DashboardLayout.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected dashboard pages wrapped with layout */}
          <Route
            path="/dashboard"
            element={
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            }
          />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Fallback wildcard redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
