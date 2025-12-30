import { useEffect, useState } from "react";
import { getProjects, getBuilds, getTests, rerun } from "../api";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import AnsiToHtml from "ansi-to-html";
import stripAnsi from "strip-ansi";

const TIME_RANGES = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Current Week", value: "current_week" },
  { label: "Last Week", value: "last_week" },
  { label: "Current Month", value: "current_month" },
  { label: "Last Month", value: "last_month" },
];

const ENVIRONMENTS = [
  { label: "QA", value: "qa" },
  { label: "STAGING", value: "stg" },
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
  const [env, setEnv] = useState<string>("qa");

  const [message, setMessage] = useState({ color: "", text: "" });
  const [result, setResult] = useState<any[]>([]);
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
    setMessage({ color: "", text: "" });
    projects(user);
  }, [project]);

  async function handleProjectChange(value: string) {
    setResult([]);
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
    setMessage({ color: "", text: "" });
    setProject(value);
  }

  async function handleRangeChange(value: string) {
    setResult([]);
    setMessage({ color: "", text: "" });
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
    if (res.data.length === 0) {
      setMessage({ color: "red", text: "No builds found for the selected range." });
      setRunAll(true);
    }
    setSpinner(false);
  }

  async function handleBuildChange(value: string) {
    setResult([]);
    setMessage({ color: "", text: "" });
    if (!Number(value)) {
      setBuild(0);
      setTests([]);
      setTest(0);
      setRunAll(true);
      return;
    }
    setSpinner(true);
    setBuild(Number(value));
    const res = await getTests(user, project, Number(value));
    setTests(res.data);
    setSpinner(false);
  }

  async function handleRunAllChange() {
    if (!runAll) {
      setTest(0);
    }
    setMessage({ color: "", text: "" });
    setRunAll(!runAll);
    setResult([]);
  }

  function handleTestChange(value: number) {
    setMessage({ color: "", text: "" });
    setTest(value);
    setResult([]);
  }

  async function handleRerun(mode: string) {
    setResult([]);
    setMessage({ color: "green", text: "Rerun initiated successfully. Please wait for result..." });
    setSpinner(true);
    const res = await rerun(runAll ? tests : (tests.filter((t) => t.id === test) as any[]), mode, env);
    if (res.status === 200) {
      setMessage({ color: "", text: "" });
      setResult(res.data.map((r: any) => ({ ...r, logs: cleanPlaywrightLogs(r.logs) })));
    } else {
      setMessage({ color: "red", text: res.error });
    }
    setSpinner(false);
  }

  const ansiConverter = new AnsiToHtml({
    fg: "#FFF",
    bg: "#FFF",
    newline: true,
    escapeXML: true,
  });

  function cleanPlaywrightLogs(logs: string) {
    logs = stripAnsi(logs);
    logs = logs.replace(/\r/g, "");
    logs = logs.replace(/^(?:A\s?)+/gm, "");
    return logs;
  }

  function LogsViewer({ logs }: { logs: string }) {
    const html = ansiConverter.toHtml(cleanPlaywrightLogs(logs));

    return (
      <div
        style={{
          background: "#000",
          color: "#fff",
          padding: "2rem",
          fontFamily: "monospace",
          fontSize: "13px",
          overflowX: "auto",
          borderRadius: "10px",
          marginTop: "10px",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
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
        ) : project && range && build && !spinner ? (
          <div style={{ marginTop: 10, color: "red" }}>Either there is no artifact found or there were no failures.</div>
        ) : (
          ""
        )}
      </div>

      {/* Failed Tests */}
      {!runAll && (
        <div style={{ marginTop: 10 }}>
          <select value={test} disabled={tests.length === 0} onChange={(e) => handleTestChange(Number(e.target.value))}>
            <option value={0}>-- select test --</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.featureName} → {test.scenarioName} {test.example ? `(${test.example})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Environment selector */}
      <div style={{ marginTop: 10 }}>
        <select value={env} disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0} onChange={(e) => setEnv(e.target.value)}>
          {ENVIRONMENTS.map((env) => (
            <option key={env.value} value={env.value}>
              {env.label}
            </option>
          ))}
        </select>
      </div>

      {/* Rerun button */}
      <div style={{ marginTop: 10 }}>
        <button disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0} onClick={() => handleRerun("rerun")}>
          Run
        </button>
        <button disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0} onClick={() => handleRerun("debug")}>
          Debug
        </button>
      </div>

      <div style={{ marginTop: 20, color: message.color }}>{message.text}</div>

      {!hasPAT && <p style={{ color: "red" }}>Add PAT in Settings to enable projects</p>}
      {result.length > 0 &&
        result.map((r, idx) => (
          <div key={idx} style={{ marginTop: 10 }}>
            <span>{`${r.title}`}</span>
            <span style={{ color: r.status === "Passed" ? "green" : "red" }}>{` (${r.status})`}</span>
            <LogsViewer logs={r.logs} />
          </div>
        ))}
      <div style={{ display: spinner ? "block" : "none", position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "lightgrey", opacity: "0.7" }}>
        <h3 style={{ display: "flex", width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>Loading...</h3>
      </div>
    </>
  );
}
