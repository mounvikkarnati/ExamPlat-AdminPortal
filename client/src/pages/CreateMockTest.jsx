import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { Icon } from "../components/Navbar.jsx";

export default function CreateMockTest() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    subject: "",
    startAt: "",
    endAt: "",
    defaultAttempts: 1,
    examCategory: "JEE",
  });
  const [selectAllStudents, setSelectAllStudents] = useState(false);
  const [eligibleCount, setEligibleCount] = useState(null);
  const [questionFile, setQuestionFile] = useState(null);
  const [candidateFile, setCandidateFile] = useState(null);
  const [errors, setErrors] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const readiness = useMemo(
    () => [
      ["Exam details", Boolean(form.title && form.startAt && form.endAt && form.examCategory)],
      ["Question bank", Boolean(questionFile)],
      ["Student access", selectAllStudents || Boolean(candidateFile)],
    ],
    [form, questionFile, candidateFile, selectAllStudents]
  );

  useEffect(() => {
    api
      .get("/mock-tests/eligible-count", { params: { examCategory: form.examCategory } })
      .then(({ data }) => setEligibleCount(data.count))
      .catch(() => setEligibleCount(null));
  }, [form.examCategory]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors(null);
    setSuccess(null);

    if (!questionFile) {
      setErrors({ questionErrors: ["Question file is required"], candidateErrors: [] });
      return;
    }
    if (!selectAllStudents && !candidateFile) {
      setErrors({
        questionErrors: [],
        candidateErrors: ["Upload a student list or choose Select all students"],
      });
      return;
    }
    if (new Date(form.endAt) <= new Date(form.startAt)) {
      setErrors({
        questionErrors: [],
        candidateErrors: [],
        message: "End date and time must be after the start date and time.",
      });
      return;
    }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("selectAllStudents", selectAllStudents);
    fd.append("questionFile", questionFile);
    if (!selectAllStudents && candidateFile) {
      fd.append("candidateFile", candidateFile);
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/mock-tests", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(data);
      setTimeout(() => navigate(`/mock-tests/${data.test._id}`), 1500);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data);
      } else {
        setErrors({
          questionErrors: [],
          candidateErrors: [],
          message: err.response?.data?.message || "Failed to create mock test",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="page-kicker">New mock test</p>
          <h1 className="page-title">Create mock test</h1>
          <p className="page-subtitle">
            Upload questions, choose JEE or NEET, and assign all or selected students.
          </p>
        </div>
        <div className="flex gap-2">
          {readiness.map(([label, ready], i) => (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400"}`}
            >
              <span className="mr-1">{ready ? "✓" : i + 1}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Mock test <strong>{success.test.testId}</strong> created with {success.questionCount} questions and{" "}
          {success.candidateCount} students. Redirecting…
        </div>
      )}

      {errors?.message && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <div className="card space-y-4 p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Step 1</p>
              <h2 className="mt-1 font-bold text-slate-800">Assessment details</h2>
            </div>
            <div>
              <label className="label">Title</label>
              <input
                required
                className="input"
                value={form.title}
                onChange={update("title")}
                placeholder="e.g. JEE Physics Mock - Week 12"
              />
            </div>
            <div>
              <label className="label">Subject (optional)</label>
              <input
                className="input"
                value={form.subject}
                onChange={update("subject")}
                placeholder="e.g. Physics"
              />
            </div>
            <div>
              <label className="label">Exam category</label>
              <div className="mt-2 flex gap-6">
                {["JEE", "NEET"].map((cat) => (
                  <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      name="examCategory"
                      value={cat}
                      checked={form.examCategory === cat}
                      onChange={update("examCategory")}
                      className="h-4 w-4 text-brand-600"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date & Time</label>
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={form.startAt}
                  onChange={update("startAt")}
                />
              </div>
              <div>
                <label className="label">End Date & Time</label>
                <input
                  required
                  type="datetime-local"
                  className="input"
                  value={form.endAt}
                  onChange={update("endAt")}
                />
              </div>
            </div>
            <div>
              <label className="label">Default Attempts</label>
              <input
                type="number"
                min={1}
                max={20}
                required
                className="input w-32"
                value={form.defaultAttempts}
                onChange={update("defaultAttempts")}
              />
            </div>
          </div>

          <div className="card space-y-3 p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Step 2</p>
              <h2 className="mt-1 font-bold text-slate-800">Question bank</h2>
              <p className="mt-1 text-xs text-slate-500">
                Excel (.xlsx) following the question template, or an equivalent JSON file.
              </p>
            </div>
            <input
              type="file"
              accept=".xlsx,.json"
              required
              onChange={(e) => setQuestionFile(e.target.files[0])}
              className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            {errors?.questionErrors?.length > 0 && (
              <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-red-600">
                {errors.questionErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="card space-y-4 p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Step 3</p>
              <h2 className="mt-1 font-bold text-slate-800">Student access</h2>
              <p className="mt-1 text-xs text-slate-500">
                Enroll all registered {form.examCategory} students or upload a specific list.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <input
                type="checkbox"
                checked={selectAllStudents}
                onChange={(e) => {
                  setSelectAllStudents(e.target.checked);
                  if (e.target.checked) setCandidateFile(null);
                }}
                className="mt-0.5 h-4 w-4 rounded text-brand-600"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">Select all {form.examCategory} students</p>
                <p className="mt-1 text-xs text-slate-500">
                  {eligibleCount === null
                    ? "Checking eligible students…"
                    : `${eligibleCount} registered ${form.examCategory} student${eligibleCount === 1 ? "" : "s"} will be enrolled.`}
                </p>
              </div>
            </label>

            {!selectAllStudents && (
              <>
                <p className="text-xs text-slate-500">Or upload an Excel sheet of Hall Ticket Numbers.</p>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setCandidateFile(e.target.files[0])}
                  className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                />
              </>
            )}

            {errors?.candidateErrors?.length > 0 && (
              <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs text-red-600">
                {errors.candidateErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary gap-2">
            <Icon name="plus" className="h-4 w-4" />
            {submitting ? "Creating…" : "Create mock test"}
          </button>
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-8">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Review</p>
          <h2 className="mt-2 font-bold text-slate-900">Before you publish</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="text-brand-600">•</span>
              Only students on the allow-list will see this mock test in their portal.
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">•</span>
              Only you can manage or delete this mock test after creation.
            </li>
            <li className="flex gap-2">
              <span className="text-brand-600">•</span>
              Upload errors are reported by row before anything is saved.
            </li>
          </ul>
          {form.startAt && form.endAt && (
            <div className="mt-5 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">Scheduled window</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {new Date(form.startAt).toLocaleString()}
              </p>
              <p className="text-xs text-slate-400">to {new Date(form.endAt).toLocaleString()}</p>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}
