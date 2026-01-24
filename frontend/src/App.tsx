import { useEffect, useState, type JSX } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Password from "./pages/Password";

import "./App.css";

/* ---------------------------
   Route Protection
---------------------------- */
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

/* ---------------------------
   Public Layout (Login/Register)
---------------------------- */
function PublicLayout({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

/* ---------------------------
   App Routes
---------------------------- */
function AppRoutes() {
  return (
    <Routes>
      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Login */}
      <Route
        path="/login"
        element={
          <PublicLayout>
            <>
              <Login />
              <p style={{ width: "380px", textAlign: "right" }}>
                New user? <Link to="/register">Sign Up</Link>
              </p>
            </>
          </PublicLayout>
        }
      />

      {/* Register */}
      <Route
        path="/register"
        element={
          <PublicLayout>
            <>
              <Register />
              <p style={{ width: "380px", textAlign: "right" }}>
                Already registered? <Link to="/login">Sign In</Link>
              </p>
            </>
          </PublicLayout>
        }
      />

      {/* Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Change Profile */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Change Password */}
      <Route
        path="/password"
        element={
          <ProtectedRoute>
            <Password />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

/* ---------------------------
   Root App
---------------------------- */
export default function App() {
  const [loading, setLoading] = useState({ status: true, message: "Please wait..." });

  useEffect(() => {
    const getHealth = async () => {
      let hostServerDown = false;
      let clientServerDown = false;
      try {
        const hostServer = await fetch(`${import.meta.env.VITE_SERVER_URL}/health`);
        const hostServerStatus = await hostServer.json();
        if (hostServerStatus.status !== "OK") {
          hostServerDown = true;
        }
      } catch {
        hostServerDown = true;
      }
      try {
        const localServer = await fetch(`http://localhost:4000/health`);
        const localServerStatus = await localServer.json();
        if (localServerStatus.status !== "OK") {
          clientServerDown = true;
        }
      } catch {
        clientServerDown = true;
      }
      if (hostServerDown && clientServerDown) {
        setLoading({ status: true, message: "Both servers are down. Please try again later." });
      } else if (hostServerDown) {
        setLoading({ status: true, message: "Host server is down. Please contact Naveen Jangir." });
      } else if (clientServerDown) {
        setLoading({ status: true, message: "Local server is down. Please ensure it is running." });
      } else {
        setLoading({ status: false, message: "" });
      }
    };
    getHealth();
  }, []);

  // console.log(loading);

  return (
    <div className="app">
      {loading.status ? (
        <div className="loading">{loading.message}</div>
      ) : (
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      )}
    </div>
  );
}
