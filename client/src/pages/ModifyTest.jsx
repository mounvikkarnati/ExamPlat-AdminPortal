import { useEffect, useState, useCallback } from "react";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext.jsx";
import { StatusBadge } from "./Dashboard.jsx";

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function ModifyTest() {
  const { admin, isSuperAdmin } = useAuth();
  const currentAdminId = admin?.id || admin?._id;
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [defaultAttempts, setDefaultAttempts] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [candidates, setCandidates] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [newTicket, setNewTicket] = useState("");
  const [addError, setAddError] = useState("");

  const loadTest = useCallback(() => {
    api.get(`/tests/${id}`).then(({ data }) => {
      setTest(data.test);
      setQuestionCount(data.questionCount);
      setStartAt(toLocalInput(data.test.defaultStartAt));
      setEndAt(toLocalInput(data.test.defaultEndAt));
      setDefaultAttempts(data.test.defaultAttempts);
    });
  }, [id]);

  const loadCandidates = useCallback(() => {
    api
      .get(`/tests/${id}/candidates`, { params: { search, page, limit } })
      .then(({ data }) => {
        setCandidates(data.candidates);
        setTotal(data.total);
      });
  }, [id, search, page]);

  useEffect(() => { loadTest(); }, [loadTest]);
  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const handleSaveDefaults = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const { data } = await api.put(`/tests/${id}`, { startAt, endAt, defaultAttempts });
      setTest(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err.response?.data?.message || "Could not save test defaults");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    setAddError("");
    if (!newTicket.trim()) return;
    try {
      await api.post(`/tests/${id}/candidates`, { hallTicketNo: newTicket.trim() });
      setNewTicket("");
      loadCandidates();
      loadTest();
    } catch (err) {
      setAddError(err.response?.data?.message || "Failed to add candidate");
    }
  };

  const publishResults = async () => {
    setPublishing(true);
    setPublishMessage("");
    try {
      const { data } = await api.post(`/tests/${id}/publish-results`);
      const { delivered, skipped, failed, missingEmail } = data.summary;
      setPublishMessage(`Published: ${delivered} sent${skipped ? `, ${skipped} already sent` : ""}${missingEmail ? `, ${missingEmail} without email` : ""}${failed ? `, ${failed} failed` : ""}.`);
      loadTest();
    } catch (err) {
      setPublishMessage(err.response?.data?.message || "Could not publish results");
    } finally { setPublishing(false); }
  };

  const handleDeleteTest = async () => {
    if (!window.confirm(`Delete "${test?.title}" and all related questions and candidates? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    setSaveError("");
    try {
      await api.delete(`/tests/${id}`);
      navigate("/tests", { replace: true });
    } catch (err) {
      setSaveError(err.response?.data?.message || "Could not delete exam");
    } finally {
      setDeleting(false);
    }
  };

  if (!test) return <p className="text-sm text-slate-500">Loading…</p>;
  const canManageCurrentTest = isSuperAdmin || (currentAdminId && test.createdBy && String(test.createdBy._id || test.createdBy.id || test.createdBy) === String(currentAdminId));
  if (!canManageCurrentTest) return <Navigate to="/tests" replace />;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/tests" className="text-sm text-brand-600 hover:underline">← All Tests</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{test.title}</h1>
            <p className="text-sm text-slate-500">{test.testId} · {questionCount} questions · {test.candidateCount} candidates</p>
            <p className="mt-1 text-sm text-slate-500">Created by {test.createdBy?.name || "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={test.status} />
            {test.status === "Completed" && <button onClick={publishResults} disabled={publishing} className="btn-primary text-sm">{publishing ? "Publishing…" : "Publish results"}</button>}
            {isSuperAdmin && (
              <button onClick={handleDeleteTest} disabled={deleting} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete exam"}
              </button>
            )}
          </div>
        </div>
        {test.status === "Completed" && <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900"><span className="font-semibold">Result delivery.</span> Send every candidate their result and response PDF. Candidates without an attempt receive an attendance PDF instead. {publishMessage && <span className={publishMessage.includes("Could") ? "text-red-700" : "text-emerald-700"}>{publishMessage}</span>}</div>}
      </div>

      <div className="card p-6">
        <h2 className="font-medium text-slate-800 mb-1">Modify Test Defaults</h2>
        <p className="text-xs text-slate-500 mb-4">
          Edit the start/end date and time, and the default attempt count.
        </p>
        <form onSubmit={handleSaveDefaults} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Start Date & Time</label>
            <input type="datetime-local" className="input" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <label className="label">End Date & Time</label>
            <input type="datetime-local" className="input" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
          <div>
            <label className="label">Default Attempts</label>
            <input type="number" min={1} max={20} required className="input w-28" value={defaultAttempts} onChange={(e) => setDefaultAttempts(e.target.value)} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Changes"}</button>
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
          {saveError && <span className="text-sm text-red-600">{saveError}</span>}
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h2 className="font-medium text-slate-800">Allowed Candidates</h2>
          <input
            type="text"
            placeholder="Search by Hall Ticket No…"
            className="input max-w-xs"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <form onSubmit={handleAddCandidate} className="flex items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="New Hall Ticket No."
            className="input max-w-xs"
            value={newTicket}
            onChange={(e) => setNewTicket(e.target.value)}
          />
          <button type="submit" className="btn-secondary text-sm">+ Add Candidate</button>
          {addError && <span className="text-xs text-red-600">{addError}</span>}
        </form>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2">Hall Ticket No.</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Score</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No candidates found.</td></tr>
            ) : (
              candidates.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{c.hallTicketNo}</td>
                  <td className="px-3 py-2 text-slate-600 capitalize">{c.status}</td>
                  <td className="px-3 py-2 text-slate-600">{c.score ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/tests/${id}/candidates/${c._id}`} className="text-brand-600 hover:underline text-xs">
                      View / Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>Page {page} of {totalPages} ({total} candidates)</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}