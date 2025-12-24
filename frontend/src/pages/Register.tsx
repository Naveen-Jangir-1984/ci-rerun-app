import { useState } from "react";
import { loadDB } from "../../../backend/db/database";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const { teams } = loadDB();

  const [form, setForm] = useState<any>({});

  function submit() {
    if (form.password !== form.confirm) return alert("Passwords mismatch");
    const ok = register({
      team: form.team,
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      password: form.password,
    });
    if (!ok) alert("User already exists");
    else alert("Registered successfully");
  }

  return (
    <>
      <h2>Register</h2>
      <select onChange={e => setForm({ ...form, team: e.target.value })}>
        <option>Select Team</option>
        {teams.map(t => <option key={t}>{t}</option>)}
      </select>
      <input placeholder="Username" onChange={e => setForm({ ...form, username: e.target.value })} />
      <input placeholder="First Name" onChange={e => setForm({ ...form, firstName: e.target.value })} />
      <input placeholder="Last Name" onChange={e => setForm({ ...form, lastName: e.target.value })} />
      <input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />
      <input type="password" placeholder="Confirm Password" onChange={e => setForm({ ...form, confirm: e.target.value })} />
      <button disabled={!form.team || !form.username || !form.firstName || !form.lastName || !form.password || !form.confirm} onClick={submit}>Register</button>
    </>
  );
}
