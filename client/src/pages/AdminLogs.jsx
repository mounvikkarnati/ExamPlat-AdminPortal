import { useEffect, useState } from "react";
import api from "../api/axios";

const PAGE_SIZES = [10, 25, 50, 100];

const actionTone = (action = "") => {
  if (/CREATE|ADD/i.test(action)) return "bg-emerald-50 text-emerald-700";
  if (/DELETE|DISABLE/i.test(action)) return "bg-rose-50 text-rose-700";
  if (/MODIFY|UPDATE|OVERRIDE|ENABLE/i.test(action)) return "bg-amber-50 text-amber-700";
  if (/PUBLISH/i.test(action)) return "bg-violet-50 text-violet-700";
  if (/LOGIN|PASSWORD|CHANGE/i.test(action)) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
};

const prettyDetails = (details) => {
  if (details === undefined || details === null || details === "") return null;
  try {
    return JSON.stringify(details, null, 2);
  } catch (err) {
    return String(details);
  }
};

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [action, setAction] = useState("All");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get("/admins/logs", { params: { search: debouncedQuery, action, page, limit } })
      .then(({ data }) => {
        setLogs(data.logs);
        setTotal(data.total);
        if (Array.isArray(data.actions)) setActions(data.actions);
      })
      .catch((err) => setError(err.response?.data?.message || "Unable to load admin logs."))
      .finally(() => setLoading(false));
  }, [debouncedQuery, action, page, limit]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section>
        <p className="page-kicker">Audit trail</p>
        <h1 className="page-title">Admin logs</h1>
        <p className="page-subtitle">
          Every action recorded across the admin portal, straight from the adminlogs collection — newest first.
        </p>
      </section>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-8"
              placeholder="Search by admin name, email, action, collection, or IP…"
            />
          </div>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="input lg:w-52">
            <option value="All">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="input lg:w-32">
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size} per page</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-500">
          <span>{loading ? "Loading…" : `${total} log${total === 1 ? "" : "s"}${debouncedQuery || action !== "All" ? " matching filters" : ""}`}</span>
          {(debouncedQuery || action !== "All") && (
            <button
              onClick={() => { setQuery(""); setDebouncedQuery(""); setAction("All"); setPage(1); }}
              className="font-semibold text-brand-600"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/80 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Admin</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Target</th>
                <th className="px-5 py-3">IP address</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">Loading log entries…</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-red-600">{error}</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <p className="font-semibold text-slate-700">No log entries found</p>
                    <p className="mt-1 text-slate-400">Try a different search or clear the filters.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const detailText = prettyDetails(log.details);
                  return (
                    <tr key={log._id} className="align-top transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        <p className="font-medium text-slate-700">{formatDateTime(log.createdAt)}</p>
                        <p className="mt-1 text-xs text-slate-400">ID …{String(log._id).slice(-6)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">{log.adminId?.name || "—"}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.adminId?.email || "Unknown admin"}</p>
                        <p className="mt-0.5 text-[11px] uppercase text-slate-400">
                          {log.adminId?.role === "superadmin" ? "Super Admin" : log.adminId?.role === "admin" ? "Admin" : "Unknown"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`badge ${actionTone(log.action)}`}>{log.action}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        <p className="font-medium text-slate-700">{log.targetCollection || "—"}</p>
                        <p className="mt-1 text-xs text-slate-400">{log.targetId ? String(log.targetId) : "—"}</p>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">
                        {log.ipAddress || "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {detailText ? (
                          <details className="group">
                            <summary className="cursor-pointer select-none text-xs font-bold text-brand-600 hover:underline">
                              <span className="group-open:hidden">View details</span>
                              <span className="hidden group-open:inline">Hide details</span>
                            </summary>
                            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-left text-xs leading-relaxed text-slate-100">
                              {detailText}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          <span>
            Page {page} of {totalPages} ({total} entries)
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