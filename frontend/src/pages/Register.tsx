import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getTeams } from "../api";

export default function Register() {
  const { register } = useAuth();
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState<{ color: string; text: string }>({
    color: "",
    text: "",
  });

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

  function reset() {
    setForm({
      team: "",
      username: "",
      firstName: "",
      lastName: "",
      password: "",
      confirm: "",
    });
    setMessage({ color: "", text: "" });
  }

  async function submit() {
    if (form.password !== form.confirm) {
      setMessage({ color: "red", text: "Password and Confirm Passwords do not match" });
      return;
    }
    const res = await register({
      team: form.team,
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      password: form.password,
    });
    if (res.status === 409) {
      setMessage({ color: "red", text: res.error });
    } else {
      setMessage({ color: "green", text: "Registered successfully" });
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

  const isResetDisabled = !form.team && !form.username && !form.firstName && !form.lastName && !form.password && !form.confirm;
  const isSubmitDisabled = !form.team || !form.username || !form.firstName || !form.lastName || !form.password || !form.confirm;

  return (
    <div className="register">
      <h2>Sign Up</h2>
      <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
        <option>Select Team</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input type="text" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
      <input type="text" placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
      <input type="text" placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
      <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <input type="password" placeholder="Confirm" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      <div className="user-actions">
        <button className="button medium-button" disabled={isResetDisabled} onClick={reset}>
          Reset
        </button>
        <button className="button medium-button" disabled={isSubmitDisabled} onClick={submit}>
          Submit
        </button>
      </div>
      <div style={{ fontSize: "0.9rem", color: message.color }}>{message.text}</div>
    </div>
  );
}
