import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext.jsx";

export default function ChangePassword() {
  const { admin, refreshAdmin } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("New passwords do not match");
      return;
    }
    try {
      await api.put("/auth/change-password", { currentPassword, newPassword });
      refreshAdmin({ mustChangePassword: false });
      setSuccess(true);
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Could not update password");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Change Password</h1>
      {admin?.mustChangePassword && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          You're using a default password. Please set a new one before continuing (NFR-A-01).
        </p>
      )}
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        {success && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Password updated. Redirecting…</div>}
        <div>
          <label className="label">Current Password</label>
          <input type="password" required className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">New Password</label>
          <input type="password" required minLength={8} className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <input type="password" required minLength={8} className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary w-full">Update Password</button>
      </form>
    </div>
  );
}
