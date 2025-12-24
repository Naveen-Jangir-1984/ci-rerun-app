import { useState } from "react";
import { loadDB } from "../../../backend/db/database";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const { teams } = loadDB();
  const nav = useNavigate();
  const [f, setF] = useState<any>({});

  function submit() {
    const ok = login(f.team, f.username, f.password);
    if (!ok) alert("Invalid credentials");
    else nav("/dashboard");
  }

  return (
    <>
      <h2>Login</h2>
      <select onChange={e => setF({ ...f, team: e.target.value })}>
        <option>Select Team</option>
        {teams.map(t => <option key={t}>{t}</option>)}
      </select>
      <input placeholder="Username" onChange={e => setF({ ...f, username: e.target.value })} />
      <input type="password" placeholder="Password" onChange={e => setF({ ...f, password: e.target.value })} />
      <button disabled={!f.team || !f.username || !f.password} onClick={submit}>Login</button>
    </>
  );
}
