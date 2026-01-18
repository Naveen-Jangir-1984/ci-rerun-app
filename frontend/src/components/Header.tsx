import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="header">
      <div className="user-name">{`${user.firstName} ${user.lastName}`}</div>

      <div className="update-user-info">
        {/* Settings */}
        <span style={{ position: "relative" }}>
          <button className="medium-button" onClick={() => setOpen(!open)}>
            Settings
          </button>

          {open && (
            <div className="user-settings">
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
        <button className="medium-button danger" onClick={logout}>
          Sign Out
        </button>
      </div>
    </header>
  );
}
