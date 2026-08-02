import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext.jsx";
import { StatusBadge } from "./Dashboard.jsx";
import { Icon } from "../components/Navbar.jsx";

export default function MockTestList() {
  const { admin, isAdmin } = useAuth();
  const currentAdminId = admin?.id || admin?._id;
  const canCreateMockTest = isAdmin;
  const canManageTest = (test) => {
    if (!currentAdminId || !test?.createdBy) return false;
    const creatorId = test.createdBy._id || test.createdBy.id || test.createdBy;
    return String(creatorId) === String(currentAdminId);
  };

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    api
      .get("/mock-tests")
      .then(({ data }) => setTests(data))
      .catch((err) => setError(err.response?.data?.message || "Unable to load mock tests."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      tests
        .filter((t) => status === "All" || t.status === status)
        .filter((t) =>
          `${t.title} ${t.testId} ${t.subject} ${t.examCategory}`.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) =>
          sort === "title"
            ? a.title.localeCompare(b.title)
            : sort === "start"
              ? new Date(a.defaultStartAt) - new Date(b.defaultStartAt)
              : new Date(b.createdAt) - new Date(a.createdAt)
        ),
    [tests, status, query, sort]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Practice assessments</p>
          <h1 className="page-title">Mock tests</h1>
          <p className="page-subtitle">Create JEE or NEET mock tests and assign them to registered students.</p>
          {!canCreateMockTest && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              Super admins can view mock tests, but only regular admins can create them.
            </p>
          )}
        </div>
        {canCreateMockTest && (
          <Link to="/mock-tests/new" className="btn-primary gap-2">
            <Icon name="plus" className="h-4 w-4" />
            Create mock test
          </Link>
        )}
      </section>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-8"
              placeholder="Search by title, ID, or category…"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input lg:w-40">
            <option>All</option>
            <option>Scheduled</option>
            <option>Live</option>
            <option>Completed</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input lg:w-44">
            <option value="newest">Newest first</option>
            <option value="start">Start date</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-500">
          <span>{loading ? "Loading…" : `${filtered.length} of ${tests.length} mock tests`}</span>
          {(query || status !== "All") && (
            <button
              onClick={() => {
                setQuery("");
                setStatus("All");
              }}
              className="font-semibold text-brand-600"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Assessment</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Schedule</th>
                <th className="px-5 py-3">Created by</th>
                <th className="px-5 py-3">Students</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Loading mock tests…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <p className="font-semibold text-slate-700">No mock tests found</p>
                    <p className="mt-1 text-slate-400">Try a different search or create a new mock test.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t._id} className="group transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link to={`/mock-tests/${t._id}`} className="font-semibold text-slate-800 hover:text-brand-600">
                        {t.title}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {t.testId} {t.subject ? `· ${t.subject}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {t.examCategory}
                      </span>
                      {t.selectAllStudents && (
                        <p className="mt-1 text-xs text-slate-400">All {t.examCategory} students</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <p>
                        {new Date(t.defaultStartAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(t.defaultStartAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <p className="font-medium text-slate-700">{t.createdBy?.name || "—"}</p>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700">{t.candidateCount}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canManageTest(t) ? (
                        <Link
                          to={`/mock-tests/${t._id}`}
                          className="text-xs font-bold text-brand-600 opacity-0 transition group-hover:opacity-100"
                        >
                          Manage →
                        </Link>
                      ) : (
                        <Link
                          to={`/mock-tests/${t._id}`}
                          className="text-xs text-slate-400 opacity-0 transition group-hover:opacity-100"
                        >
                          View →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
