import { useEffect, useState } from 'react';
import { getBuilds, rerun } from './api';

export default function App() {
  const [builds, setBuilds] = useState<any[]>([]);
  const [build, setBuild] = useState<number | null>(null);
  const [log, setLog] = useState('');

  useEffect(() => {
    getBuilds().then(setBuilds);
  }, []);

  async function handle(buildId: number) {
    const r = await rerun(buildId);
    console.log(r);
    setLog(r.logs || r.status);
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>CI Rerun Failed Tests</h2>
      <select onChange={e => setBuild(Number(e.target.value))} defaultValue="">
        <option value="" disabled>-- select --</option>
        {builds.map(b => (
          <option key={b.id} value={b.id}>Build #{b.id} - {b.result}</option>
        ))}
      </select>
      <button disabled={build === null} onClick={() => handle(build!)}>Rerun Failed Tests</button>
      <pre>{log}</pre>
    </div>
  );
}
