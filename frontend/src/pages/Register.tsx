import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getTeams } from "../api";

export default function Register() {
  const { register } = useAuth();
  const [teams, setTeams] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  const [form, setForm] = useState<any>({
    team: "",
    username: "",
    firstName: "",
    lastName: "",
    password: "",
    confirm: "",
  });

  async function submit() {
    if (form.password !== form.confirm) return alert("Passwords mismatch");
    const res = await register({
      team: form.team,
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      password: form.password,
    });
    if (res.status === 409) {
      setMessage(res.error);
    } else {
      setMessage("Registered successfully");
      setForm({
        team: "",
        username: "",
        firstName: "",
        lastName: "",
        password: "",
        confirm: "",
      });
    }
  }

  return (
    <>
      <h2>Sign Up</h2>
      <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
        <option>Select Team</option>
        {teams.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
      <input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
      <input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
      <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <input type="password" placeholder="Confirm Password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      <button disabled={!form.team || !form.username || !form.firstName || !form.lastName || !form.password || !form.confirm} onClick={submit}>
        Register
      </button>
      <div style={{ marginTop: 20, color: message === "Registered successfully" ? "green" : "red" }}>{message}</div>
    </>
  );
}
