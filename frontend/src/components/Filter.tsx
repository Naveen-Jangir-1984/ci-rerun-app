import Header from "./Header";

interface FilterProps {
  projects: any[];
  builds: any[];
  tests: any[];
  summary: any;
  hasPAT: boolean;
  spinner: { visible: boolean; message: string };
  message: { text: string; color: string };
  project: string;
  range: string;
  build: number;
  test: number;
  env: string;
  runAll: boolean;
  handleProjectChange: (value: string) => void;
  handleRangeChange: (value: string) => void;
  handleBuildChange: (value: string) => void;
  handleTestChange: (value: number) => void;
  handleRunAllChange: () => void;
  setEnv: (value: string) => void;
  handleRerun: (id: number, build: any, env: string, mode: string) => void;
}

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

export default function Filter({ projects, builds, tests, summary, hasPAT, spinner, message, project, range, build, test, env, runAll, handleProjectChange, handleRangeChange, handleBuildChange, handleTestChange, handleRunAllChange, setEnv, handleRerun }: FilterProps) {
  return (
    <div className="filter" style={{ filter: spinner.visible ? "blur(5px)" : "none" }}>
      {/* Header */}
      <Header />

      {/* Organization */}
      <div>
        <span className="filter-field">Organization</span>
        <div style={{ width: "70%", display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "not-allowed" }}>
          <span style={{ width: "100%", backgroundColor: "#fff", padding: ".50rem .75rem", border: "1px solid #ccc", borderRadius: "5px" }}>{`${import.meta.env.VITE_SERVER_ORG}`}</span>
        </div>
      </div>

      {/* Project selector */}
      <div>
        <span className="filter-field">Project</span>
        <select style={{ width: "70%" }} disabled={projects.length === 0} onChange={(e) => handleProjectChange(e.target.value)} value={project}>
          <option value="">-- select --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Range filter */}
      <div>
        <span className="filter-field">Range</span>
        <select style={{ width: "70%" }} value={range} disabled={!project} onChange={(e) => handleRangeChange(e.target.value)}>
          <option value="">-- select --</option>
          {TIME_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Build selector */}
      <div>
        <span className="filter-field">(#Build) Pipeline</span>
        <select style={{ width: "70%" }} value={build} disabled={builds.length === 0} onChange={(e) => handleBuildChange(e.target.value)}>
          <option value={0}>-- select --</option>
          {builds.map((b) => (
            <option key={b.buildId} style={{ display: b.status === "completed" && b.result === "succeeded" ? "none" : "block" }} value={b.buildId}>
              (#{b.buildId}) {b.pipelineName}
            </option>
          ))}
        </select>
      </div>

      {/* Summary and Run All Failed */}
      {build > 0 && tests.length > 0 ? (
        <div>
          <span className="filter-field">Result</span>
          <div className="filter-result">
            <span style={{ backgroundColor: "#def" }}>{`Total ${summary?.total || 0}`}</span>
            <span style={{ backgroundColor: "#dfd" }}>{`Passed ${summary?.passed || 0}`}</span>
            <span style={{ fontWeight: "bold", backgroundColor: "#fdd" }}>{`Failed ${summary?.failed || 0}`}</span>
            <label htmlFor="runall">
              <input id="runall" type="checkbox" disabled={builds.length === 0} checked={runAll} onChange={handleRunAllChange} />
              <span>Run All Failed</span>
            </label>
          </div>
        </div>
      ) : project && range && build && !spinner ? (
        <div style={{ color: "red" }}>Either there is no artifact found or there were no failures.</div>
      ) : (
        ""
      )}

      {/* Failed Tests */}
      {!runAll && (
        <div>
          <span className="filter-field">Failed Test</span>
          <select style={{ width: "70%" }} value={test} disabled={tests.length === 0} onChange={(e) => handleTestChange(Number(e.target.value))}>
            <option value={0}>-- select --</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.featureName} → {test.scenarioName} {test.example ? `(${test.example})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Environment selector */}
      {build > 0 && (
        <div>
          <span className="filter-field">Environment</span>
          <select style={{ width: "70%" }} value={env} disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0} onChange={(e) => setEnv(e.target.value)}>
            {ENVIRONMENTS.map((env) => (
              <option key={env.value} value={env.value}>
                {env.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rerun button */}
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button
          className="medium-button"
          disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0}
          onClick={() =>
            handleRerun(
              -1,
              builds.find((b) => b.buildId === build),
              env,
              "rerun",
            )
          }
        >
          Run
        </button>
        <button
          className="medium-button"
          disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0}
          onClick={() =>
            handleRerun(
              -1,
              builds.find((b) => b.buildId === build),
              env,
              "debug",
            )
          }
        >
          Debug
        </button>
      </div>

      <div style={{ color: message.color }}>{message.text}</div>

      {!hasPAT && <p style={{ color: "red", width: "100%" }}>Add PAT in Settings to enable projects</p>}
    </div>
  );
}
