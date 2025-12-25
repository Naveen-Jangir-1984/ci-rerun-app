import { useState } from "react";
import { updatePassword } from "../api";

export default function Password() {
  const session = JSON.parse(localStorage.getItem("session")!);

  const [password, setPassword] = useState({
    current: "",
    password: "",
    confirm: ""
  });

  function cancel() {
    window.history.back();
  }

  async function save() {
    if( password.password !== password.confirm ) {
      alert("New and Confirm Passwords do not match");
      return;
    }
    await updatePassword({
      userId: session.userId,
      current: password.current,
      password: password.password
    });

    alert("Password updated");
    setPassword({ current: "", password: "", confirm: "" });
    cancel();
  }

  const isUpdateDisabled = !password.current || !password.password || !password.confirm;

  return (
    <>
      <input placeholder="Current" onChange={e => setPassword({ ...password, current: e.target.value })} />
      <input placeholder="New" onChange={e => setPassword({ ...password, password: e.target.value })} />
      <input placeholder="Confirm" onChange={e => setPassword({ ...password, confirm: e.target.value })} />

      <button onClick={cancel}>Cancel</button>
      <button disabled={isUpdateDisabled} onClick={save}>Update</button>
    </>
  );
}
