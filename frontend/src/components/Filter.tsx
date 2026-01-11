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
  handleRerun: (mode: string) => void;
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
    <>
      {/* Project selector */}
      <div style={{ width: "100%" }}>
        <select style={{ width: "100%" }} disabled={projects.length === 0} onChange={(e) => handleProjectChange(e.target.value)} value={project}>
          <option value="">-- select project --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Range filter */}
      <div style={{ width: "100%" }}>
        <select style={{ width: "100%" }} value={range} disabled={!project} onChange={(e) => handleRangeChange(e.target.value)}>
          <option value="">-- select range --</option>
          {TIME_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Build selector */}
      <div style={{ width: "100%" }}>
        <select style={{ width: "100%" }} value={build} disabled={builds.length === 0} onChange={(e) => handleBuildChange(e.target.value)}>
          <option value={0}>-- select build --</option>
          {builds.map((b) => (
            <option key={b.buildId} style={{ display: b.status === "completed" && b.result === "succeeded" ? "none" : "block" }} value={b.buildId}>
              (#{b.buildId}) {b.pipelineName}
            </option>
          ))}
        </select>
      </div>

      <div style={{ width: "100%" }}>
        {build > 0 && tests.length > 0 ? (
          <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "10px", border: "1px solid lightgrey", borderRadius: "5px", padding: "5px 10px" }}>
            <div>{`Total ${summary?.total || 0}, Passed ${summary?.passed || 0}, Failed ${summary?.failed || 0}`}</div>
            <input id="runall" type="checkbox" disabled={builds.length === 0} checked={runAll} onChange={handleRunAllChange} />
            <label htmlFor="runall">Run All Failed</label>
          </div>
        ) : project && range && build && !spinner ? (
          <div style={{ color: "red" }}>Either there is no artifact found or there were no failures.</div>
        ) : (
          ""
        )}
      </div>

      {/* Failed Tests */}
      {!runAll && (
        <div style={{ width: "100%" }}>
          <select style={{ width: "100%" }} value={test} disabled={tests.length === 0} onChange={(e) => handleTestChange(Number(e.target.value))}>
            <option value={0}>-- select failed test --</option>
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
        <div style={{ width: "100%" }}>
          <select style={{ width: "100%" }} value={env} disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0} onChange={(e) => setEnv(e.target.value)}>
            {ENVIRONMENTS.map((env) => (
              <option key={env.value} value={env.value}>
                {env.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rerun button */}
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-start", gap: "10px" }}>
        <button className="medium-button" disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0} onClick={() => handleRerun("rerun")}>
          Run
        </button>
        <button className="medium-button" disabled={(!runAll && test === 0) || tests.length === 0 || builds.length === 0} onClick={() => handleRerun("debug")}>
          Debug
        </button>
      </div>

      <div style={{ color: message.color }}>{message.text}</div>

      {!hasPAT && <p style={{ color: "red" }}>Add PAT in Settings to enable projects</p>}
      <div style={{ display: spinner.visible ? "block" : "none", position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "lightgrey", opacity: "0.7" }}>
        <h3 style={{ display: "flex", width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>{spinner.message}</h3>
      </div>
    </>
  );
}
