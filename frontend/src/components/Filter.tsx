import { useCallback, useMemo } from "react";
import Header from "./Header";
import { getBuilds, getTests, downloadFailures } from "../api";
import { useAuth } from "../context/AuthContext";

// Types
interface TimeRange {
  label: string;
  value: string;
}

interface Environment {
  label: string;
  value: string;
}

interface FilterProps {
  state: any;
  dispatch: React.Dispatch<any>;
  handleRerun: (runId: number, build: any, env: string, mode: string) => Promise<void>;
}

// Constants
const TIME_RANGES: TimeRange[] = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Current Week", value: "current_week" },
  { label: "Last Week", value: "last_week" },
  { label: "Current Month", value: "current_month" },
  { label: "Last Month", value: "last_month" },
];

const ENVIRONMENTS: Environment[] = [
  { label: "QA", value: "qa" },
  { label: "STAGING", value: "stg" },
];

const SESSION_KEYS = ["project", "range", "builds", "build", "tests", "summary", "runAll", "test", "env"] as const;

// Helper functions
const clearSessionStorage = (keys: readonly string[]) => {
  keys.forEach((key) => sessionStorage.removeItem(key));
};

const resetCommonState = (dispatch: React.Dispatch<any>) => {
  dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
  dispatch({ type: "SET_TESTS", payload: [] });
  dispatch({ type: "SET_TEST", payload: [] });
  dispatch({ type: "SET_SUMMARY", payload: null });
  dispatch({ type: "SET_RUN_ALL", payload: false });
};

const generateFileName = (buildId: number): string => {
  const timestamp = new Date().toISOString().replace(/[.Z]/g, "").replaceAll(/_/g, ":").replace("T", "_");
  return `Failures_#${buildId}_${timestamp}.xlsx`;
};

