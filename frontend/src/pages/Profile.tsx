import { useEffect, useState } from "react";
import { getProfile } from "../api";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, update } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pat, setPat] = useState("");
  const [hasPAT, setHasPAT] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getProfile(user.id).then((data) => {
      setFirstName(data.firstName || "");
      setLastName(data.lastName || "");
      setHasPAT(data.hasPAT);
    });
  }, []);

  function cancel() {
    window.history.back();
  }

  async function save() {
    const res = await update({
      firstName,
      lastName,
      pat: pat || undefined, // only update if entered
    });
    if (res.status === 200) {
      setMessage("Updated ! Please wait...");
      setPat("");
      setTimeout(() => cancel(), 1000);
    } else {
      setMessage(res.error);
    }
  }

  return (
    <div className="profile">
      <h3>Update Profile</h3>
      <input type="text" value={firstName} placeholder="Firstname" onChange={(e) => setFirstName(e.target.value)} />
      <input type="text" value={lastName} placeholder="Lastname" onChange={(e) => setLastName(e.target.value)} />
      <input type="password" placeholder={hasPAT ? "Enter a new PAT" : "Enter PAT"} value={pat} onChange={(e) => setPat(e.target.value)} />
      <div className="user-actions">
        <button className="button medium-button" onClick={cancel}>
          Cancel
        </button>
        <button className="button medium-button" onClick={save}>
          Update
        </button>
      </div>
      <div style={{ color: message === "Updated ! Please wait..." ? "green" : "red" }}>{message}</div>
    </div>
  );
}
