export async function getBuilds() {
  return fetch('http://localhost:3001/builds').then(r => r.json());
}

export async function rerun(buildId: number) {
  await fetch(`http://localhost:3001/download/${buildId}`, { method: 'POST' });
  return fetch('http://localhost:4000/rerun', { method: 'POST' })
    .then(r => r.json());
}