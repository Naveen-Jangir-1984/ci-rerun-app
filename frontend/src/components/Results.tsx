import { useAuth } from "../context/AuthContext";

interface ResultsProps {
  result: any[];
  spinner?: { visible: boolean; message: string };
  setResult: (value: any[]) => void;
  handleRerun: (id: number, env: string, mode: string) => Promise<void>;
  LogsViewer: React.FC<{ logs: string }>;
}

export default function Results({ result, spinner, setResult, handleRerun, LogsViewer }: ResultsProps) {
  const { user, reflectUserChanges } = useAuth();

  function handleDelete(runId: number) {
    const consent = window.confirm("Are you sure you want to delete this result?");
    if (!consent) return;
    const updatedResult = result.filter((item) => item.runId !== runId);
    setResult(updatedResult);
    reflectUserChanges({ ...user, result: updatedResult });
  }

  function handleShowHideLog(runId: number) {
    setResult(
      result.map((item) => {
        if (runId === item.runId) {
          item.isOpen = !item.isOpen;
        } else item.isOpen = false;
        return item;
      })
    );
  }

  return (
    <>
      {result.length > 0 ? (
        <div className="results" style={{ filter: spinner?.visible ? "blur(5px)" : "none" }}>
          {result.map((r, idx) => (
            <div key={idx} className="result">
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ width: "75%", display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "10px" }}>
                  <div style={{ backgroundColor: "#fff", border: "1px solid #ccc", borderRadius: "5px", padding: "0.25rem 0.5rem", fontSize: "11px" }}>#{r.build}</div>
                  <div style={{ backgroundColor: "#dde", border: "1px solid #ccc", borderRadius: "5px", padding: "0.25rem 0.5rem", fontSize: "11px" }}>{r.env.toUpperCase()}</div>
                  <div style={{ backgroundColor: r.status === "Passed" ? "#ada" : "#fdd", border: "1px solid #ccc", borderRadius: "5px", padding: "0.25rem 0.5rem", fontSize: "11px" }}>{r.status}</div>
                  <div style={{ fontSize: "14px" }}>
                    {r.test.featureName} → {r.test.scenarioName} {r.test.example ? `(${r.test.example})` : ""}
                  </div>
                </div>
                <div style={{ width: "25%", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px" }}>
                  <button className="small-button" onClick={() => handleShowHideLog(r.runId)}>
                    {`${r.isOpen ? "Hide" : "Show"} Log`}
                  </button>
                  <button className="small-button" onClick={() => handleRerun(r.runId, r.env, r.mode)}>
                    Rerun
                  </button>
                  <button className="small-button danger" onClick={() => handleDelete(r.runId)}>
                    Delete
                  </button>
                </div>
              </div>
              {r.isOpen && <LogsViewer logs={r.logs} />}
            </div>
          ))}
        </div>
      ) : (
        <div className="results empty" style={{ filter: spinner?.visible ? "blur(5px)" : "none" }}>
          <span>Rerun result will be displayed here.</span>
        </div>
      )}
    </>
  );
}