export default function Filter({ state, dispatch, handleRerun }: FilterProps) {
  const { user } = useAuth();

  const handleProjectChange = useCallback(
    (value: string) => {
      resetCommonState(dispatch);
      dispatch({ type: "SET_RANGE", payload: "" });
      dispatch({ type: "SET_BUILDS", payload: [] });
      dispatch({ type: "SET_BUILD", payload: 0 });

      if (!value) {
        dispatch({ type: "SET_PROJECT", payload: "" });
        clearSessionStorage(SESSION_KEYS);
        return;
      }

      dispatch({ type: "SET_PROJECT", payload: value });
      sessionStorage.setItem("project", value);
    },
    [dispatch],
  );

  const handleRangeChange = useCallback(
    async (value: string) => {
      resetCommonState(dispatch);
      dispatch({ type: "SET_BUILDS", payload: [] });
      dispatch({ type: "SET_BUILD", payload: 0 });

      if (!value) {
        dispatch({ type: "SET_RANGE", payload: "" });
        clearSessionStorage(SESSION_KEYS.slice(1)); // Skip 'project'
        return;
      }

      dispatch({ type: "SET_RANGE", payload: value });
      sessionStorage.setItem("range", value);
      dispatch({ type: "SET_SPINNER", payload: { visible: true, message: "Loading Builds..." } });

      try {
        const res = await getBuilds(user, state.project, value);
        dispatch({ type: "SET_BUILDS", payload: res.data });
        sessionStorage.setItem("builds", JSON.stringify(res.data));

        if (res.data.length === 0) {
          dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "No builds found for the selected range." } });
          dispatch({ type: "SET_RUN_ALL", payload: true });
        }
      } catch (error) {
        dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "Failed to load builds." } });
      } finally {
        dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
      }
    },
    [dispatch, user, state.project],
  );

  const handleBuildChange = useCallback(
    async (value: string) => {
      resetCommonState(dispatch);

      const buildId = Number(value);
      if (!buildId) {
        dispatch({ type: "SET_BUILD", payload: 0 });
        clearSessionStorage(["build", "tests", "summary", "runAll", "test", "env"]);
        return;
      }

      dispatch({ type: "SET_BUILD", payload: buildId });
      sessionStorage.setItem("build", String(buildId));
      dispatch({ type: "SET_SPINNER", payload: { visible: true, message: `Loading Build #${buildId} result...` } });

      try {
        const res = await getTests(user, state.project, buildId);

        if (res.status !== 200) {
          dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: res.error } });
        } else {
          dispatch({ type: "SET_SUMMARY", payload: res.data.summary });
          sessionStorage.setItem("summary", JSON.stringify(res.data.summary));

          if (res.data.summary.failed === 0) {
            dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "No failed tests extracted for the selected build." } });
          } else {
            dispatch({ type: "SET_TESTS", payload: res.data.failedTests });
            sessionStorage.setItem("tests", JSON.stringify(res.data.failedTests));
          }
        }
      } catch (error) {
        dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "Failed to load test results." } });
      } finally {
        dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
      }
    },
    [dispatch, user, state.project],
  );

  const handleRunAllChange = useCallback(() => {
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
    const newRunAll = !state.runAll;
    dispatch({ type: "SET_RUN_ALL", payload: newRunAll });
    sessionStorage.setItem("runAll", String(newRunAll));

    if (newRunAll) {
      dispatch({ type: "SET_TEST", payload: [] });
      dispatch({ type: "SET_ENV", payload: "qa" });
      sessionStorage.removeItem("test");
      sessionStorage.setItem("env", "qa");
    }
  }, [dispatch, state.runAll]);

  const handleTestChange = useCallback(
    (value: number[]) => {
      dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
      dispatch({ type: "SET_TEST", payload: value });
      sessionStorage.setItem("test", JSON.stringify(value));
    },
    [dispatch],
  );

  const handleDownloadFailures = useCallback(async () => {
    dispatch({ type: "SET_SPINNER", payload: { visible: true, message: "Downloading failures..." } });

    try {
      const blob = await downloadFailures(state.build, state.tests);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = generateFileName(state.build);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "❌ Failed to download file." } });
    } finally {
      dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
    }
  }, [dispatch, state.build, state.tests]);

  const handleEnvChange = useCallback(
    (value: string) => {
      dispatch({ type: "SET_ENV", payload: value });
      sessionStorage.setItem("env", value);
    },
    [dispatch],
  );

  const buttonLabel = useMemo(() => (state.runAll ? "All" : state.test.length > 0 ? `Selected (${state.test.length})` : "All"), [state.runAll, state.test.length]);

  const isRunDisabled = useMemo(() => (!state.runAll && state.test.length === 0) || state.tests.length === 0 || state.builds.length === 0, [state.runAll, state.test.length, state.tests.length, state.builds.length]);

  const selectedBuild = useMemo(() => state.builds.find((b: any) => b.buildId === state.build), [state.builds, state.build]);

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
      {state.spinner.visible ||
        !state.project ||
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
      {state.spinner.visible ||
        (state.build > 0 && (
          <div>
            <span className="filter-field">Environment</span>
            <select style={{ width: "70%" }} value={state.env} disabled={isRunDisabled} onChange={(e) => handleEnvChange(e.target.value)}>
              {ENVIRONMENTS.map((env) => (
                <option key={env.value} value={env.value}>
                  {env.label}
                </option>
              ))}
            </select>
          </div>
        ))}

      {/* Rerun button */}
      {state.spinner.visible ||
        (state.build > 0 && (
          <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button className="medium-button" style={{ width: "auto" }} onClick={handleDownloadFailures}>
              {`Download ${buttonLabel}`}
            </button>
            <button className="medium-button" style={{ width: "auto" }} disabled={isRunDisabled} onClick={() => handleRerun(-1, selectedBuild, state.env, "rerun")}>
              {`Run ${buttonLabel}`}
            </button>
            <button className="medium-button" style={{ width: "auto" }} disabled={isRunDisabled} onClick={() => handleRerun(-1, selectedBuild, state.env, "debug")}>
              {`Debug ${buttonLabel}`}
            </button>
          </div>
        ))}

      <div style={{ color: state.message.color }}>{state.message.text}</div>

      {!state.hasPAT && <p style={{ color: "red", width: "100%" }}>Add PAT in Settings to enable projects</p>}
    </div>
  );
}
