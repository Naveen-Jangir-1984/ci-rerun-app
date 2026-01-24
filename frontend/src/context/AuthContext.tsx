import { createContext, useContext, useState } from "react";
import { loginUser, registerUser, updateUser } from "../api";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem("user") || "null"));

  async function register(data: any) {
    return await registerUser(data);
  }

  async function login(team: string, username: string, password: string) {
    const res = await loginUser({ team, username, password });
    if (res.status === 200) {
      setUser({ ...res.data });
      sessionStorage.setItem("user", JSON.stringify({ ...res.data }));
    }
    return res;
  }

  async function update(data: any) {
    const res = await updateUser(user.id, data);
    if (res.status === 200) {
      setUser(res.data);
      sessionStorage.setItem("user", JSON.stringify({ ...res.data }));
    }
    return res;
  }

  function logout() {
    setUser(null);
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("projects");
    sessionStorage.removeItem("project");
    sessionStorage.removeItem("range");
    sessionStorage.removeItem("builds");
    sessionStorage.removeItem("build");
    sessionStorage.removeItem("summary");
    sessionStorage.removeItem("tests");
    sessionStorage.removeItem("test");
    sessionStorage.removeItem("runAll");
    sessionStorage.removeItem("env");
    sessionStorage.removeItem("result");
  }

  return <AuthContext.Provider value={{ user, login, register, update, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
