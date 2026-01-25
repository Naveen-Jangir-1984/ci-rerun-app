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
  test: number[];
  env: string;
  runAll: boolean;
  handleProjectChange: (value: string) => void;
  handleRangeChange: (value: string) => void;
  handleBuildChange: (value: string) => void;
  handleTestChange: (value: number[]) => void;
  handleRunAllChange: () => void;
  handleDownloadFailures: () => void;
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

export default function Filter({ projects, builds, tests, summary, hasPAT, spinner, message, project, range, build, test, env, runAll, handleProjectChange, handleRangeChange, handleBuildChange, handleTestChange, handleRunAllChange, setEnv, handleRerun, handleDownloadFailures }: FilterProps) {
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
      {!project ||
        !range ||
        !build ||
        (!runAll && (
          <div>
            <span className="filter-field">Failed Test</span>
            <div style={{ width: "70%", position: "relative" }}>
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "5px",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: tests.length === 0 ? "#e9ecef" : "#fff",
                  cursor: tests.length === 0 ? "not-allowed" : "pointer",
                }}
                onClick={(e) => {
                  if (tests.length > 0) {
                    const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
                    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
                  }
                }}
              >
                {test.length === 0 ? "-- select --" : `${tests.filter((t) => (Array.isArray(test) ? test.includes(t.id) : false)).length} selected`}
              </div>
              <div
                style={{
                  display: "none",
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "5px",
                  maxHeight: "300px",
                  overflowY: "auto",
                  zIndex: 1000,
                  marginTop: "1px",
                  boxSizing: "border-box",
                }}
                ref={(dropdown) => {
                  if (dropdown) {
                    const handleClickOutside = (e: MouseEvent) => {
                      if (!dropdown.parentElement?.contains(e.target as Node)) {
                        dropdown.style.display = "none";
                      }
                    };

                    if (dropdown.style.display === "block") {
                      document.addEventListener("click", handleClickOutside);
                    }

                    return () => document.removeEventListener("click", handleClickOutside);
                  }
                }}
              >
                {tests.map((testItem) => (
                  <label
                    key={testItem.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0.5rem 0.75rem",
                      cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={Array.isArray(test) ? test.includes(testItem.id) : false}
                      onChange={(e) => {
                        const currentTests = Array.isArray(test) ? test : [];
                        if (e.target.checked) {
                          handleTestChange([...currentTests, testItem.id] as any);
                        } else {
                          handleTestChange(currentTests.filter((id) => id !== testItem.id) as any);
                        }
                      }}
                      style={{ marginRight: "10px" }}
                    />
                    <span style={{ fontSize: "12px", lineHeight: "1.5" }}>
                      <span>{`${testItem.featureName} →`}</span>
                      <span style={{ marginLeft: "5px", color: "#777", fontStyle: "italic" }}>{testItem.scenarioName}</span> {testItem.example ? <span style={{ marginLeft: "5px", backgroundColor: "#ddd", color: "#555", padding: "3px 7px", borderRadius: "5px", fontSize: "11px" }}>{testItem.example}</span> : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}

      {/* Environment selector */}
      {build > 0 && (
        <div>
          <span className="filter-field">Environment</span>
          <select
            style={{ width: "70%" }}
            value={env}
            disabled={(!runAll && test.length === 0) || tests.length === 0 || builds.length === 0}
            onChange={(e) => {
              setEnv(e.target.value);
              sessionStorage.setItem("env", e.target.value);
            }}
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env.value} value={env.value}>
                {env.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rerun button */}
      {build ? (
        <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button className="medium-button" style={{ width: "auto" }} onClick={() => handleDownloadFailures()}>
            {`Download Failed Tests ${test.length > 0 ? `(${test.length})` : `(${summary?.failed || 0})`}`}
          </button>
          <button
            className="medium-button"
            disabled={(!runAll && test.length === 0) || tests.length === 0 || builds.length === 0}
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
            disabled={(!runAll && test.length === 0) || tests.length === 0 || builds.length === 0}
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
      ) : (
        ""
      )}

      <div style={{ color: message.color }}>{message.text}</div>

      {!hasPAT && <p style={{ color: "red", width: "100%" }}>Add PAT in Settings to enable projects</p>}
    </div>
  );
}
