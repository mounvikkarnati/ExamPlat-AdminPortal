import { useEffect, useState } from "react";
import api from "../api/axios";

// Used on both the Create Examination and Modify Examination pages so the Super
// Admin can choose which admins may modify an examination:
//   - "Allow all admins"  -> every active admin account gets modify access
//   - otherwise, specific admins are ticked from the list below
// The Super Admin always has access and is therefore not shown in the list.
export default function AdminAccessPicker({ allowAll, selected, onChange, available = null }) {
  const [admins, setAdmins] = useState(available || []);
  const [loading, setLoading] = useState(!available);
  const [error, setError] = useState("");

  useEffect(() => {
    if (available) {
      setAdmins(available);
      setLoading(false);
      return;
    }
    api
      .get("/admins")
      .then(({ data }) => {
        const activeAdmins = (Array.isArray(data) ? data : []).filter(
          (a) => a.role === "admin" && a.active
        );
        setAdmins(activeAdmins);
      })
      .catch((err) => setError(err.response?.data?.message || "Could not load admin list"))
      .finally(() => setLoading(false));
  }, [available]);

  const sel = selected || new Set();

  const toggleAdmin = (id) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ allowAll, selected: next });
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <input
          type="checkbox"
          checked={!!allowAll}
          onChange={(e) => onChange({ allowAll: e.target.checked, selected: sel })}
          className="mt-0.5 h-4 w-4 rounded text-brand-600"
        />
        <div>
          <p className="text-sm font-semibold text-slate-800">Allow all admins access to modify</p>
          <p className="mt-1 text-xs text-slate-500">
            Every active admin account will be able to edit this examination's schedule, attempts, and candidate list.
          </p>
        </div>
      </label>

      {!allowAll && (
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            Or choose specific admins who can modify this examination
          </p>
          {loading ? (
            <p className="py-2 text-xs text-slate-400">Loading admins…</p>
          ) : error ? (
            <p className="py-2 text-xs text-red-600">{error}</p>
          ) : admins.length === 0 ? (
            <p className="py-2 text-xs text-slate-400">No active admins available.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {admins.map((a) => (
                <li key={a._id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={sel.has(a._id)}
                      onChange={() => toggleAdmin(a._id)}
                      className="h-4 w-4 rounded text-brand-600"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {a.name || "(no name)"}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{a.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400">
        The Super Admin always has modify access to every examination. Admins with access can edit
        schedule, attempts, and candidates, but only the Super Admin can publish results or delete
        the examination.
      </p>
    </div>
  );
}