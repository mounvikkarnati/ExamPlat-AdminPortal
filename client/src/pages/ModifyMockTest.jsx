import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { StatusBadge } from "./Dashboard.jsx";

const toTimeInput = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function ModifyMockTest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
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
    api.get(`/mock-tests/${id}`).then(({ data }) => {
      setTest(data.test);
      setCanManage(data.canManage);
      setQuestionCount(data.questionCount);
      setStartTime(toTimeInput(data.test.defaultStartAt));
      setEndTime(toTimeInput(data.test.defaultEndAt));
      setDefaultAttempts(data.test.defaultAttempts);
    });
  }, [id]);

  const loadCandidates = useCallback(() => {
    api.get(`/mock-tests/${id}/candidates`, { params: { search, page, limit } }).then(({ data }) => {
      setCandidates(data.candidates);
      setTotal(data.total);
    });
  }, [id, search, page]);

  useEffect(() => {
    loadTest();
  }, [loadTest]);
  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleSaveDefaults = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const { data } = await api.put(`/mock-tests/${id}`, { startTime, endTime, defaultAttempts });
      setTest(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err.response?.data?.message || "Could not save mock test defaults");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    setAddError("");
    if (!newTicket.trim()) return;
    try {
      await api.post(`/mock-tests/${id}/candidates`, { hallTicketNo: newTicket.trim() });
      setNewTicket("");
      loadCandidates();
      loadTest();
    } catch (err) {
      setAddError(err.response?.data?.message || "Failed to add student");
    }
  };

  const publishResults = async () => {
    setPublishing(true);
    setPublishMessage("");
    try {
      const { data } = await api.post(`/mock-tests/${id}/publish-results`);
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
    if (
      !window.confirm(`Delete "${test?.title}" and all related questions and students? This cannot be undone.`)
    ) {
      return;
    }

    setDeleting(true);
    setSaveError("");
    try {
      await api.delete(`/mock-tests/${id}`);
      navigate("/mock-tests", { replace: true });
    } catch (err) {
      setSaveError(err.response?.data?.message || "Could not delete mock test");
    } finally {
      setDeleting(false);
    }
  };

  if (!test) return <p className="text-sm text-slate-500">Loading…</p>;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div>
        <Link to="/mock-tests" className="text-sm text-brand-600 hover:underline">
          ← All mock tests
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
              {test.testId} · {questionCount} questions · {test.candidateCount} students
              {test.selectAllStudents ? ` · All ${test.examCategory} students` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-500">Created by {test.createdBy?.name || "—"}</p>
            {!canManage && (
              <p className="mt-2 text-sm font-medium text-amber-700">View only — only the creator can manage this mock test.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={test.status} />
            {canManage && test.status === "Completed" && (
              <button onClick={publishResults} disabled={publishing} className="btn-primary text-sm">
                {publishing ? "Publishing…" : "Publish results"}
              </button>
            )}
            {canManage && (
              <button
                onClick={handleDeleteTest}
                disabled={deleting}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete mock test"}
              </button>
            )}
          </div>
        </div>
        {canManage && test.status === "Completed" && (
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
        <h2 className="mb-1 font-medium text-slate-800">Mock test defaults</h2>
        <p className="mb-4 text-xs text-slate-500">
          The date portion is fixed at creation — only start/end time-of-day and attempts can be changed here.
        </p>
        {canManage ? (
          <form onSubmit={handleSaveDefaults} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label">Start Time</label>
              <input
                type="time"
                className="input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Date: {new Date(test.defaultStartAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">
                Date: {new Date(test.defaultEndAt).toLocaleDateString()}
              </p>
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
                onChange={(e) => setDefaultAttempts(e.target.value)}
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {saved && <span className="text-sm text-green-600">Saved ✓</span>}
            {saveError && <span className="text-sm text-red-600">{saveError}</span>}
          </form>
        ) : (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Start</p>
              <p className="font-medium">{new Date(test.defaultStartAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500">End</p>
              <p className="font-medium">{new Date(test.defaultEndAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500">Attempts</p>
              <p className="font-medium">{test.defaultAttempts}</p>
            </div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-medium text-slate-800">Enrolled students</h2>
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
              + Add student
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
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  No students found.
                </td>
              </tr>
            ) : (
              candidates.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{c.hallTicketNo}</td>
                  <td className="px-3 py-2 capitalize text-slate-600">{c.status}</td>
                  <td className="px-3 py-2 text-slate-600">{c.score ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/mock-tests/${id}/candidates/${c._id}`}
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
            Page {page} of {totalPages} ({total} students)
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
