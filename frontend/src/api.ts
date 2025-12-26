const api = import.meta.env.VITE_SERVER_URL;

export const getTeams = async () => await fetch(`${api}/teams`).then((r) => r.json());

export const getUsersByTeam = async (team: string) => await fetch(`${api}/users?team=${encodeURIComponent(team)}`).then((r) => r.json());

export const registerUser = async (data: { team: string; username: string; firstName: string; lastName: string; password: string }) => {
  const r = await fetch(`${api}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("User already exists");
  return r.json();
};

export const loginUser = async (data: { team: string; username: string; password: string }) => {
  const res = await fetch(`${api}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const getProfile = async (userId: string) => await fetch(`${api}/profile/${userId}`).then((r) => r.json());

export const getProjects = async (user: any) => {
  const res = await fetch(`${api}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
  return res.json();
};

export const updateProfile = async (payload: { userId: string; firstName?: string; lastName?: string; pat?: string }) => {
  const res = await fetch(`${api}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const updateUser = async (id: string, data: any) => {
  const r = await fetch(`${api}/user/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Update failed");
  return r.json();
};

export const updatePassword = async (payload: { userId: string; current: string; password: string }) => {
  const res = await fetch(`${api}/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const getBuilds = async (user: any, projectId: string, range: string) =>
  await fetch(`${api}/builds?project=${projectId}&range=${range}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, projectId }),
  }).then((r) => r.json());

export const rerun = async (user: any, projectId: string, buildId: number, mode: string) => {
  const res = await fetch(`${api}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, projectId, buildId }),
  });
  const data = await res.json();
  if (data.status === 404) {
    return data;
  } else {
    return await fetch(`http://localhost:4000/rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, buildId, mode }),
    }).then((r) => r.json());
  }
};
