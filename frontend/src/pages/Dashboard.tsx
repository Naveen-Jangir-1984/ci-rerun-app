import { useEffect, useState } from "react";
import { getProjects, getBuilds, rerun } from "../api";
import { useAuth } from "../context/AuthContext";
import Settings from "./Settings";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const hasPAT = !!user?.pat;
    const [projects, setProjects] = useState<any[]>([]);
    const [project, setProject] = useState<string | null>(null);
  
    const [builds, setBuilds] = useState<any[]>([]);
    const [build, setBuild] = useState<number | null>(null);
  
    const [log, setLog] = useState("");
  
    /* Load projects on page load */
    useEffect(() => {
      getProjects(user).then(setProjects);
    }, []);
  
    /* Load builds when project changes */
    useEffect(() => {
      if (!project) return;
      setBuild(null);
      setBuilds([]);
      getBuilds(user, project).then(setBuilds);
    }, [project]);
  
    async function handleRerun() {
      if (!project || !build) return;
      const r = await rerun(user.username, project, build);
      setLog(r.logs || r.status);
    }

  return (
    <>
      <h2>Dashboard</h2>
      <p>Welcome {user?.firstName}</p>
      <button onClick={logout}>Logout</button>
      <h2>CI Rerun Failed Tests</h2>

      {/* Project selector */}
      <div>
        <select
          onChange={(e) => setProject(e.target.value)}
          defaultValue=""
        >
          <option value="">-- select project --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Build selector */}
      {project && (
        <div style={{ marginTop: 10 }}>
          <select
            onChange={(e) => setBuild(Number(e.target.value))}
            defaultValue=""
          >
            <option value="">-- select build --</option>
            {builds.map((b) => (
              <option key={b.buildId} style={{display: b.status === "completed" && b.result === "succeeded" ? "none" : "block"}} value={b.buildId}>
                {b.pipelineName} (#{b.buildId})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rerun button */}
      <div style={{ marginTop: 10 }}>
        <button disabled={!project || !build} onClick={handleRerun}>
          Rerun Failed Tests
        </button>
      </div>

      <pre style={{ marginTop: 20 }}>{log}</pre>

      {!hasPAT && <p style={{ color: "red" }}>Add PAT in Settings to enable projects</p>}

      <Settings />
    </>
  );
}
