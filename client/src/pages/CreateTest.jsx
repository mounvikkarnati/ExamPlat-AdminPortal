import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { Icon } from "../components/Navbar.jsx";

export default function CreateTest() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    subject: "",
    startAt: "",
    endAt: "",
    defaultAttempts: 1,
  });
  const [questionFile, setQuestionFile] = useState(null);
  const [candidateFile, setCandidateFile] = useState(null);
  const [errors, setErrors] = useState(null); // { questionErrors, candidateErrors }
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const readiness = useMemo(() => [
    ["Exam details", Boolean(form.title && form.startAt && form.endAt)],
    ["Question bank", Boolean(questionFile)],
    ["Candidate list", Boolean(candidateFile)],
  ], [form, questionFile, candidateFile]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors(null);
    setSuccess(null);

    if (!questionFile || !candidateFile) {
      setErrors({ questionErrors: !questionFile ? ["Question file is required"] : [], candidateErrors: !candidateFile ? ["Candidate allow-list file is required"] : [] });
      return;
    }
    if (new Date(form.endAt) <= new Date(form.startAt)) {
      setErrors({ questionErrors: [], candidateErrors: [], message: "End date and time must be after the start date and time." });
      return;
    }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("questionFile", questionFile);
    fd.append("candidateFile", candidateFile);

    setSubmitting(true);
    try {
      const { data } = await api.post("/tests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(data);
      setTimeout(() => navigate(`/tests/${data.test._id}`), 1500);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data);
      } else {
        setErrors({ questionErrors: [], candidateErrors: [], message: err.response?.data?.message || "Failed to create test" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="page-kicker">New assessment</p><h1 className="page-title">Create examination</h1><p className="page-subtitle">Configure the schedule, upload the question bank, and authorize candidates.</p></div><div className="flex gap-2">{readiness.map(([label, ready], i) => <div key={label} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400"}`}><span className="mr-1">{ready ? "✓" : i + 1}</span>{label}</div>)}</div></div>

      {success && (
        <div className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          Test <strong>{success.test.testId}</strong> created with {success.questionCount} questions and {success.candidateCount} candidates. Redirecting…
        </div>
      )}

      {(errors?.message) && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{errors.message}</div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <div className="card p-6 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-wider text-brand-600">Step 1</p><h2 className="mt-1 font-bold text-slate-800">Assessment details</h2></div>
          <div>
            <label className="label">Title</label>
            <input required className="input" value={form.title} onChange={update("title")} placeholder="e.g. Physics Mock Test - Batch 3" />
          </div>
          <div>
            <label className="label">Subject (optional)</label>
            <input className="input" value={form.subject} onChange={update("subject")} placeholder="e.g. Physics" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date & Time</label>
              <input required type="datetime-local" className="input" value={form.startAt} onChange={update("startAt")} />
            </div>
            <div>
              <label className="label">End Date & Time</label>
              <input required type="datetime-local" className="input" value={form.endAt} onChange={update("endAt")} />
            </div>
          </div>
          <div>
            <label className="label">Default Attempts</label>
            <input type="number" min={1} max={20} required className="input w-32" value={form.defaultAttempts} onChange={update("defaultAttempts")} />
          </div>
        </div>

        <div className="card p-6 space-y-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-brand-600">Step 2</p><h2 className="mt-1 font-bold text-slate-800">Question bank</h2><p className="mt-1 text-xs text-slate-500">Excel (.xlsx) following the question template, or an equivalent JSON file.</p></div>
          <input
            type="file"
            accept=".xlsx,.json"
            required
            onChange={(e) => setQuestionFile(e.target.files[0])}
            className="block text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-sm file:font-medium hover:file:bg-brand-100"
          />
          {errors?.questionErrors?.length > 0 && (
            <ul className="text-xs text-red-600 list-disc pl-5 space-y-0.5 max-h-32 overflow-y-auto">
              {errors.questionErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>

        <div className="card p-6 space-y-3">
          <div><p className="text-xs font-bold uppercase tracking-wider text-brand-600">Step 3</p><h2 className="mt-1 font-bold text-slate-800">Candidate access</h2><p className="mt-1 text-xs text-slate-500">Excel sheet of Hall Ticket Numbers permitted to attempt this test.</p></div>
          <input
            type="file"
            accept=".xlsx"
            required
            onChange={(e) => setCandidateFile(e.target.files[0])}
            className="block text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:text-sm file:font-medium hover:file:bg-brand-100"
          />
          {errors?.candidateErrors?.length > 0 && (
            <ul className="text-xs text-red-600 list-disc pl-5 space-y-0.5 max-h-32 overflow-y-auto">
              {errors.candidateErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary gap-2">
          <Icon name="plus" className="h-4 w-4" />{submitting ? "Creating…" : "Create examination"}
        </button>
      </div>
      <aside className="card h-fit p-5 lg:sticky lg:top-8"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Review</p><h2 className="mt-2 font-bold text-slate-900">Before you publish</h2><ul className="mt-4 space-y-3 text-sm text-slate-600"><li className="flex gap-2"><span className="text-brand-600">•</span>Dates and times can be adjusted after creation.</li><li className="flex gap-2"><span className="text-brand-600">•</span>Every candidate receives the default attempt limit.</li><li className="flex gap-2"><span className="text-brand-600">•</span>Upload errors are reported by row before anything is saved.</li></ul>{form.startAt && form.endAt && <div className="mt-5 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Scheduled window</p><p className="mt-1 text-sm font-semibold text-slate-800">{new Date(form.startAt).toLocaleString()}</p><p className="text-xs text-slate-400">to {new Date(form.endAt).toLocaleString()}</p></div>}</aside>
      </form>
    </div>
  );
}
