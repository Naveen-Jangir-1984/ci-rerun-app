import { createContext, useContext, useState } from "react";
import { loginUser, registerUser, updateUser } from "../api";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  async function register(data: any) {
    return await registerUser(data);
  }

  async function login(team: string, username: string, password: string) {
    const res = await loginUser({ team, username, password });
    if (res.status === 200) {
      setUser({ ...res.data });
      localStorage.setItem("user", JSON.stringify({ ...res.data }));
    }
    return res;
  }

  async function update(data: any) {
    const res = await updateUser(user.id, data);
    if (res.status === 200) {
      setUser(res.data);
      localStorage.setItem("user", JSON.stringify({ ...res.data }));
    }
    return res;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("projects");
    localStorage.removeItem("project");
    localStorage.removeItem("range");
    localStorage.removeItem("builds");
    localStorage.removeItem("build");
    localStorage.removeItem("summary");
    localStorage.removeItem("tests");
    localStorage.removeItem("test");
    localStorage.removeItem("runAll");
    localStorage.removeItem("env");
    localStorage.removeItem("result");
  }

  return <AuthContext.Provider value={{ user, login, register, update, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
