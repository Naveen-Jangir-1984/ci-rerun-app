import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState<any>({ ...user });

  function save() {
    updateProfile(form);
    alert("Updated");
  }

  return (
    <>
      <h3>Settings</h3>
      <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
      <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
      <input placeholder="New Password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <input placeholder="Azure PAT" onChange={(e) => setForm({ ...form, pat: e.target.value })} />
      <button onClick={save}>Save</button>
    </>
  );
}
