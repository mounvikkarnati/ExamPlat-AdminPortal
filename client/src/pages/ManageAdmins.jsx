import { useEffect, useState } from "react";
import api from "../api/axios";

export default function ManageAdmins() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => api.get("/admins").then(({ data }) => setAdmins(data));

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api.post("/admins", form);
      setForm({ name: "", email: "", password: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create admin");
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id) => {
    setActionError("");
    try {
      await api.put(`/admins/${id}/disable`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || "Could not update this admin account");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Manage Admins</h1>
        <p className="text-sm text-slate-500">Only the Super Admin can create or disable Admin accounts (Section 3).</p>
      </div>

      <div className="card p-6">
        <h2 className="font-medium text-slate-800 mb-4">Create Admin</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-3 gap-4 items-end">
          {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Initial Password</label>
            <input type="password" minLength={8} required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="col-span-3">
            <button type="submit" disabled={creating} className="btn-primary">{creating ? "Creating…" : "Create Admin"}</button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        {actionError && <p className="m-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Role</th>
              <th className="text-left px-5 py-3">Created</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="text-left px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {admins.map((a) => (
              <tr key={a._id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{a.email}</td>
                <td className="px-5 py-3 capitalize text-slate-600">{a.role === "superadmin" ? "Super Admin" : "Admin"}</td>
                <td className="px-5 py-3 text-slate-600">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${a.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {a.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {a.role !== "superadmin" && (
                    <button onClick={() => handleToggle(a._id)} className="text-xs text-brand-600 hover:underline">
                      {a.active ? "Disable" : "Enable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
