import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getTeams, getUsersByTeam } from "../api";

export default function SignIn() {
  const { login } = useAuth();
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const nav = useNavigate();
  const [form, setForm] = useState<any>({ team: "", username: "", password: "" });
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  useEffect(() => {
    if (!form.team) {
      setUsers([]);
      return;
    }

    getUsersByTeam(form.team).then(setUsers);
  }, [form.team]);

  async function submit() {
    const res = await login(form.team, form.username, form.password);
    if (res.status === 401) setMessage(res.error);
    else nav("/dashboard");
  }

  function reset() {
    setForm({ team: "", username: "", password: "" });
    setUsers([]);
    setMessage("");
  }

  const isSubmitDisabled = !form.team || !form.username || !form.password;
  const isResetDisabled = !form.team && !form.username && !form.password;

  return (
    <div className="login">
      <h2>Sign In</h2>
      <select onChange={(e) => setForm({ ...form, team: e.target.value })} value={form.team}>
        <option value="">-- Select Team --</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <select value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!form.team}>
        <option value="">-- Select User --</option>
        {users.map((u) => (
          <option key={u.id} value={u.username}>
            {u.username}
          </option>
        ))}
      </select>
      <input type="password" value={form.password} disabled={!form.username} placeholder="Password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <div className="user-actions">
        <button className="button medium-button" disabled={isResetDisabled} onClick={reset}>
          Reset
        </button>
        <button className="button medium-button" disabled={isSubmitDisabled} onClick={submit}>
          Submit
        </button>
      </div>
      <div style={{ fontSize: "0.9rem", color: "red" }}>{message}</div>
    </div>
  );
}
