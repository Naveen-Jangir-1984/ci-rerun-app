import { useEffect, useState } from "react";
import { getProjects, getBuilds, getTests, rerun } from "../api";
import { useAuth } from "../context/AuthContext";
import AnsiToHtml from "ansi-to-html";
import stripAnsi from "strip-ansi";
import Filter from "../components/Filter";
import Results from "../components/Results";
import Spinner from "../components/Spinner";

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [project, setProject] = useState<string>("");

  const [builds, setBuilds] = useState<any[]>([]);
  const [range, setRange] = useState("");
  const [build, setBuild] = useState<number>(0);
  const [runAll, setRunAll] = useState<boolean>(false);

  const [summary, setSummary] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [test, setTest] = useState<number>(0);
  const [env, setEnv] = useState<string>("qa");

  const [message, setMessage] = useState({ color: "", text: "" });
  const [result, setResult] = useState<any[]>([]);
  const hasPAT = !!user?.pat;

  const [spinner, setSpinner] = useState({
    visible: false,
    message: "",
  });

  /* Load projects on page load */
  useEffect(() => {
    const projects = async (user: any) => {
      setSpinner({ visible: true, message: "Loading projects..." });
      const res = await getProjects(user);
      if (res.status === 200) {
        setProjects(res.data);
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
    setTest(0);
    setResult([]);
    if (!value) {
      setProject("");
      return;
    }
    setProject(value);
  }

  async function handleRangeChange(value: string) {
    setMessage({ color: "", text: "" });
    setBuilds([]);
    setBuild(0);
    setSummary(null);
    setRunAll(false);
    setTests([]);
    setTest(0);
    setResult([]);
    if (!value) {
      setRange("");
      return;
    }
    setSpinner({ visible: true, message: "Loading builds..." });
    setRange(value);
    const res = await getBuilds(user, project, value);
    setBuilds(res.data);
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
    setResult([]);
    setMessage({ color: "", text: "" });
    if (!Number(value)) {
      setBuild(0);
      return;
    }
    setSpinner({ visible: true, message: "Loading pipeline results..." });
    setBuild(Number(value));
    const res = await getTests(user, project, Number(value));
    setSummary(res.data.summary);
    if (res.status !== 200) {
      setTests([]);
      setMessage({ color: "red", text: res.error });
    } else if (res.data.summary.failed === 0) {
      setMessage({ color: "red", text: "No failed tests extracted for the selected build." });
      setRunAll(false);
    } else {
      setMessage({ color: "", text: "" });
      setTests(res.data.failedTests);
    }
    setSpinner({ visible: false, message: "" });
  }

  async function handleRunAllChange() {
    setMessage({ color: "", text: "" });
    setResult([]);
    setRunAll(!runAll);
    if (!runAll) {
      setTest(0);
    }
  }

  function handleTestChange(value: number) {
    setMessage({ color: "", text: "" });
    setTest(value);
    setResult([]);
  }

  async function handleRerun(mode: string) {
    setResult([]);
    setSpinner({ visible: true, message: `${mode === "debug" ? "Please wait for Playwright Inspector and Browser to open" : `Running ${runAll ? tests.length : ""} ${runAll ? "tests" : "test"}`}...` });
    const res = await rerun(runAll ? tests : (tests.filter((t) => t.id === test) as any[]), mode, env);
    if (res.status === 200) {
      setMessage({ color: "", text: "" });
      setResult(res.data.map((r: any) => ({ ...r, logs: cleanPlaywrightLogs(r.logs), isOpen: false })));
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
          background: "#000",
          height: "55vh",
          color: "#fff",
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

      <Results result={result} setResult={setResult} LogsViewer={LogsViewer} />
      <Spinner visible={spinner.visible} message={spinner.message} />
    </div>
  );
}
