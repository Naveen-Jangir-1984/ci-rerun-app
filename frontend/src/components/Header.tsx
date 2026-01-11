import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>
        Welcome, <b>{`${user.firstName} ${user.lastName}`}</b>
      </span>

      {/* Settings */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ position: "relative" }}>
          <button className="medium-button" onClick={() => setOpen(!open)}>
            Settings
          </button>

          {open && (
            <div style={{ position: "absolute", right: 0, background: "#fff", border: "1px solid #ccc", padding: 10, minWidth: 160, zIndex: 1 }}>
              <div style={{ padding: 5, cursor: "pointer" }} onClick={() => navigate("/changeProfile")}>
                Update Profile
              </div>
              <div style={{ padding: 5, cursor: "pointer" }} onClick={() => navigate("/changePassword")}>
                Change Password
              </div>
            </div>
          )}
        </span>
        {/* Logout */}
        <button className="medium-button" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}
