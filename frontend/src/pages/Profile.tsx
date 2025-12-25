import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "../api";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, reflectUserChanges } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pat, setPat] = useState("");
  const [hasPAT, setHasPAT] = useState(false);

  useEffect(() => {
    getProfile(user.id).then(data => {
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
      pat: pat || undefined // only update if entered
    });
    reflectUserChanges(res.user);
    alert("Profile updated");
    setPat("");
    cancel();
  }

  return (
    <>
      <input value={firstName} placeholder="Firstname" onChange={e => setFirstName(e.target.value)} />
      <input value={lastName} placeholder="Lastname" onChange={e => setLastName(e.target.value)} />
      <input
        type="password"
        placeholder={hasPAT ? "PAT already set" : "Enter PAT"}
        value={pat}
        onChange={e => setPat(e.target.value)}
      />
      <button onClick={cancel}>Cancel</button>
      <button onClick={save}>Update</button>
    </>
  );
}
