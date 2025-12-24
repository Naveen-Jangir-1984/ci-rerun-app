import { createContext, useContext, useState } from "react";
import { loginUser, registerUser, updateUser } from "../api/auth";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

  async function register(data: any) {
    await registerUser(data);
  }
  
  async function login(team: string, username: string, password: string) {
  const user = await loginUser({ team, username, password });
  setUser(user);
  localStorage.setItem("user", JSON.stringify(user));
}

async function updateProfile(data: any) {
  const updated = await updateUser(user.id, data);
  setUser(updated);
  localStorage.setItem("user", JSON.stringify(updated));
}

  function logout() {
    setUser(null);
    localStorage.removeItem("user");
  }

  return (
    <AuthContext.Provider value={{ user, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
