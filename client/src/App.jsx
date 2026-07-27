import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import GuestRoute from './components/common/GuestRoute';
import AppLayout from './components/layout/AppLayout';
import NotFound from './components/common/NotFound';

import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import RequestsPage from './pages/dashboard/RequestsPage';
import MasterPage from './pages/masters/MasterPage';
import UsersPage from './pages/administration/UsersPage';
import RolesPage from './pages/administration/RolesPage';
import AuditLogsPage from './pages/administration/AuditLogsPage';
import CompanyProfilePage from './pages/settings/CompanyProfilePage';
import AppearancePage from './pages/settings/AppearancePage';
import SecurityPage from './pages/settings/SecurityPage';
import PurchaseOrderPage from './pages/purchase/PurchaseOrderPage';
import RejectedPurchasePage from './pages/purchase/RejectedPurchasePage';
import MdApprovalPage from './pages/purchase/MdApprovalPage';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter basename="/neobuilderspanel">
            <AuthProvider>
              <Routes>
                <Route element={<GuestRoute />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/requests" element={<RequestsPage />} />
                    <Route path="/people/:slug" element={<MasterPage />} />
                    <Route path="/masters/:slug" element={<MasterPage />} />
                    <Route path="/purchase/md-approval/:id" element={<MdApprovalPage />} />
                    <Route path="/purchase/orders" element={<PurchaseOrderPage />} />
                    <Route path="/purchase/rejected" element={<RejectedPurchasePage />} />
                    <Route path="/purchase/:slug" element={<MasterPage />} />
                    <Route path="/admin/users" element={<UsersPage />} />
                    <Route path="/admin/roles" element={<RolesPage />} />
                    <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
                    <Route path="/settings/company-profile" element={<CompanyProfilePage />} />
                    <Route path="/settings/appearance" element={<AppearancePage />} />
                    <Route path="/settings/security" element={<SecurityPage />} />
                  </Route>
                </Route>

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
