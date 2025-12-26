import { useEffect, useState } from "react";
import { getProjects, getBuilds, rerun } from "../api";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";

const TIME_RANGES = [
  { label: "Yesterday", value: "yesterday" },
  { label: "Current Week", value: "current_week" },
  { label: "Last Week", value: "last_week" },
  { label: "Current Month", value: "current_month" },
  { label: "Last Month", value: "last_month" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [project, setProject] = useState<string>("");

  const [builds, setBuilds] = useState<any[]>([]);
  const [range, setRange] = useState("");
  const [build, setBuild] = useState<number>(0);

  const [message, setMessage] = useState("");
  const hasPAT = !!user?.pat;

  /* Load projects on page load */
  useEffect(() => {
    const projects = async (user: any) => {
      const res = await getProjects(user);
      if (res.status === 200) {
        setProjects(res.data);
      } else {
        setProjects([]);
      }
    };
    projects(user);
  }, []);

  /* Load builds when project changes */
  useEffect(() => {
    if (!project) return;
    setBuild(0);
    setBuilds([]);
    getBuilds(user, project, range).then(setBuilds);
    setMessage("");
  }, [project, range]);

  async function handleProjectChange(value: string) {
    setMessage("");
    if (!value) {
      setProject("");
      setRange("");
      setBuilds([]);
      setBuild(0);
      return;
    }
    setProject(value);
  }

  async function handleRangeChange(value: string) {
    setMessage("");
    if (!value) {
      setRange("");
      setBuilds([]);
      setBuild(0);
      return;
    }
    setRange(value);
  }

  async function handleBuildChange(value: string) {
    setMessage("");
    if (!value) {
      setBuild(0);
      return;
    }
    setBuild(Number(value));
  }

  async function handleRerun(mode: string) {
    const res = await rerun(user, project, build, mode);
    if (res.status === 200) {
      setMessage(res.data);
    } else {
      setMessage(res.error);
    }
  }

  return (
    <>
      <Header />

      {/* Project selector */}
      <div>
        <select disabled={projects.length === 0} onChange={(e) => handleProjectChange(e.target.value)} value={project}>
          <option value="">-- select project --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Time filter */}
      <div style={{ marginTop: 10 }}>
        <select value={range} disabled={!project} onChange={(e) => handleRangeChange(e.target.value)}>
          <option value="">-- select range --</option>
          {TIME_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Build selector */}
      <div style={{ marginTop: 10 }}>
        <select value={build} disabled={builds.length === 0} onChange={(e) => handleBuildChange(e.target.value)}>
          <option value={0}>-- select build --</option>
          {builds.map((b) => (
            <option key={b.buildId} style={{ display: b.status === "completed" && b.result === "succeeded" ? "none" : "block" }} value={b.buildId}>
              {b.pipelineName} (#{b.buildId})
            </option>
          ))}
        </select>
      </div>

      {/* Rerun button */}
      <div style={{ marginTop: 10 }}>
        <button disabled={!project || !range || !build} onClick={() => handleRerun("rerun")}>
          Rerun Failed Tests
        </button>
        <button disabled={!project || !range || !build} onClick={() => handleRerun("debug")}>
          Debug Failed Tests
        </button>
      </div>

      <div style={{ marginTop: 20, color: message.includes("junit-xml") ? "red" : "green" }}>{message}</div>

      {!hasPAT && <p style={{ color: "red" }}>Add PAT in Settings to enable projects</p>}
    </>
  );
}
