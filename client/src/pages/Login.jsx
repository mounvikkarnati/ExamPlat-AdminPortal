import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const admin = await login(email, password);
      if (admin.mustChangePassword) {
        navigate("/change-password");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.1fr_.9fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" /><div className="absolute -bottom-16 right-0 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-sm font-black text-brand-600">EP</div><div className="text-lg font-bold">ExamPlat <span className="font-normal text-slate-400">Admin</span></div></div>
        <div className="relative my-auto max-w-lg"><p className="text-xs font-bold uppercase tracking-[.2em] text-brand-300">Assessment command center</p><h1 className="mt-5 text-5xl font-bold leading-[1.08] tracking-tight">Run every examination with confidence.</h1><p className="mt-6 max-w-md text-base leading-7 text-slate-300">A secure workspace for building assessments, managing candidate access, and monitoring live exam operations.</p><div className="mt-10 grid grid-cols-3 gap-3"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xl font-bold">Secure</p><p className="mt-1 text-xs text-slate-400">Role-based access</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xl font-bold">Live</p><p className="mt-1 text-xs text-slate-400">Status visibility</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xl font-bold">Ready</p><p className="mt-1 text-xs text-slate-400">Validation first</p></div></div></div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} ExamPlat. Administrative access only.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10"><div className="w-full max-w-md"><div className="mb-9 lg:hidden"><div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500 text-sm font-black text-white">EP</div><h1 className="mt-5 text-2xl font-bold text-slate-950">ExamPlat Admin</h1></div><div><p className="page-kicker">Welcome back</p><h2 className="text-3xl font-bold tracking-tight text-slate-950">Sign in to continue</h2><p className="mt-2 text-sm text-slate-500">Use your administrator credentials to access the control center.</p></div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@examplat.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-8 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-400">Role permissions are determined by your account after sign-in. Contact your Super Administrator if you need access.</p>
      </div>
      </section>
    </div>
  );
}
