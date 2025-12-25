import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getTeams, getUsersByTeam } from "../api";

export default function SignIn() {
  const { login } = useAuth();
  const [teams, setTeams] = useState<string[]>([]);
  const nav = useNavigate();
  const [f, setF] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    getTeams().then(setTeams);
  }, []);

  useEffect(() => {
    if (!f.team) {
      setUsers([]);
      setF({ ...f, username: "" });
      return;
    }

    getUsersByTeam(f.team).then(setUsers);
  }, [f.team]);

  function submit() {
    const ok = login(f.team, f.username, f.password);
    if (!ok) alert("Invalid credentials");
    else nav("/dashboard");
  }

  const isSubmitDisabled = !f.team || !f.username || !f.password;

  return (
    <>
      <h2>Sign In</h2>
      <select onChange={e => setF({ ...f, team: e.target.value })}>
        <option>Select Team</option>
        {teams.map(t => <option key={t}>{t}</option>)}
      </select>
      <select
        value={f.username}
        onChange={e => setF({ ...f, username: e.target.value })}
        disabled={!f.team}
      >
        <option value="">-- Select User --</option>
        {users.map(u => (
          <option key={u.id} value={u.username}>
            {u.username}
          </option>
        ))}
      </select>
      <input type="password" disabled={!f.username} placeholder="Password" onChange={e => setF({ ...f, password: e.target.value })} />
      <button disabled={isSubmitDisabled} style={{ cursor: isSubmitDisabled ? "not-allowed" : "pointer" }} onClick={submit}>Login</button>
    </>
  );
}
