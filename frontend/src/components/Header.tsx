import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span>
        Welcome, <b>{`${user.firstName} ${user.lastName}`}</b>
      </span>

      {/* Settings */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen(!open)}>⚙ Settings ▾</button>

        {open && (
          <div style={{ position: "absolute", right: 0, background: "#fff", border: "1px solid #ccc", padding: 8, minWidth: 160, zIndex: 1 }}>
            <div style={{ padding: 6, cursor: "pointer" }} onClick={() => navigate("/changeProfile")}>
              Update Profile
            </div>
            <div style={{ padding: 6, cursor: "pointer" }} onClick={() => navigate("/changePassword")}>
              Change Password
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button onClick={logout} style={{ color: "red" }}>
        Logout
      </button>
    </header>
  );
}
