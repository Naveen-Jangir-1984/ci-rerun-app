import { useEffect, useState } from "react";
import { getProjects, getBuilds, getTests, rerun } from "../api";
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
  const [runAll, setRunAll] = useState<boolean>(true);

  const [tests, setTests] = useState<any[]>([]);
  const [test, setTest] = useState<number>(0);

  const [message, setMessage] = useState("");
  const hasPAT = !!user?.pat;

  const [spinner, setSpinner] = useState(false);

  /* Load projects on page load */
  useEffect(() => {
    const projects = async (user: any) => {
      setSpinner(true);
      const res = await getProjects(user);
      if (res.status === 200) {
        setProjects(res.data);
      } else {
        setProjects([]);
      }
      setSpinner(false);
    };
    projects(user);
  }, [project]);

  /* Load builds when project changes */
  // useEffect(() => {
  //   if (!project) return;
  //   setBuild(0);
  //   setBuilds([]);
  //   setSpinner(true);
  //   setTests([]);
  //   setTest(0);
  //   setRunAll(true);
  //   setMessage("");
  //   setSpinner(false);
  // }, [project, range]);

  async function handleProjectChange(value: string) {
    setMessage("");
    if (!value) {
      setProject("");
      setRange("");
      setBuilds([]);
      setBuild(0);
      setTests([]);
      setTest(0);
      setRunAll(true);
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
      setTests([]);
      setTest(0);
      setRunAll(true);
      return;
    }
    setSpinner(true);
    setRange(value);
    const res = await getBuilds(user, project, value);
    setBuilds(res.data);
    setSpinner(false);
  }

  async function handleBuildChange(value: string) {
    setMessage("");
    if (!Number(value)) {
      setBuild(0);
      setTests([]);
      setTest(0);
      setRunAll(true);
      return;
    }
    setBuild(Number(value));
    setSpinner(true);
    const res = await getTests(user, project, Number(value));
    setTests(res.data);
    setSpinner(false);
  }

  async function handleRunAllChange() {
    if (!runAll) {
      setTest(0);
    }
    setRunAll(!runAll);
  }

  async function handleRerun(mode: string) {
    setSpinner(true);
    const res = await rerun(runAll ? tests : (tests.filter((t) => t.id === test) as any[]), mode);
    if (res.status === 200) {
      setMessage(res.data);
    } else {
      setMessage(res.error);
    }
    setSpinner(false);
  }

  return (
    <>
      <Header />

      {/* Project selector */}
      <div style={{ marginTop: 10 }}>
        <select disabled={projects.length === 0} onChange={(e) => handleProjectChange(e.target.value)} value={project}>
          <option value="">-- select project --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Range filter */}
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
        {tests.length > 0 ? (
          <>
            <input id="runall" type="checkbox" disabled={builds.length === 0} checked={runAll} onChange={handleRunAllChange} />
            <label htmlFor="runall">Run All Tests</label>
          </>
        ) : project && range && build ? (
          <div style={{ marginTop: 10, color: "red" }}>Either there is no artifact found or there were no failures.</div>
        ) : (
          ""
        )}
      </div>

      {/* Failed Tests */}
      {!runAll && (
        <div style={{ marginTop: 10 }}>
          <select value={test} disabled={tests.length === 0} onChange={(e) => setTest(Number(e.target.value))}>
            <option value={0}>-- test --</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {`${test.featureName} - ${test.scenarioName}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rerun button */}
      <div style={{ marginTop: 10 }}>
        <button disabled={(!runAll && test === 0) || tests.length === 0} onClick={() => handleRerun("rerun")}>
          Run
        </button>
        <button disabled={(!runAll && test === 0) || tests.length === 0} onClick={() => handleRerun("debug")}>
          Debug
        </button>
      </div>

      <div style={{ marginTop: 20, color: message.includes("junit-xml") ? "red" : "green" }}>{message}</div>

      {!hasPAT && <p style={{ color: "red" }}>Add PAT in Settings to enable projects</p>}
      <div style={{ display: spinner ? "block" : "none", position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "lightgrey", opacity: "0.7" }}>
        <h3 style={{ display: "flex", width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>Loading...</h3>
      </div>
    </>
  );
}
