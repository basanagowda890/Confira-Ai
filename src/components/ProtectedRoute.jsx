import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ role }) {
  const { loading, user, profile } = useAuth();
  if (loading) return <div className="auth-page"><p className="form-notice">Loading your workspace…</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.role && profile.role !== role) return <Navigate to={`/${profile.role}/dashboard`} replace />;
  return <Outlet />;
}
