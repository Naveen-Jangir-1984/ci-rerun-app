import { useEffect, useState } from "react";
import { getProjects, getBuilds, getTests, rerun, downloadFailures, downloadResults } from "../api";
import { useAuth } from "../context/AuthContext";
import AnsiToHtml from "ansi-to-html";
import stripAnsi from "strip-ansi";
import Filter from "../components/Filter";
import Results from "../components/Results";
import Spinner from "../components/Spinner";

export default function Dashboard() {
  const { user, update } = useAuth();
  const [projects, setProjects] = useState<any[]>(() => JSON.parse(sessionStorage.getItem("projects") || "[]"));
  const [project, setProject] = useState<string>(() => sessionStorage.getItem("project") || "");

  const [builds, setBuilds] = useState<any[]>(() => JSON.parse(sessionStorage.getItem("builds") || "[]"));
  const [range, setRange] = useState(() => sessionStorage.getItem("range") || "");
  const [build, setBuild] = useState<number>(() => Number(sessionStorage.getItem("build") || 0));
  const [runAll, setRunAll] = useState<boolean>(() => (sessionStorage.getItem("runAll") === "true" ? true : false));

  const [summary, setSummary] = useState<any>(() => JSON.parse(sessionStorage.getItem("summary") || "null"));
  const [tests, setTests] = useState<any[]>(() => JSON.parse(sessionStorage.getItem("tests") || "[]"));
  const [test, setTest] = useState<number[]>(() => JSON.parse(sessionStorage.getItem("test") || "[]"));
  const [env, setEnv] = useState<string>(() => sessionStorage.getItem("env") || "qa");

  const [message, setMessage] = useState({ color: "", text: "" });
  const [result, setResult] = useState<any[]>(() => user?.results || []);
  const hasPAT = !!user?.pat;

  const [spinner, setSpinner] = useState({
    visible: false,
    message: "",
  });

  /* Load projects on page load */
  useEffect(() => {
    const projects = async (user: any) => {
      setSpinner({ visible: true, message: `Please wait...` });
      const res = await getProjects(user);
      if (res.status === 200) {
        setProjects(res.data);
        sessionStorage.setItem("projects", JSON.stringify(res.data));
      } else {
        setProjects([]);
      }
      setSpinner({ visible: false, message: "" });
    };
    setMessage({ color: "", text: "" });
    projects(user);
  }, [project]);

  async function handleProjectChange(value: string) {
    setMessage({ color: "", text: "" });
    setRange("");
    setBuilds([]);
    setBuild(0);
    setSummary(null);
    setRunAll(false);
    setTests([]);
    setTest([]);
    if (!value) {
      setProject("");
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
    setProject(value);
    sessionStorage.setItem("project", value);
  }

  async function handleRangeChange(value: string) {
    setMessage({ color: "", text: "" });
    setBuilds([]);
    setBuild(0);
    setSummary(null);
    setRunAll(false);
    setTests([]);
    setTest([]);
    if (!value) {
      setRange("");
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
    setSpinner({ visible: true, message: `Loading Builds...` });
    setRange(value);
    sessionStorage.setItem("range", value);
    const res = await getBuilds(user, project, value);
    setBuilds(res.data);
    sessionStorage.setItem("builds", JSON.stringify(res.data));
    if (res.data.length === 0) {
      setMessage({ color: "red", text: "No builds found for the selected range." });
      setRunAll(true);
    }
    setSpinner({ visible: false, message: "" });
  }

  async function handleBuildChange(value: string) {
    setTests([]);
    setTest([]);
    setSummary(null);
    setRunAll(false);
    setMessage({ color: "", text: "" });
    if (!Number(value)) {
      setBuild(0);
      sessionStorage.removeItem("build");
      sessionStorage.removeItem("tests");
      sessionStorage.removeItem("summary");
      sessionStorage.removeItem("runAll");
      sessionStorage.removeItem("test");
      sessionStorage.removeItem("env");
      return;
    }
    setSpinner({ visible: true, message: `Loading Build #${value} result...` });
    setBuild(Number(value));
    sessionStorage.setItem("build", String(Number(value)));
    const res = await getTests(user, project, Number(value));
    setSummary(res.data.summary);
    sessionStorage.setItem("summary", JSON.stringify(res.data.summary));
    if (res.status !== 200) {
      setMessage({ color: "red", text: res.error });
    } else if (res.data.summary.failed === 0) {
      setMessage({ color: "red", text: "No failed tests extracted for the selected build." });
      setRunAll(false);
    } else {
      setMessage({ color: "", text: "" });
      setTests(res.data.failedTests);
      sessionStorage.setItem("tests", JSON.stringify(res.data.failedTests));
    }
    setSpinner({ visible: false, message: "" });
  }

  async function handleRunAllChange() {
    setMessage({ color: "", text: "" });
    setRunAll(!runAll);
    sessionStorage.setItem("runAll", String(!runAll));
    if (!runAll) {
      setTest([]);
      setEnv("qa");
      sessionStorage.removeItem("test");
      sessionStorage.setItem("env", "qa");
    }
  }

  function handleTestChange(value: number[]) {
    setMessage({ color: "", text: "" });
    setTest(value);
    sessionStorage.setItem("test", JSON.stringify(value));
  }

  async function handleRerun(runId: number, build: any, env: string, mode: string) {
    const isRerun = runId > 0;
    const isRunAll = runId < 0 && runAll;
    const testCount = isRunAll ? tests.length : test.length ? test.length : 1;
    const testLabel = isRunAll ? "tests" : "test";
    const debugMode = mode === "debug" ? " in debug mode" : "";

    setSpinner({
      visible: true,
      message: `${isRerun ? "Re-running" : "Running"} ${testCount} ${testLabel}${debugMode}...`,
    });

    // Determine which tests to run
    let testsToRun;
    if (isRunAll) {
      testsToRun = tests;
    } else if (runId < 0) {
      testsToRun = tests.filter((t) => test.includes(t.id));
    } else {
      testsToRun = [result.find((r) => r.runId === runId)?.test];
    }

    const res = await rerun(testsToRun as any[], mode, env);

    if (res.status === 200) {
      setMessage({ color: "", text: "" });
      const formattedDateTime = new Date().toLocaleString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const closeAllLogs = result.map((r) => ({ ...r, isOpen: false }));

      let updatedResult;
      if (isRerun) {
        updatedResult = closeAllLogs.map((r) =>
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
      } else if (result.length > 0) {
        const testInfo = tests.filter((t) => test.includes(t.id));
        const baseRunId = result.length + 1;
        const newResults = res.data.map((r: any, idx: number) => ({
          ...r,
          test: test.length > 0 ? testInfo[idx] : tests[idx],
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
          test: tests[idx],
          runId: idx + 1,
          build,
          env,
          mode,
          logs: cleanPlaywrightLogs(r.logs),
          isOpen: test.length === 1,
          date: formattedDateTime,
        }));
      }

      setResult(updatedResult);
      update({ result: updatedResult });
      sessionStorage.setItem("user", JSON.stringify({ ...user, result: updatedResult }));
    } else {
      setMessage({ color: "red", text: res.error });
    }

    setSpinner({ visible: false, message: "" });
  }

  const handleDownloadFailures = async () => {
    setSpinner({
      visible: true,
      message: `Downloading failures...`,
    });
    try {
      const blob = await downloadFailures(build, tests);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Failures_#${build}_${new Date().toISOString().replace(/[.Z]/g, "").replaceAll(/_/g, ":").replace("T", "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSpinner({ visible: false, message: "" });
    } catch (error) {
      setSpinner({ visible: false, message: "" });
      setMessage({ color: "red", text: "❌ Failed to download file." });
    }
  };

  const handleDownloadResults = async (selectedResults: number[]) => {
    setSpinner({
      visible: true,
      message: `Downloading results...`,
    });
    try {
      let blob = null;
      if (selectedResults.length === 0) {
        blob = await downloadResults(result);
      } else {
        const resultsToDownload = result.filter((r) => selectedResults.includes(r.runId));
        blob = await downloadResults(resultsToDownload);
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Reruns_${new Date().toISOString().replace(/[.Z]/g, "").replaceAll(/_/g, ":").replace("T", "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSpinner({ visible: false, message: "" });
    } catch (error) {
      setSpinner({ visible: false, message: "" });
      setMessage({ color: "red", text: "❌ Failed to download file." });
    }
  };

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
      <Filter projects={projects} builds={builds} tests={tests} summary={summary} hasPAT={hasPAT} spinner={spinner} message={message} project={project} range={range} build={build} test={test} env={env} runAll={runAll} handleProjectChange={handleProjectChange} handleRangeChange={handleRangeChange} handleBuildChange={handleBuildChange} handleTestChange={handleTestChange} handleRunAllChange={handleRunAllChange} setEnv={setEnv} handleRerun={handleRerun} handleDownloadFailures={handleDownloadFailures} />
      <Results result={result} spinner={spinner} setResult={setResult} handleRerun={handleRerun} handleDownloadResults={handleDownloadResults} LogsViewer={LogsViewer} />
      <Spinner visible={spinner.visible} message={spinner.message} />
    </div>
  );
}
