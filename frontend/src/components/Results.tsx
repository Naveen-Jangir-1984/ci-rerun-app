import { useState } from "react";
import { downloadResults } from "../api";
import { useAuth } from "../context/AuthContext";
import AnsiToHtml from "ansi-to-html";

interface ResultsProps {
  state: any;
  dispatch: any;
  cleanPlaywrightLogs: (logs: string) => string;
  handleRerun: (runId: number, build: any, env: string, mode: string) => void;
}

export default function Results({ state, dispatch, cleanPlaywrightLogs, handleRerun }: ResultsProps) {
  const { user, update } = useAuth();
  const [selectedResults, setSelectedResults] = useState<number[]>([]);

  const ansiConverter = new AnsiToHtml({
    fg: "#FFF",
    bg: "#FFF",
    newline: true,
    escapeXML: true,
  });

  const LogsViewer = ({ logs }: { logs: string }) => {
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
  };

  const handleDownloadResults = async (selectedResults: number[]) => {
    dispatch({ type: "SET_SPINNER", payload: { visible: true, message: `Downloading results...` } });
    try {
      let blob = null;
      if (selectedResults.length === 0) {
        blob = await downloadResults(state.result);
      } else {
        const resultsToDownload = state.result.filter((r: any) => selectedResults.includes(r.runId));
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
      dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
    } catch (error) {
      dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
      dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "❌ Failed to download file." } });
    }
  };

  const handleDelete = (runId: number) => {
    const consent = window.confirm("Are you sure you want to delete?");
    if (!consent) return;
    const updatedResult = user.results.filter((item: any) => item.runId !== runId);
    dispatch({ type: "SET_RESULT", payload: updatedResult });
    update({ result: updatedResult });
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      dispatch({ type: "SET_RESULT", payload: user.results });
      update({ result: user.results.map((r: any) => ({ ...r, isOpen: false })) });
      return;
    }
    const filteredResult = user.results.filter((r: any) => {
      const searchableBuildDate = r.build.date.toLowerCase().replace(/[-\/]/g, ""); // Remove separators for more flexible searching
      const searchableRunDate = r.date.toLowerCase().replace(/[-\/]/g, ""); // Remove separators for more flexible searching
      return r.test.featureName.toLowerCase().includes(query) || r.test.scenarioName.toLowerCase().includes(query) || (r.test.example && r.test.example.toLowerCase().includes(query)) || r.status.toLowerCase().includes(query) || r.env.toLowerCase().includes(query) || r.date.toLowerCase().includes(query) || searchableBuildDate.includes(query.replace(/[-\/]/g, "")) || searchableRunDate.includes(query.replace(/[-\/]/g, "")) || String(`#${r.build}`).includes(query) || r.mode.toLowerCase().includes(query);
    });
    dispatch({ type: "SET_RESULT", payload: filteredResult.map((r: any) => ({ ...r, isOpen: false })) });
    update({ result: user.results.map((r: any) => ({ ...r, isOpen: false })) });
  };

  const handleShowHideLog = (runId: number) => {
    const updatedResult = state.result.map((item: any) => {
      if (runId === item.runId) {
        item.isOpen = !item.isOpen;
      } else item.isOpen = false;
      return item;
    });
    dispatch({ type: "SET_RESULT", payload: updatedResult });
    update({ result: updatedResult });
  };

  const handleSelection = (runId: number, isChecked: boolean) => {
    if (isChecked) {
      setSelectedResults((prev) => [...prev, runId]);
    } else {
      setSelectedResults((prev) => prev.filter((id) => id !== runId));
    }
  };

  const totalCount = user.results.length;
  const searchedCount = state.result.length;
  const selectedCount = selectedResults.length;
  const isSearchActive = searchedCount !== totalCount;

  return (
    <div style={{ display: "flex", width: "65%", height: "100%", flexDirection: "column", gap: "10px", filter: state.spinner?.visible ? "blur(5px)" : "none" }}>
      <div style={{ width: "100%", height: "30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <input disabled={state.spinner?.visible || user.results.length === 0} style={{ fontSize: "12px", width: "80%", height: "100%" }} type="text" placeholder="search results..." onChange={handleSearch} />
        <button className="medium-button" style={{ width: "auto" }} disabled={state.spinner?.visible || state.result.length === 0} onClick={() => handleDownloadResults(selectedResults)}>
          {selectedCount > 0 ? `Download Selected (${selectedCount})` : isSearchActive ? `Download Searched (${searchedCount})` : `Download All`}
        </button>
      </div>
      {state.result.length > 0 ? (
        <div className="results">
          {state.result.map((r: any, idx: number) => (
            <div key={idx} className="card">
              <label htmlFor={`reran-${r.runId}`} style={{ height: "100%", padding: "0 10px", display: "flex", justifyContent: "center", alignItems: "center", borderRadius: "5px" }}>
                <input id={`reran-${r.runId}`} type="checkbox" checked={selectedResults.includes(r.runId)} onChange={() => handleSelection(r.runId, !selectedResults.includes(r.runId))} />
              </label>
              <div className="result">
                <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: "5px" }}>
                  <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "5px", color: "#999", fontSize: "11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ backgroundColor: "#fff", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Failed on ${r.build.date}`}</div>
                      <div style={{ backgroundColor: "#fff", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Pipeline: ${r.build.pipelineName}`}</div>
                      <div style={{ backgroundColor: "#fff", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Build #${r.build.buildId}`}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ backgroundColor: "#fff", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Reran on ${r.date}`}</div>
                      <div style={{ backgroundColor: "#fff", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Environment ${r.env.toUpperCase()}`}</div>
                    </div>
                  </div>
                  <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "10px", width: "75%" }}>
                      <div style={{ backgroundColor: r.status === "Passed" ? "#ada" : "#fdd", border: "1px solid #ccc", borderRadius: "5px", padding: "0.25rem 0.5rem" }}>{r.status}</div>
                      <div style={{ lineHeight: "1.5", width: "100%" }}>
                        <span>{`${r.test.featureName} →`}</span>
                        <span style={{ marginLeft: "5px", color: "#777", fontStyle: "italic" }}>{r.test.scenarioName}</span> {r.test.example ? <span style={{ marginLeft: "5px", backgroundColor: "#ccc", color: "#555", padding: "5px 7px", borderRadius: "5px", fontSize: "11px" }}>{r.test.example}</span> : ""}
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
            </div>
          ))}
        </div>
      ) : (
        <div className="results empty" style={{ filter: state.spinner?.visible ? "blur(5px)" : "none" }}>
          <span style={{ fontStyle: "italic" }}>No results to display.</span>
        </div>
      )}
    </div>
  );
}
