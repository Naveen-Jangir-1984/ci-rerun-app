import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "../api";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, reflectUserChanges } = useAuth();
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
    const res = await updateProfile({
      userId: user.id,
      firstName,
      lastName,
      pat: pat || undefined, // only update if entered
    });
    reflectUserChanges(res.data);
    setMessage("Profile updated successfully");
    setPat("");
    setTimeout(() => cancel(), 2000);
  }

  return (
    <div className="profile">
      <h3>Update Profile</h3>
      <input type="text" value={firstName} placeholder="Firstname" onChange={(e) => setFirstName(e.target.value)} />
      <input type="text" value={lastName} placeholder="Lastname" onChange={(e) => setLastName(e.target.value)} />
      <input type="password" placeholder={hasPAT ? "Enter a new PAT" : "Enter PAT"} value={pat} onChange={(e) => setPat(e.target.value)} />
      <div className="user-actions">
        <button className="medium-button" onClick={cancel}>
          Cancel
        </button>
        <button className="medium-button" onClick={save}>
          Update
        </button>
      </div>
      <div style={{ color: "green" }}>{message}</div>
    </div>
  );
}
