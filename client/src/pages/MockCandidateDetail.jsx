import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function MockCandidateDetail() {
  const { testId, candidateId } = useParams();
  const [data, setData] = useState(null);
  const [startOverride, setStartOverride] = useState("");
  const [endOverride, setEndOverride] = useState("");
  const [attemptsOverride, setAttemptsOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api.get(`/mock-tests/${testId}/candidates/${candidateId}`).then(({ data }) => {
      setData(data);
      setStartOverride(toLocalInput(data.candidate.startAtOverride));
      setEndOverride(toLocalInput(data.candidate.endAtOverride));
      setAttemptsOverride(data.candidate.attemptsOverride ?? "");
    });
  };

  useEffect(() => {
    load();
  }, [testId, candidateId]); // eslint-disable-line

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await api.put(`/mock-tests/${testId}/candidates/${candidateId}`, {
        startAtOverride: startOverride || null,
        endAtOverride: endOverride || null,
        attemptsOverride: attemptsOverride === "" ? "" : Number(attemptsOverride),
      });
      load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save student overrides");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  const { candidate, effective, canManage } = data;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to={`/mock-tests/${testId}`} className="text-sm text-brand-600 hover:underline">
          ← Back to mock test
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{candidate.hallTicketNo}</h1>
        <p className="text-sm capitalize text-slate-500">Status: {candidate.status}</p>
        {!canManage && (
          <p className="mt-2 text-sm font-medium text-amber-700">View only — only the creator can edit overrides.</p>
        )}
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-medium text-slate-800">Effective settings</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Start</p>
            <p className="font-medium">{new Date(effective.startAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-500">End</p>
            <p className="font-medium">{new Date(effective.endAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-500">Attempts</p>
            <p className="font-medium">
              {effective.attempts} (used: {candidate.attemptsUsed})
            </p>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="card p-6">
          <h2 className="mb-1 font-medium text-slate-800">Per-student overrides</h2>
          <p className="mb-4 text-xs text-slate-500">Only applies to this student — the mock test default is unaffected.</p>
          <form onSubmit={handleSave} className="grid grid-cols-3 items-end gap-4">
            <div>
              <label className="label">Start override</label>
              <input
                type="datetime-local"
                className="input"
                value={startOverride}
                onChange={(e) => setStartOverride(e.target.value)}
              />
            </div>
            <div>
              <label className="label">End override</label>
              <input
                type="datetime-local"
                className="input"
                value={endOverride}
                onChange={(e) => setEndOverride(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Attempts override</label>
              <input
                type="number"
                min={1}
                max={20}
                className="input"
                value={attemptsOverride}
                onChange={(e) => setAttemptsOverride(e.target.value)}
                placeholder="inherit default"
              />
            </div>
            <div className="col-span-3 flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Save overrides"}
              </button>
              {saved && <span className="text-sm text-green-600">Saved ✓</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </form>
        </div>
      ) : null}

      <div className="card p-6">
        <h2 className="mb-4 font-medium text-slate-800">Violation log</h2>
        {candidate.violations?.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {candidate.violations.map((v, i) => (
              <li key={i} className="flex justify-between py-2">
                <span className="font-medium text-slate-700">{v.type}</span>
                <span className="text-slate-500">{new Date(v.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No violations recorded.</p>
        )}
      </div>

      <div className="card p-6">
        <h2 className="mb-2 font-medium text-slate-800">Result</h2>
        <p className="text-sm text-slate-600">
          Score: <span className="font-medium">{candidate.score ?? "Not yet available"}</span>
        </p>
        {candidate.submissionReason && (
          <p className="mt-1 text-sm text-slate-500">Submission reason: {candidate.submissionReason}</p>
        )}
      </div>
    </div>
  );
}
