import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext.jsx";
import { StatusBadge } from "./Dashboard.jsx";
import AdminAccessPicker from "../components/AdminAccessPicker.jsx";

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function ModifyTest() {
  const { isSuperAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canEditManagers, setCanEditManagers] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [defaultAttempts, setDefaultAttempts] = useState(1);
  const [durHours, setDurHours] = useState(1);
  const [durMinutes, setDurMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [adminsList, setAdminsList] = useState([]);
  const [allowAllAdmins, setAllowAllAdmins] = useState(false);
  const [selectedAdmins, setSelectedAdmins] = useState(new Set());
  const [managerSaving, setManagerSaving] = useState(false);
  const [managerSaved, setManagerSaved] = useState(false);
  const [managerError, setManagerError] = useState("");

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
      setCanManage(data.canManage);
      setCanPublish(data.canPublish);
      setCanDelete(data.canDelete);
      setCanEditManagers(data.canEditManagers);
      setQuestionCount(data.questionCount);
      setStartAt(toLocalInput(data.test.defaultStartAt));
      setEndAt(toLocalInput(data.test.defaultEndAt));
      setDefaultAttempts(data.test.defaultAttempts);
      setDurHours(data.test.duration?.hours ?? 1);
      setDurMinutes(data.test.duration?.minutes ?? 0);
      if (data.canEditManagers) {
        setAllowAllAdmins(!!data.test.allowAllAdmins);
        setSelectedAdmins(new Set((data.test.allowedAdmins || []).map((a) => String(a._id || a))));
      }
    });
  }, [id]);

  const loadAdmins = useCallback(() => {
    api
      .get("/admins")
      .then(({ data }) => {
        const active = (Array.isArray(data) ? data : []).filter((a) => a.role === "admin" && a.active);
        setAdminsList(active);
      })
      .catch(() => setAdminsList([]));
  }, []);

  const loadCandidates = useCallback(() => {
    api.get(`/tests/${id}/candidates`, { params: { search, page, limit } }).then(({ data }) => {
      setCandidates(data.candidates);
      setTotal(data.total);
      if (typeof data.canManage === "boolean") setCanManage(data.canManage);
    });
  }, [id, search, page]);

  useEffect(() => {
    loadTest();
  }, [loadTest]);
  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);
  useEffect(() => {
    if (isSuperAdmin) loadAdmins();
  }, [isSuperAdmin, loadAdmins]);

  const handleSaveDefaults = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const { data } = await api.put(`/tests/${id}`, {
        startAt,
        endAt,
        defaultAttempts,
        durationHours: durHours,
        durationMinutes: durMinutes,
      });
      setTest(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err.response?.data?.message || "Could not save examination schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveManagers = async (e) => {
    e.preventDefault();
    setManagerSaving(true);
    setManagerSaved(false);
    setManagerError("");
    try {
      const { data } = await api.put(`/tests/${id}/managers`, {
        allowAllAdmins,
        allowedAdmins: [...selectedAdmins],
      });
      setTest(data);
      setManagerSaved(true);
      setTimeout(() => setManagerSaved(false), 2000);
    } catch (err) {
      setManagerError(err.response?.data?.message || "Could not save modify access");
    } finally {
      setManagerSaving(false);
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
      setPublishMessage(
        `Published: ${delivered} sent${skipped ? `, ${skipped} already sent` : ""}${missingEmail ? `, ${missingEmail} without email` : ""}${failed ? `, ${failed} failed` : ""}.`
      );
      loadTest();
    } catch (err) {
      setPublishMessage(err.response?.data?.message || "Could not publish results");
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteTest = async () => {
    if (!window.confirm(`Delete "${test?.title}" and all related questions and students? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    setSaveError("");
    try {
      await api.delete(`/tests/${id}`);
      navigate("/tests", { replace: true });
    } catch (err) {
      setSaveError(err.response?.data?.message || "Could not delete examination");
    } finally {
      setDeleting(false);
    }
  };

  if (!test) return <p className="text-sm text-slate-500">Loading…</p>;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/tests" className="text-sm text-brand-600 hover:underline">
          ← All examinations
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{test.title}</h1>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {test.examCategory}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {test.finalExamId || test.testId} · {questionCount} questions · {test.candidateCount} students
              {test.selectAllStudents ? ` · All ${test.examCategory} students` : ""}
              {` · Duration ${test.duration?.hours ?? 1}h ${test.duration?.minutes ?? 0}m`}
            </p>
            <p className="mt-1 text-sm text-slate-500">Created by {test.createdBy?.name || "—"}</p>
            {!canManage && (
              <p className="mt-2 text-sm font-medium text-amber-700">
                View only — you don't have modify access to this examination.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={test.status} />
            {canPublish && test.status === "Completed" && (
              <button onClick={publishResults} disabled={publishing} className="btn-primary text-sm">
                {publishing ? "Publishing…" : "Publish results"}
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDeleteTest}
                disabled={deleting}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete examination"}
              </button>
            )}
          </div>
        </div>
        {canPublish && test.status === "Completed" && (
          <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <span className="font-semibold">Result delivery.</span> Send every student their result and response PDF.{" "}
            {publishMessage && (
              <span className={publishMessage.includes("Could") ? "text-red-700" : "text-emerald-700"}>
                {publishMessage}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-medium text-slate-800">Schedule &amp; attempts</h2>
          {!canManage && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Read only — no modify access
            </span>
          )}
        </div>
        <form onSubmit={handleSaveDefaults} className="grid grid-cols-2 gap-4 items-end lg:grid-cols-5">
          <div>
            <label className="label">Start Date &amp; Time</label>
            <input
              type="datetime-local"
              required
              className="input"
              value={startAt}
              disabled={!canManage}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div>
            <label className="label">End Date &amp; Time</label>
            <input
              type="datetime-local"
              required
              className="input"
              value={endAt}
              disabled={!canManage}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Default Attempts</label>
            <input
              type="number"
              min={1}
              max={20}
              required
              className="input w-28"
              value={defaultAttempts}
              disabled={!canManage}
              onChange={(e) => setDefaultAttempts(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Duration — Hours (24h)</label>
            <input
              type="number"
              min={0}
              max={23}
              className="input"
              value={durHours}
              disabled={!canManage}
              onChange={(e) => setDurHours(e.target.value === "" ? 0 : e.target.value)}
            />
          </div>
          <div>
            <label className="label">Duration — Minutes</label>
            <input
              type="number"
              min={0}
              max={59}
              className="input"
              value={durMinutes}
              disabled={!canManage}
              onChange={(e) => setDurMinutes(e.target.value === "" ? 0 : e.target.value)}
            />
          </div>
          {canManage && (
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          )}
          {saved && <span className="text-sm text-green-600">Saved ✓</span>}
          {saveError && <span className="text-sm text-red-600">{saveError}</span>}
        </form>
      </div>

      {canEditManagers && (
        <div className="card p-6">
          <h2 className="mb-4 font-medium text-slate-800">Who can modify this examination?</h2>
          <AdminAccessPicker
            allowAll={allowAllAdmins}
            selected={selectedAdmins}
            available={adminsList}
            onChange={({ allowAll, selected }) => {
              setAllowAllAdmins(allowAll);
              setSelectedAdmins(selected);
            }}
          />
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={handleSaveManagers} disabled={managerSaving} className="btn-primary">
              {managerSaving ? "Saving…" : "Save modify access"}
            </button>
            {managerSaved && <span className="text-sm text-green-600">Saved ✓</span>}
            {managerError && <span className="text-sm text-red-600">{managerError}</span>}
          </div>
        </div>
      )}

      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-medium text-slate-800">Allowed candidates</h2>
          <input
            type="text"
            placeholder="Search by Hall Ticket No…"
            className="input max-w-xs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {canManage && (
          <form onSubmit={handleAddCandidate} className="mb-4 flex items-center gap-2">
            <input
              type="text"
              placeholder="New Hall Ticket No."
              className="input max-w-xs"
              value={newTicket}
              onChange={(e) => setNewTicket(e.target.value)}
            />
            <button type="submit" className="btn-secondary text-sm">
              + Add candidate
            </button>
            {addError && <span className="text-xs text-red-600">{addError}</span>}
          </form>
        )}

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Hall Ticket No.</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Attempt</th>
              <th className="px-3 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No candidates found.
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{c.hallTicketNo}</td>
                  <td className="px-3 py-2 capitalize text-slate-600">{c.status}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {c.score !== null && c.score !== undefined
                      ? `${c.score}${c.totalMarks ? ` / ${c.totalMarks}` : ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {c.attemptNumber ? `#${c.attemptNumber}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/tests/${id}/candidates/${c._id}`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {canManage ? "View / Edit" : "View"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {totalPages} ({total} candidates)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-xs disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}