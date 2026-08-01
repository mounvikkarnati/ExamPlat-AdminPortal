import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CandidateDetail() {
  const { testId, candidateId } = useParams();
  const [data, setData] = useState(null);
  const [startOverride, setStartOverride] = useState("");
  const [endOverride, setEndOverride] = useState("");
  const [attemptsOverride, setAttemptsOverride] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api.get(`/tests/${testId}/candidates/${candidateId}`).then(({ data }) => {
      setData(data);
      setStartOverride(toLocalInput(data.candidate.startAtOverride));
      setEndOverride(toLocalInput(data.candidate.endAtOverride));
      setAttemptsOverride(data.candidate.attemptsOverride ?? "");
    });
  };

  useEffect(() => { load(); }, [testId, candidateId]); // eslint-disable-line

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await api.put(`/tests/${testId}/candidates/${candidateId}`, {
        startAtOverride: startOverride || null,
        endAtOverride: endOverride || null,
        attemptsOverride: attemptsOverride === "" ? "" : Number(attemptsOverride),
      });
      load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save candidate overrides");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  const { candidate, effective } = data;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to={`/tests/${testId}`} className="text-sm text-brand-600 hover:underline">← Back to Modify Test</Link>
        <h1 className="text-xl font-semibold text-slate-900 mt-2">{candidate.hallTicketNo}</h1>
        <p className="text-sm text-slate-500 capitalize">Status: {candidate.status}</p>
      </div>

      <div className="card p-6">
        <h2 className="font-medium text-slate-800 mb-4">Effective Settings</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-slate-500">Start</p><p className="font-medium">{new Date(effective.startAt).toLocaleString()}</p></div>
          <div><p className="text-slate-500">End</p><p className="font-medium">{new Date(effective.endAt).toLocaleString()}</p></div>
          <div><p className="text-slate-500">Attempts</p><p className="font-medium">{effective.attempts} (used: {candidate.attemptsUsed})</p></div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-medium text-slate-800 mb-1">Per-Candidate Overrides</h2>
        <p className="text-xs text-slate-500 mb-4">
          Only applies to this candidate — the test-wide default shown to everyone else is unaffected (Section 5.3).
        </p>
        <form onSubmit={handleSave} className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="label">Start Override</label>
            <input type="datetime-local" className="input" value={startOverride} onChange={(e) => setStartOverride(e.target.value)} />
          </div>
          <div>
            <label className="label">End Override</label>
            <input type="datetime-local" className="input" value={endOverride} onChange={(e) => setEndOverride(e.target.value)} />
          </div>
          <div>
            <label className="label">Attempts Override</label>
            <input type="number" min={1} max={20} className="input" value={attemptsOverride} onChange={(e) => setAttemptsOverride(e.target.value)} placeholder="inherit default" />
          </div>
          <div className="col-span-3 flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Overrides"}</button>
            {saved && <span className="text-sm text-green-600">Saved ✓</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-medium text-slate-800 mb-4">Violation Log</h2>
        {candidate.violations?.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {candidate.violations.map((v, i) => (
              <li key={i} className="py-2 flex justify-between">
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
        <h2 className="font-medium text-slate-800 mb-2">Result</h2>
        <p className="text-sm text-slate-600">
          Score: <span className="font-medium">{candidate.score ?? "Not yet available"}</span>
        </p>
        {candidate.submissionReason && (
          <p className="text-sm text-slate-500 mt-1">Submission reason: {candidate.submissionReason}</p>
        )}
      </div>
    </div>
  );
}
