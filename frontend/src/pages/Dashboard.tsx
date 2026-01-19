import { useEffect, useState } from "react";
import { getProjects, getBuilds, getTests, rerun } from "../api";
import { useAuth } from "../context/AuthContext";
import AnsiToHtml from "ansi-to-html";
import stripAnsi from "strip-ansi";
import Filter from "../components/Filter";
import Results from "../components/Results";
import Spinner from "../components/Spinner";

export default function Dashboard() {
  const { user, reflectUserChanges } = useAuth();
  const [projects, setProjects] = useState<any[]>(() => JSON.parse(sessionStorage.getItem("dashboard_projects") || "[]"));
  const [project, setProject] = useState<string>(() => sessionStorage.getItem("dashboard_project") || "");

  const [builds, setBuilds] = useState<any[]>(() => JSON.parse(sessionStorage.getItem("dashboard_builds") || "[]"));
  const [range, setRange] = useState("");
  const [build, setBuild] = useState<number>(() => Number(sessionStorage.getItem("dashboard_build") || 0));
  const [runAll, setRunAll] = useState<boolean>(false);

  const [summary, setSummary] = useState<any>(() => JSON.parse(sessionStorage.getItem("dashboard_summary") || "null"));
  const [tests, setTests] = useState<any[]>(() => JSON.parse(sessionStorage.getItem("dashboard_tests") || "[]"));
  const [test, setTest] = useState<number>(() => Number(sessionStorage.getItem("dashboard_test") || 0));
  const [env, setEnv] = useState<string>(() => sessionStorage.getItem("dashboard_env") || "qa");

  const [message, setMessage] = useState({ color: "", text: "" });
  const [result, setResult] = useState<any[]>(() => JSON.parse(sessionStorage.getItem("dashboard_result") || JSON.stringify(user?.result || [])));
  const hasPAT = !!user?.pat;

  const [spinner, setSpinner] = useState({
    visible: false,
    message: "",
  });

  /* Load projects on page load */
  useEffect(() => {
    const projects = async (user: any) => {
      setSpinner({ visible: true, message: `Loading Projects...` });
      const res = await getProjects(user);
      if (res.status === 200) {
        setProjects(res.data);
        sessionStorage.setItem("dashboard_projects", JSON.stringify(res.data));
      } else {
        setProjects([]);
      }
      setSpinner({ visible: false, message: "" });
    };
    setMessage({ color: "", text: "" });
    projects(user);
  }, [project]);

  // Restore other transient state when component mounts
  useEffect(() => {
    const storedRange = sessionStorage.getItem("dashboard_range");
    if (storedRange) setRange(storedRange);
    const storedRunAll = sessionStorage.getItem("dashboard_runAll");
    if (storedRunAll) setRunAll(storedRunAll === "true");
  }, []);

  async function handleProjectChange(value: string) {
    setMessage({ color: "", text: "" });
    setRange("");
    setBuilds([]);
    setBuild(0);
    setSummary(null);
    setRunAll(false);
    setTests([]);
    setTest(0);
    // setResult([]);
    if (!value) {
      setProject("");
      sessionStorage.removeItem("dashboard_project");
      return;
    }
    setProject(value);
    sessionStorage.setItem("dashboard_project", value);
  }

  async function handleRangeChange(value: string) {
    setMessage({ color: "", text: "" });
    setBuilds([]);
    setBuild(0);
    setSummary(null);
    setRunAll(false);
    setTests([]);
    setTest(0);
    // setResult([]);
    if (!value) {
      setRange("");
      sessionStorage.removeItem("dashboard_range");
      return;
    }
    setSpinner({ visible: true, message: `Loading Builds...` });
    setRange(value);
    sessionStorage.setItem("dashboard_range", value);
    const res = await getBuilds(user, project, value);
    setBuilds(res.data);
    sessionStorage.setItem("dashboard_builds", JSON.stringify(res.data));
    if (res.data.length === 0) {
      setMessage({ color: "red", text: "No builds found for the selected range." });
      setRunAll(true);
    }
    setSpinner({ visible: false, message: "" });
  }

  async function handleBuildChange(value: string) {
    setTests([]);
    setTest(0);
    setSummary(null);
    setRunAll(false);
    // setResult([]);
    setMessage({ color: "", text: "" });
    if (!Number(value)) {
      setBuild(0);
      return;
    }
    setSpinner({ visible: true, message: `Loading result for Build #${value}...` });
    setBuild(Number(value));
    sessionStorage.setItem("dashboard_build", String(Number(value)));
    const res = await getTests(user, project, Number(value));
    setSummary(res.data.summary);
    sessionStorage.setItem("dashboard_summary", JSON.stringify(res.data.summary));
    if (res.status !== 200) {
      // setTests([]);
      setMessage({ color: "red", text: res.error });
    } else if (res.data.summary.failed === 0) {
      setMessage({ color: "red", text: "No failed tests extracted for the selected build." });
      setRunAll(false);
    } else {
      setMessage({ color: "", text: "" });
      setTests(res.data.failedTests);
      sessionStorage.setItem("dashboard_tests", JSON.stringify(res.data.failedTests));
    }
    setSpinner({ visible: false, message: "" });
  }

  async function handleRunAllChange() {
    setMessage({ color: "", text: "" });
    // setResult([]);
    setRunAll(!runAll);
    sessionStorage.setItem("dashboard_runAll", String(!runAll));
    if (!runAll) {
      setTest(0);
    }
  }

  function handleTestChange(value: number) {
    setMessage({ color: "", text: "" });
    setTest(value);
    sessionStorage.setItem("dashboard_test", String(value));
    // setResult([]);
  }

  async function handleRerun(runId: number, env: string, mode: string) {
    // setResult([]);
    setSpinner({ visible: true, message: `${runId > 0 ? "Re-running" : "Running"} ${runAll && runId < 0 ? tests.length : ""} ${runAll && runId < 0 ? "tests" : "test"}${mode === "debug" ? " in debug mode" : ""}...` });
    let res = null;
    if (runId < 0 && runAll) {
      res = await rerun(tests, mode, env);
    } else if (runId < 0 && !runAll) {
      res = await rerun(
        tests.filter((t) => t.id === test),
        mode,
        env,
      );
    } else {
      const test = [result.find((r) => r.runId === runId).test];
      res = await rerun(test as any[], mode, env);
    }
    if (res.status === 200) {
      setMessage({ color: "", text: "" });
      if (runId > 0) {
        const updatedResult = result.map((r) => {
          if (r.runId === runId) {
            return { ...res.data[0], test: result.find((item) => item.runId === runId).test, runId: r.runId, build: r.build, env: env, mode: mode, logs: cleanPlaywrightLogs(res.data[0].logs), isOpen: false };
          }
          return r;
        });
        setResult(updatedResult);
        reflectUserChanges({ ...user, result: updatedResult });
        sessionStorage.setItem("dashboard_result", JSON.stringify(updatedResult));
      } else if (runId < 0 && result.length > 0) {
        const testInfo = tests.find((t) => t.id === test);
        let emptyCounter = 0;
        let counter = result.length + 1;
        const updatedResult = [...result, ...res.data.map((r: any) => ({ ...r, test: test > 0 ? testInfo : tests[emptyCounter++], runId: test > 0 ? counter : counter++, build: build, env: env, mode: mode, logs: cleanPlaywrightLogs(r.logs), isOpen: false }))];
        setResult(updatedResult);
        reflectUserChanges({ ...user, result: updatedResult });
        sessionStorage.setItem("dashboard_result", JSON.stringify(updatedResult));
      } else {
        let counter = 0;
        const updatedResult = res.data.map((r: any) => ({ ...r, test: tests[counter++], runId: counter, build: build, env: env, mode: mode, logs: cleanPlaywrightLogs(r.logs), isOpen: false }));
        setResult(updatedResult);
        reflectUserChanges({ ...user, result: updatedResult });
        sessionStorage.setItem("dashboard_result", JSON.stringify(updatedResult));
      }
    } else {
      setMessage({ color: "red", text: res.error });
    }
    setSpinner({ visible: false, message: "" });
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
          background: "#fff",
          height: "55vh",
          color: "#000",
          padding: "2rem",
          fontFamily: "monospace",
          fontSize: "12px",
          overflowY: "auto",
          borderRadius: "10px",
          marginTop: "10px",
          boxSizing: "border-box",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="dashboard">
      <Filter projects={projects} builds={builds} tests={tests} summary={summary} hasPAT={hasPAT} spinner={spinner} message={message} project={project} range={range} build={build} test={test} env={env} runAll={runAll} handleProjectChange={handleProjectChange} handleRangeChange={handleRangeChange} handleBuildChange={handleBuildChange} handleTestChange={handleTestChange} handleRunAllChange={handleRunAllChange} setEnv={setEnv} handleRerun={handleRerun} />
      <Results result={result} spinner={spinner} setResult={setResult} handleRerun={handleRerun} LogsViewer={LogsViewer} />
      <Spinner visible={spinner.visible} message={spinner.message} />
    </div>
  );
}
