import Header from "./Header";
import { getBuilds, getTests, downloadFailures } from "../api";
import { useAuth } from "../context/AuthContext";

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

export default function Filter({ state, dispatch, handleRerun }: { state: any; dispatch: any; handleRerun: any }) {
  const { user } = useAuth();

  const handleProjectChange = (value: string) => {
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
    dispatch({ type: "SET_RANGE", payload: "" });
    dispatch({ type: "SET_BUILDS", payload: [] });
    dispatch({ type: "SET_BUILD", payload: 0 });
    dispatch({ type: "SET_SUMMARY", payload: null });
    dispatch({ type: "SET_RUN_ALL", payload: false });
    dispatch({ type: "SET_TESTS", payload: [] });
    dispatch({ type: "SET_TEST", payload: [] });
    if (!value) {
      dispatch({ type: "SET_PROJECT", payload: "" });
      sessionStorage.removeItem("project");
      sessionStorage.removeItem("range");
      sessionStorage.removeItem("builds");
      sessionStorage.removeItem("build");
      sessionStorage.removeItem("tests");
      sessionStorage.removeItem("summary");
      sessionStorage.removeItem("runAll");
      sessionStorage.removeItem("test");
      sessionStorage.removeItem("env");
      return;
    }
    dispatch({ type: "SET_PROJECT", payload: value });
    sessionStorage.setItem("project", value);
  };

  const handleRangeChange = async (value: string) => {
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
    dispatch({ type: "SET_BUILDS", payload: [] });
    dispatch({ type: "SET_BUILD", payload: 0 });
    dispatch({ type: "SET_SUMMARY", payload: null });
    dispatch({ type: "SET_RUN_ALL", payload: false });
    dispatch({ type: "SET_TESTS", payload: [] });
    dispatch({ type: "SET_TEST", payload: [] });
    if (!value) {
      dispatch({ type: "SET_RANGE", payload: "" });
      sessionStorage.removeItem("range");
      sessionStorage.removeItem("builds");
      sessionStorage.removeItem("build");
      sessionStorage.removeItem("tests");
      sessionStorage.removeItem("summary");
      sessionStorage.removeItem("runAll");
      sessionStorage.removeItem("test");
      sessionStorage.removeItem("env");
      return;
    }
    dispatch({ type: "SET_SPINNER", payload: { visible: true, message: `Loading Builds...` } });
    dispatch({ type: "SET_RANGE", payload: value });
    sessionStorage.setItem("range", value);
    const res = await getBuilds(user, state.project, value);
    dispatch({ type: "SET_BUILDS", payload: res.data });
    sessionStorage.setItem("builds", JSON.stringify(res.data));
    if (res.data.length === 0) {
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "No builds found for the selected range." } });
      dispatch({ type: "SET_RUN_ALL", payload: true });
    }
    dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
  };

  const handleBuildChange = async (value: string) => {
    dispatch({ type: "SET_TESTS", payload: [] });
    dispatch({ type: "SET_TEST", payload: [] });
    dispatch({ type: "SET_SUMMARY", payload: null });
    dispatch({ type: "SET_RUN_ALL", payload: false });
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
    if (!Number(value)) {
      dispatch({ type: "SET_BUILD", payload: 0 });
      sessionStorage.removeItem("build");
      sessionStorage.removeItem("tests");
      sessionStorage.removeItem("summary");
      sessionStorage.removeItem("runAll");
      sessionStorage.removeItem("test");
      sessionStorage.removeItem("env");
      return;
    }
    dispatch({ type: "SET_SPINNER", payload: { visible: true, message: `Loading Build #${value} result...` } });
    dispatch({ type: "SET_BUILD", payload: Number(value) });
    sessionStorage.setItem("build", String(Number(value)));
    const res = await getTests(user, state.project, Number(value));
    dispatch({ type: "SET_SUMMARY", payload: res.data.summary });
    sessionStorage.setItem("summary", JSON.stringify(res.data.summary));
    if (res.status !== 200) {
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: res.error } });
    } else if (res.data.summary.failed === 0) {
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "No failed tests extracted for the selected build." } });
      dispatch({ type: "SET_RUN_ALL", payload: false });
    } else {
      dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
      dispatch({ type: "SET_TESTS", payload: res.data.failedTests });
      sessionStorage.setItem("tests", JSON.stringify(res.data.failedTests));
    }
    dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
  };

  const handleRunAllChange = () => {
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
    dispatch({ type: "SET_RUN_ALL", payload: !state.runAll });
    sessionStorage.setItem("runAll", String(!state.runAll));
    if (!state.runAll) {
      dispatch({ type: "SET_TEST", payload: [] });
      dispatch({ type: "SET_ENV", payload: "qa" });
      sessionStorage.removeItem("test");
      sessionStorage.setItem("env", "qa");
    }
  };

  const handleTestChange = (value: number[]) => {
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
    dispatch({ type: "SET_TEST", payload: value });
    sessionStorage.setItem("test", JSON.stringify(value));
  };

  const handleDownloadFailures = async () => {
    dispatch({ type: "SET_SPINNER", payload: { visible: true, message: `Downloading failures...` } });
    try {
      const blob = await downloadFailures(state.build, state.tests);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Failures_#${state.build}_${new Date().toISOString().replace(/[.Z]/g, "").replaceAll(/_/g, ":").replace("T", "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
    } catch (error) {
      dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "❌ Failed to download file." } });
    }
  };

  const buttonLabel = `${state.runAll ? "All" : state.test.length > 0 ? `Selected (${state.test.length})` : "All"}`;

  return (
    <div className="filter" style={{ filter: state.spinner.visible ? "blur(5px)" : "none" }}>
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
        <select style={{ width: "70%" }} disabled={state.projects.length === 0} onChange={(e) => handleProjectChange(e.target.value)} value={state.project}>
          <option value="">-- select --</option>
          {state.projects.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Range filter */}
      <div>
        <span className="filter-field">Range</span>
        <select style={{ width: "70%" }} value={state.range} disabled={!state.project} onChange={(e) => handleRangeChange(e.target.value)}>
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
        <select style={{ width: "70%" }} value={state.build} disabled={state.builds.length === 0} onChange={(e) => handleBuildChange(e.target.value)}>
          <option value={0}>-- select --</option>
          {state.builds.map((b: any) => (
            <option key={b.buildId} style={{ display: b.status === "completed" && b.result === "succeeded" ? "none" : "block" }} value={b.buildId}>
              (#{b.buildId}) {b.pipelineName}
            </option>
          ))}
        </select>
      </div>

      {/* Summary and Run All Failed */}
      {state.build > 0 && state.tests.length > 0 ? (
        <div>
          <span className="filter-field">Result</span>
          <div className="filter-result">
            <span style={{ backgroundColor: "#def" }}>{`Total ${state.summary?.total || 0}`}</span>
            <span style={{ backgroundColor: "#dfd" }}>{`Passed ${state.summary?.passed || 0}`}</span>
            <span style={{ fontWeight: "bold", backgroundColor: "#fdd" }}>{`Failed ${state.summary?.failed || 0}`}</span>
            <label htmlFor="runall">
              <input id="runall" type="checkbox" disabled={state.builds.length === 0} checked={state.runAll} onChange={handleRunAllChange} />
              <span>Run All Failed</span>
            </label>
          </div>
        </div>
      ) : state.project && state.range && state.build && !state.spinner.visible ? (
        <div style={{ color: "red" }}>Either there is no artifact found or there were no failures.</div>
      ) : (
        ""
      )}

      {/* Failed Tests */}
      {!state.project ||
        !state.range ||
        !state.build ||
        (!state.runAll && (
          <div>
            <span className="filter-field">Failed Test</span>
            <div style={{ width: "70%", position: "relative" }}>
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "5px",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: state.tests.length === 0 ? "#e9ecef" : "#fff",
                  cursor: state.tests.length === 0 ? "not-allowed" : "pointer",
                }}
                onClick={(e) => {
                  if (state.tests.length > 0) {
                    const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
                    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
                  }
                }}
              >
                {state.test.length === 0 ? "-- select --" : `${state.tests.filter((t: any) => (Array.isArray(state.test) ? state.test.includes(t.id) : false)).length} selected`}
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
                {state.tests.map((testItem: any) => (
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
                      checked={Array.isArray(state.test) ? state.test.includes(testItem.id) : false}
                      onChange={(e) => {
                        const currentTests = Array.isArray(state.test) ? state.test : [];
                        if (e.target.checked) {
                          handleTestChange([...currentTests, testItem.id] as any);
                        } else {
                          handleTestChange(currentTests.filter((id: number) => id !== testItem.id) as any);
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
      {state.build > 0 && (
        <div>
          <span className="filter-field">Environment</span>
          <select
            style={{ width: "70%" }}
            value={state.env}
            disabled={(!state.runAll && state.test.length === 0) || state.tests.length === 0 || state.builds.length === 0}
            onChange={(e) => {
              dispatch({ type: "SET_ENV", payload: e.target.value });
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
      {state.build ? (
        <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button className="medium-button" style={{ width: "auto" }} onClick={() => handleDownloadFailures()}>
            {`Download ${buttonLabel}`}
          </button>
          <button
            className="medium-button"
            style={{ width: "auto" }}
            disabled={(!state.runAll && state.test.length === 0) || state.tests.length === 0 || state.builds.length === 0}
            onClick={() =>
              handleRerun(
                -1,
                state.builds.find((b: any) => b.buildId === state.build),
                state.env,
                "rerun",
              )
            }
          >
            {`Run ${buttonLabel}`}
          </button>
          <button
            className="medium-button"
            style={{ width: "auto" }}
            disabled={(!state.runAll && state.test.length === 0) || state.tests.length === 0 || state.builds.length === 0}
            onClick={() =>
              handleRerun(
                -1,
                state.builds.find((b: any) => b.buildId === state.build),
                state.env,
                "debug",
              )
            }
          >
            {`Debug ${buttonLabel}`}
          </button>
        </div>
      ) : (
        ""
      )}

      <div style={{ color: state.message.color }}>{state.message.text}</div>

      {!state.hasPAT && <p style={{ color: "red", width: "100%" }}>Add PAT in Settings to enable projects</p>}
    </div>
  );
}
