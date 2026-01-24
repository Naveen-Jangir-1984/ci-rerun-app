import { useAuth } from "../context/AuthContext";

interface ResultsProps {
  result: any[];
  spinner?: { visible: boolean; message: string };
  setResult: (value: any[]) => void;
  handleRerun: (id: number, build: any, env: string, mode: string) => Promise<void>;
  LogsViewer: React.FC<{ logs: string }>;
}

export default function Results({ result, spinner, setResult, handleRerun, LogsViewer }: ResultsProps) {
  const { user, update } = useAuth();

  function handleDelete(runId: number) {
    const consent = window.confirm("Are you sure you want to delete?");
    if (!consent) return;
    const updatedResult = user.results.filter((item: any) => item.runId !== runId);
    setResult(updatedResult);
    update({ result: updatedResult });
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value.toLowerCase();
    if (!query) {
      setResult(user.results);
      update({ result: user.results.map((r: any) => ({ ...r, isOpen: false })) });
      return;
    }
    const filteredResult = user.results.filter((r: any) => {
      const searchableBuildDate = r.build.date.toLowerCase().replace(/[-\/]/g, ""); // Remove separators for more flexible searching
      const searchableRunDate = r.date.toLowerCase().replace(/[-\/]/g, ""); // Remove separators for more flexible searching
      return r.test.featureName.toLowerCase().includes(query) || r.test.scenarioName.toLowerCase().includes(query) || (r.test.example && r.test.example.toLowerCase().includes(query)) || r.status.toLowerCase().includes(query) || r.env.toLowerCase().includes(query) || r.date.toLowerCase().includes(query) || searchableBuildDate.includes(query.replace(/[-\/]/g, "")) || searchableRunDate.includes(query.replace(/[-\/]/g, "")) || String(`#${r.build}`).includes(query) || r.mode.toLowerCase().includes(query);
    });
    setResult(filteredResult.map((r: any) => ({ ...r, isOpen: false })));
    update({ result: user.results.map((r: any) => ({ ...r, isOpen: false })) });
  }

  function handleShowHideLog(runId: number) {
    const updatedResult = result.map((item) => {
      if (runId === item.runId) {
        item.isOpen = !item.isOpen;
      } else item.isOpen = false;
      return item;
    });
    setResult(updatedResult);
    update({ result: updatedResult });
  }

  return (
    <div style={{ display: "flex", width: "65%", height: "100%", flexDirection: "column", gap: "10px", filter: spinner?.visible ? "blur(5px)" : "none" }}>
      <input disabled={spinner?.visible || user.results.length === 0} style={{ fontSize: "12px", width: "100%", height: "40px" }} type="text" placeholder="search results..." onChange={handleSearch} />
      {result.length > 0 ? (
        <div className="results">
          {result.map((r, idx) => (
            <div key={idx} className="result">
              <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "7px" }}>
                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "5px", color: "#555" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px" }}>
                    <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`${r.build.pipelineName}`}</div>
                    <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`#${r.build.buildId}`}</div>
                    <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{r.env.toUpperCase()}</div>
                    <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{r.build.date}</div>
                  </div>
                  <div style={{ borderRadius: "5px", padding: "0.2rem", fontSize: "11px" }}>{r.date}</div>
                </div>
                <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "10px", width: "75%" }}>
                    <div style={{ backgroundColor: r.status === "Passed" ? "#ada" : "#fdd", border: "1px solid #ccc", borderRadius: "5px", padding: "0.25rem 0.5rem", fontSize: "12px" }}>{r.status}</div>
                    <div style={{ lineHeight: "1.5", fontSize: "12px", width: "65%" }}>
                      <span>{`${r.test.featureName} →`}</span>
                      <span style={{ marginLeft: "5px", color: "#c00" }}>{r.test.scenarioName}</span> {r.test.example ? <span style={{ marginLeft: "5px", backgroundColor: "#ccc", padding: "5px 7px", borderRadius: "5px", fontSize: "11px" }}>{r.test.example}</span> : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", width: "auto" }}>
                    <button className="small-button" onClick={() => handleShowHideLog(r.runId)}>
                      {`${r.isOpen ? "Hide" : "Show"}.Log`}
                    </button>
                    <button className="small-button" onClick={() => handleRerun(r.runId, r.build, r.env, r.mode)}>
                      {r.mode === "rerun" ? "Re.run" : "Re.debug"}
                    </button>
                    <button className="small-button danger" onClick={() => handleDelete(r.runId)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
              {r.isOpen && <LogsViewer logs={r.logs} />}
            </div>
          ))}
        </div>
      ) : (
        <div className="results empty" style={{ filter: spinner?.visible ? "blur(5px)" : "none" }}>
          <span style={{ fontStyle: "italic" }}>No results to display.</span>
        </div>
      )}
    </div>
  );
}
