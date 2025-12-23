const url = import.meta.env.VITE_SERVER_URL;

export async function getBuilds() {
  return fetch(`${url}/builds`).then(r => r.json());
}

export async function rerun(buildId: number) {
  await fetch(`${url}/download/${buildId}`, { method: 'POST' });
  return fetch('http://localhost:4000/rerun', { method: 'POST' })
    .then(r => r.json());
}