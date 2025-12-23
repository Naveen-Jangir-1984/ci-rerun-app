import { useEffect, useState } from 'react';
import { getBuilds, rerun } from './api';

export default function App() {
  const [builds, setBuilds] = useState<any[]>([]);
  const [log, setLog] = useState('');

  useEffect(() => {
    getBuilds().then(setBuilds);
  }, []);

  async function handle(buildId: number) {
    const r = await rerun(buildId);
    setLog(r.logs || r.status);
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>CI Rerun Failed Tests</h2>
      {builds.map(b => (
        <button key={b.id} onClick={() => handle(b.id)}>
          Rerun Build #{b.id}
        </button>
      ))}
      <pre>{log}</pre>
    </div>
  );
}
