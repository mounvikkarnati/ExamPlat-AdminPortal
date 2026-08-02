import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children, superAdminOnly = false, adminOnly = false, allowPasswordChange = false }) {
  const { admin, isAuthenticated, isSuperAdmin } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (admin?.mustChangePassword && !allowPasswordChange) return <Navigate to="/change-password" replace />;
  if (superAdminOnly && !isSuperAdmin) return <Navigate to="/" replace />;
  if (adminOnly && admin?.role !== "admin") return <Navigate to="/" replace />;

  return children;
}
