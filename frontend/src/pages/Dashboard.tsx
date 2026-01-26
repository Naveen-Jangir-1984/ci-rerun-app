import { useEffect, useReducer } from "react";
import { getProjects, rerun } from "../api";
import { useAuth } from "../context/AuthContext";
import Filter from "../components/Filter";
import Results from "../components/Results";
import Spinner from "../components/Spinner";
import stripAnsi from "strip-ansi";

export default function Dashboard() {
  const { user, update } = useAuth();

  const initialState = {
    projects: JSON.parse(sessionStorage.getItem("projects") || "[]"),
    project: sessionStorage.getItem("project") || "",
    range: sessionStorage.getItem("range") || "",
    builds: JSON.parse(sessionStorage.getItem("builds") || "[]"),
    build: Number(sessionStorage.getItem("build") || 0),
    summary: JSON.parse(sessionStorage.getItem("summary") || "null"),
    runAll: sessionStorage.getItem("runAll") === "true",
    tests: JSON.parse(sessionStorage.getItem("tests") || "[]"),
    test: JSON.parse(sessionStorage.getItem("test") || "[]"),
    env: sessionStorage.getItem("env") || "qa",
    result: user?.results || [],
    hasPAT: user?.pat || false,
    message: { color: "", text: "" },
    spinner: { visible: false, message: "" },
  };

  const reducer = (state: any, action: any) => {
    switch (action.type) {
      case "SET_PROJECTS":
        return { ...state, projects: action.payload };
      case "SET_PROJECT":
        return { ...state, project: action.payload };
      case "SET_RANGE":
        return { ...state, range: action.payload };
      case "SET_BUILDS":
        return { ...state, builds: action.payload };
      case "SET_BUILD":
        return { ...state, build: action.payload };
      case "SET_SUMMARY":
        return { ...state, summary: action.payload };
      case "SET_RUN_ALL":
        return { ...state, runAll: action.payload };
      case "SET_TESTS":
        return { ...state, tests: action.payload };
      case "SET_TEST":
        return { ...state, test: action.payload };
      case "SET_ENV":
        return { ...state, env: action.payload };
      case "SET_RESULT":
        return { ...state, result: action.payload };
      case "SET_HAS_PAT":
        return { ...state, hasPAT: action.payload };
      case "SET_MESSAGE":
        return { ...state, message: action.payload };
      case "SET_SPINNER":
        return { ...state, spinner: action.payload };
      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  /* Load projects on page load */
  useEffect(() => {
    const projects = async (user: any) => {
      dispatch({ type: "SET_SPINNER", payload: { visible: true, message: `Please wait...` } });
      const res = await getProjects(user);
      if (res.status === 200) {
        dispatch({ type: "SET_PROJECTS", payload: res.data });
        sessionStorage.setItem("projects", JSON.stringify(res.data));
      } else {
        dispatch({ type: "SET_PROJECTS", payload: [] });
      }
      dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
    };
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
    projects(user);
  }, [state.project]);

  const cleanPlaywrightLogs = (logs: string) => {
    logs = stripAnsi(logs);
    logs = logs.replace(/\r/g, "");
    logs = logs.replace(/^(?:A\s?)+/gm, "");
    return logs;
  };

  const handleRerun = async (runId: number, build: any, env: string, mode: string) => {
    const isRerun = runId > 0;
    const isRunAll = runId < 0 && state.runAll;
    const testCount = isRunAll ? state.tests.length : state.test.length ? state.test.length : 1;
    const testLabel = isRunAll ? "tests" : "test";
    const debugMode = mode === "debug" ? " in debug mode" : "";

    dispatch({ type: "SET_SPINNER", payload: { visible: true, message: `${isRerun ? `Re-running ` : `Running `}${testCount} ${testLabel}${debugMode}...` } });
    dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });

    // Determine which tests to run
    let testsToRun;
    if (isRunAll) {
      testsToRun = state.tests;
    } else if (runId < 0) {
      testsToRun = state.tests.filter((t: any) => state.test.includes(t.id));
    } else {
      testsToRun = [state.result.find((r: any) => r.runId === runId)?.test];
    }

    const res = await rerun(testsToRun as any[], mode, env);

    if (res.status === 200) {
      dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
      const formattedDateTime = new Date().toLocaleString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const closeAllLogs = state.result.map((r: any) => ({ ...r, isOpen: false }));

      let updatedResult;
      if (isRerun) {
        updatedResult = closeAllLogs.map((r: any) =>
          r.runId === runId
            ? {
                ...res.data[0],
                test: r.test,
                runId,
                build: r.build,
                env,
                mode,
                logs: cleanPlaywrightLogs(res.data[0].logs),
                isOpen: true,
                date: formattedDateTime,
              }
            : r,
        );
      } else if (state.result.length > 0) {
        const testInfo = state.tests.filter((t: any) => state.test.includes(t.id));
        const baseRunId = state.result.length + 1;
        const newResults = res.data.map((r: any, idx: number) => ({
          ...r,
          test: state.test.length > 0 ? testInfo[idx] : state.tests[idx],
          runId: baseRunId + idx,
          build,
          env,
          mode,
          logs: cleanPlaywrightLogs(r.logs),
          isOpen: testInfo.length === 1,
          date: formattedDateTime,
        }));
        updatedResult = [...closeAllLogs, ...newResults];
      } else {
        updatedResult = res.data.map((r: any, idx: number) => ({
          ...r,
          test: state.tests[idx],
          runId: idx + 1,
          build,
          env,
          mode,
          logs: cleanPlaywrightLogs(r.logs),
          isOpen: state.test.length === 1,
          date: formattedDateTime,
        }));
      }

      dispatch({ type: "SET_RESULT", payload: updatedResult });
      update({ result: updatedResult });
      sessionStorage.setItem("user", JSON.stringify({ ...user, result: updatedResult }));
    } else {
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: res.error } });
    }

    dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
  };

  return (
    <div className="dashboard">
      <Filter state={state} dispatch={dispatch} handleRerun={handleRerun} />
      <Results state={state} dispatch={dispatch} cleanPlaywrightLogs={cleanPlaywrightLogs} handleRerun={handleRerun} />
      <Spinner visible={state.spinner.visible} message={state.spinner.message} />
    </div>
  );
}
