const url = import.meta.env.VITE_SERVER_URL;

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