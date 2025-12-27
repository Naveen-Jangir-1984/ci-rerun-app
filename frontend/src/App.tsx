import type { JSX } from "react";
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
              <p>
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
              <p>
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
        path="/changeProfile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Change Password */}
      <Route
        path="/changePassword"
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
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
