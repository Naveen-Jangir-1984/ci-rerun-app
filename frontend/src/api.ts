const url = import.meta.env.VITE_SERVER_URL;

export const getTeams = async () =>
  fetch(`${url}/teams`).then(r => r.json());

export const getUsersByTeam = async (team: string) =>
  fetch(`${url}/users?team=${encodeURIComponent(team)}`)
    .then(r => r.json());

export const updateProfile = async (payload: {
  userId: string;
  firstName?: string;
  lastName?: string;
  pat?: string;
}) =>
  fetch(`${url}/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(r => {
    if (!r.ok) throw new Error("Profile update failed");
    return r.json();
  });

export const updatePassword = async (payload: {
  userId: string;
  current: string;
  password: string;
}) =>
  fetch(`${url}/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(r => {
    if (!r.ok) throw new Error("Password update failed");
    return r.json();
  });

export const getProfile = async (userId: string) =>
  fetch(`${url}/profile/${userId}`).then(r => r.json());

export const getProjects = async (user: any) =>
  fetch(`${url}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user })
  }).then(r => r.json());

export const getBuilds = async (user: any, projectId: string) =>
  fetch(`${url}/builds?project=${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, projectId })
  }).then(r => r.json());

export const rerun = async (user: any, projectId: string, buildId: number) =>
  fetch(`http://localhost:4000/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, projectId, buildId })
  }).then(r => r.json());