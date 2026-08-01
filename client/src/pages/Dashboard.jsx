import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext.jsx";
import { Icon } from "../components/Navbar.jsx";

export function StatusBadge({ status }) {
  const map = { Scheduled: "bg-blue-50 text-blue-700", Live: "bg-emerald-50 text-emerald-700", Completed: "bg-slate-100 text-slate-600" };
  return <span className={`badge ${map[status] || "bg-slate-100 text-slate-600"}`}><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />{status}</span>;
}

function Metric({ label, value, hint, tone }) {
  return <div className="card p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{value}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon name="exam" className="h-5 w-5" /></div></div><p className="mt-3 text-xs text-slate-400">{hint}</p></div>;
}

export default function Dashboard() {
  const { admin } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("all");
  useEffect(() => { api.get("/tests").then(({ data }) => setTests(data)).catch((err) => setError(err.response?.data?.message || "Unable to load dashboard data.")).finally(() => setLoading(false)); }, []);
  const counts = useMemo(() => ({ Scheduled: tests.filter((t) => t.status === "Scheduled").length, Live: tests.filter((t) => t.status === "Live").length, Completed: tests.filter((t) => t.status === "Completed").length }), [tests]);
  const visible = view === "all" ? tests : tests.filter((test) => test.status === view);
  return <div className="mx-auto max-w-7xl space-y-8">
    <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="page-kicker">Exam operations</p><h1 className="page-title">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {admin?.name || "there"}.</h1><p className="page-subtitle">Monitor schedules, candidates, and assessment readiness from one place.</p></div>
      <Link to="/tests/new" className="btn-primary gap-2"><Icon name="plus" className="h-4 w-4" />Create examination</Link>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="All examinations" value={loading ? "—" : tests.length} hint="Across every assessment" tone="bg-violet-50 text-violet-600" />
      <Metric label="Scheduled" value={loading ? "—" : counts.Scheduled} hint="Ready for upcoming sessions" tone="bg-blue-50 text-blue-600" />
      <Metric label="Live now" value={loading ? "—" : counts.Live} hint="Currently accepting attempts" tone="bg-emerald-50 text-emerald-600" />
      <Metric label="Completed" value={loading ? "—" : counts.Completed} hint="Available for review" tone="bg-slate-100 text-slate-600" />
    </section>
    <section className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="card overflow-hidden"><div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Assessment activity</h2><p className="mt-1 text-sm text-slate-500">Your latest examinations and their current availability.</p></div><div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">{[["all", "All"], ["Live", "Live"], ["Scheduled", "Upcoming"]].map(([key, label]) => <button key={key} onClick={() => setView(key)} className={`rounded-md px-3 py-1.5 transition ${view === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{label}</button>)}</div></div>
        {error ? <p className="p-6 text-sm text-red-700">{error}</p> : loading ? <p className="p-6 text-sm text-slate-500">Loading examinations…</p> : visible.length === 0 ? <div className="p-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400"><Icon name="exam" className="h-6 w-6" /></div><p className="mt-4 font-semibold text-slate-800">Nothing to show here</p><p className="mt-1 text-sm text-slate-500">Create an examination to begin managing your assessment cycle.</p></div> : <div className="divide-y divide-slate-100">{visible.slice(0, 6).map((t) => <Link key={t._id} to={`/tests/${t._id}`} className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">{t.title.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{t.title}</p><p className="mt-0.5 text-xs text-slate-500">{t.testId} · {t.candidateCount} candidates · {new Date(t.defaultStartAt).toLocaleDateString()}</p></div><StatusBadge status={t.status} /><span className="text-slate-300">›</span></Link>)}</div>}
        <div className="border-t border-slate-100 px-6 py-3"><Link to="/tests" className="text-sm font-semibold text-brand-600 hover:text-brand-700">View all examinations →</Link></div>
      </div>
      <aside className="card p-6"><p className="page-kicker">Quick actions</p><h2 className="font-bold text-slate-900">Keep work moving</h2><div className="mt-5 space-y-3"><Link to="/tests/new" className="block rounded-xl border border-slate-200 p-4 transition hover:border-brand-200 hover:bg-brand-50"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white"><Icon name="plus" className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-800">New examination</p><p className="text-xs text-slate-500">Upload questions and invite candidates</p></div></div></Link><Link to="/tests" className="block rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"><p className="text-sm font-semibold text-slate-800">Review candidates</p><p className="mt-1 text-xs text-slate-500">Search allow-lists and adjust access.</p></Link></div></aside>
    </section>
  </div>;
}
