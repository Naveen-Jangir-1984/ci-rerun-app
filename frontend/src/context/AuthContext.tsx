import { createContext, useContext, useState } from "react";
import { loginUser, registerUser, updateUser } from "../api";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  const reflectUserChanges = (updatedUser: any) => {
    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  async function register(data: any) {
    return await registerUser(data);
  }

  async function login(team: string, username: string, password: string) {
    const res = await loginUser({ team, username, password });
    if (res.status === 200) {
      setUser({ ...res.data, result: [] });
      localStorage.setItem("user", JSON.stringify({ ...res.data, result: [] }));
    }
    return res;
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

  return <AuthContext.Provider value={{ user, login, register, reflectUserChanges, updateProfile, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
