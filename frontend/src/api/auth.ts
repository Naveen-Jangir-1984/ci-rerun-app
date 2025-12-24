const API = import.meta.env.VITE_SERVER_URL;

export const getTeams = async () => {
  const r = await fetch(`${API}/teams`);
  return r.json();
};

export const registerUser = async (data: {
  team: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}) => {
  const r = await fetch(`${API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error("Registration failed");
};

export const loginUser = async (data: {
  team: string;
  username: string;
  password: string;
}) => {
  const r = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error("Login failed");
  return r.json();
};

export const updateUser = async (id: string, data: any) => {
  const r = await fetch(`${API}/user/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error("Update failed");
  return r.json();
};
