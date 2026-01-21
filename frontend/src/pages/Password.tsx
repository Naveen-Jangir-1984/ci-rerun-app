import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Password() {
  const { update } = useAuth();
  const [password, setPassword] = useState({
    current: "",
    password: "",
    confirm: "",
  });
  const [message, setMessage] = useState("");

  function cancel() {
    window.history.back();
  }

  async function save() {
    if (password.password !== password.confirm) {
      setMessage("New and Confirm Passwords do not match");
      return;
    }
    const res = await update({
      current: password.current,
      password: password.password,
    });
    if (res.status === 200) {
      setMessage("Updated ! Please wait...");
      setPassword({ current: "", password: "", confirm: "" });
      setTimeout(() => cancel(), 1000);
    } else {
      setMessage(res.error);
    }
  }

  const isUpdateDisabled = !password.current || !password.password || !password.confirm;

  return (
    <div className="password">
      <h3>Update Password</h3>
      <input type="password" placeholder="Current" onChange={(e) => setPassword({ ...password, current: e.target.value })} />
      <input type="password" placeholder="New" onChange={(e) => setPassword({ ...password, password: e.target.value })} />
      <input type="password" placeholder="Confirm" onChange={(e) => setPassword({ ...password, confirm: e.target.value })} />
      <div className="user-actions">
        <button className="button medium-button" onClick={cancel}>
          Cancel
        </button>
        <button className="button medium-button" disabled={isUpdateDisabled} onClick={save}>
          Update
        </button>
      </div>
      <div style={{ color: message === "Updated ! Please wait..." ? "green" : "red" }}>{message}</div>
    </div>
  );
}
