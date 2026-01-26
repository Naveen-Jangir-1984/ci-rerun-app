import { useEffect, useReducer, useCallback, useMemo } from "react";
import { getProjects, rerun } from "../api";
import { useAuth } from "../context/AuthContext";
import Filter from "../components/Filter";
import Results from "../components/Results";
import Spinner from "../components/Spinner";
import stripAnsi from "strip-ansi";

// Types
interface Message {
  color: string;
  text: string;
}

interface SpinnerState {
  visible: boolean;
  message: string;
}

interface DashboardState {
  projects: any[];
  project: string;
  range: string;
  builds: any[];
  build: number;
  summary: any;
  runAll: boolean;
  tests: any[];
  test: any[];
  env: string;
  result: any[];
  hasPAT: boolean;
  message: Message;
  spinner: SpinnerState;
}

type ActionType = { type: "SET_PROJECTS"; payload: any[] } | { type: "SET_PROJECT"; payload: string } | { type: "SET_RANGE"; payload: string } | { type: "SET_BUILDS"; payload: any[] } | { type: "SET_BUILD"; payload: number } | { type: "SET_SUMMARY"; payload: any } | { type: "SET_RUN_ALL"; payload: boolean } | { type: "SET_TESTS"; payload: any[] } | { type: "SET_TEST"; payload: any[] } | { type: "SET_ENV"; payload: string } | { type: "SET_RESULT"; payload: any[] } | { type: "SET_HAS_PAT"; payload: boolean } | { type: "SET_MESSAGE"; payload: Message } | { type: "SET_SPINNER"; payload: SpinnerState };

// Helpers
const getSessionItem = <T,>(key: string, defaultValue: T): T => {
  const item = sessionStorage.getItem(key);
  if (!item) return defaultValue;
  try {
    return typeof defaultValue === "string" ? (item as T) : JSON.parse(item);
  } catch {
    return defaultValue;
  }
};

const setSessionItem = (key: string, value: any): void => {
  sessionStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
};

const cleanPlaywrightLogs = (logs: string): string => {
  return stripAnsi(logs)
    .replace(/\r/g, "")
    .replace(/^(?:A\s?)+/gm, "");
};

const getFormattedDateTime = (): string => {
  return new Date().toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export default function Dashboard() {
  const { user, update } = useAuth();

  const initialState: DashboardState = useMemo(
    () => ({
      projects: getSessionItem("projects", []),
      project: getSessionItem("project", ""),
      range: getSessionItem("range", ""),
      builds: getSessionItem("builds", []),
      build: getSessionItem("build", 0),
      summary: getSessionItem("summary", null),
      runAll: getSessionItem("runAll", false),
      tests: getSessionItem("tests", []),
      test: getSessionItem("test", []),
      env: getSessionItem("env", "qa"),
      result: user?.results || [],
      hasPAT: user?.pat || false,
      message: { color: "", text: "" },
      spinner: { visible: false, message: "" },
    }),
    [user?.results, user?.pat],
  );

  const reducer = useCallback((state: DashboardState, action: ActionType): DashboardState => {
    const { type, payload } = action;
    const key = type
      .replace("SET_", "")
      .toLowerCase()
      .replace(/_([a-z])/g, (_, l) => l.toUpperCase());

    if (key in state) {
      return { ...state, [key]: payload };
    }
    return state;
  }, []);

  const [state, dispatch] = useReducer(reducer, initialState);

  /* Load projects on page load */
  useEffect(() => {
    const loadProjects = async () => {
      dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
      dispatch({ type: "SET_SPINNER", payload: { visible: true, message: "Please wait..." } });

      try {
        const res = await getProjects(user);
        const projects = res.status === 200 ? res.data : [];
        dispatch({ type: "SET_PROJECTS", payload: projects });
        if (projects.length > 0) {
          setSessionItem("projects", projects);
        }
      } catch (error) {
        dispatch({ type: "SET_PROJECTS", payload: [] });
      } finally {
        dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
      }
    };

    loadProjects();
  }, [user]);

  const createTestResult = useCallback(
    (testData: any, test: any, runId: number, build: any, env: string, mode: string, isOpen: boolean) => ({
      ...testData,
      test,
      runId,
      build,
      env,
      mode,
      logs: cleanPlaywrightLogs(testData.logs),
      isOpen,
      date: getFormattedDateTime(),
    }),
    [],
  );

  const closeAllLogs = useCallback((results: any[]) => results.map((r) => ({ ...r, isOpen: false })), []);

  const handleRerun = useCallback(
    async (runId: number, build: any, env: string, mode: string) => {
      const isRerun = runId > 0;
      const isRunAll = runId < 0 && state.runAll;
      const testCount = isRunAll ? state.tests.length : state.test.length || 1;
      const testLabel = testCount === 1 ? "test" : "tests";
      const debugMode = mode === "debug" ? " in debug mode" : "";
      const action = isRerun ? "Re-running" : "Running";

      dispatch({ type: "SET_MESSAGE", payload: { color: "", text: "" } });
      dispatch({
        type: "SET_SPINNER",
        payload: {
          visible: true,
          message: `${action} ${testCount} ${testLabel}${debugMode}...`,
        },
      });

      // Determine which tests to run
      const testsToRun = isRunAll ? state.tests : runId < 0 ? state.tests.filter((t: any) => state.test.includes(t.id)) : [state.result.find((r: any) => r.runId === runId)?.test];

      try {
        const res = await rerun(testsToRun as any[], mode, env);

        if (res.status === 200) {
          const closedResults = closeAllLogs(state.result);

          let updatedResult: any[];
          if (isRerun) {
            // Update existing result
            updatedResult = closedResults.map((r: any) => (r.runId === runId ? createTestResult(res.data[0], r.test, runId, r.build, env, mode, true) : r));
          } else {
            // Add new results
            const testInfo = state.test.length > 0 ? state.tests.filter((t: any) => state.test.includes(t.id)) : state.tests;

            const baseRunId = state.result.length + 1;
            const newResults = res.data.map((r: any, idx: number) => createTestResult(r, testInfo[idx], baseRunId + idx, build, env, mode, testInfo.length === 1));

            updatedResult = state.result.length > 0 ? [...closedResults, ...newResults] : newResults;
          }

          dispatch({ type: "SET_RESULT", payload: updatedResult });
          update({ result: updatedResult });
          setSessionItem("user", { ...user, result: updatedResult });
        } else {
          dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: res.error } });
        }
      } catch (error) {
        dispatch({
          type: "SET_MESSAGE",
          payload: {
            color: "red",
            text: "An error occurred while running tests",
          },
        });
      } finally {
        dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
      }
    },
    [state, user, update, createTestResult, closeAllLogs],
  );

  return (
    <div className="dashboard">
      <Filter state={state} dispatch={dispatch} handleRerun={handleRerun} />
      <Results state={state} dispatch={dispatch} cleanPlaywrightLogs={cleanPlaywrightLogs} handleRerun={handleRerun} />
      <Spinner visible={state.spinner.visible} message={state.spinner.message} />
    </div>
  );
}
