const api = import.meta.env.VITE_SERVER_URL;

export const getTeams = async () => await fetch(`${api}/teams`).then((r) => r.json());

export const getUsersByTeam = async (team: string) => await fetch(`${api}/users?team=${encodeURIComponent(team)}`).then((r) => r.json());

export const registerUser = async (data: { team: string; username: string; firstName: string; lastName: string; password: string }) => {
  const res = await fetch(`${api}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
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
  const res = await fetch(`${api}/user/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
};

export const updatePassword = async (payload: { userId: string; current: string; password: string }) => {
  const res = await fetch(`${api}/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const getBuilds = async (user: any, projectId: string, range: string) => {
  const res = await fetch(`${api}/builds?project=${projectId}&range=${range}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, projectId }),
  });
  return res.json();
};

export const getTests = async (user: any, projectId: string, buildId: number) => {
  const res = await fetch(`http://localhost:4000/getTests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, projectId, buildId }),
  });
  return res.json();
};

export const rerun = async (tests: any[], mode: string, env: string) => {
  return await fetch(`http://localhost:4000/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tests, mode, env }),
  }).then((r) => r.json());
};

export const downloadFailures = async (buildId: number, tests: any) => {
  const res = await fetch(`http://localhost:4000/downloadFailures`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildId, tests }),
  });
  return res.blob();
};

export const downloadResults = async (results: any) => {
  const res = await fetch(`http://localhost:4000/downloadResults`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results }),
  });
  return res.blob();
};
