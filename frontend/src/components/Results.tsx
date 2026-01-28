import { useState, useMemo, useCallback } from "react";
import { downloadResults } from "../api";
import { useAuth } from "../context/AuthContext";
import AnsiToHtml from "ansi-to-html";

interface ResultsProps {
  state: any;
  dispatch: any;
  cleanPlaywrightLogs: (logs: string) => string;
  handleRerun: (runId: number, build: any, env: string, mode: string) => void;
}

// Constants
const ANSI_CONVERTER = new AnsiToHtml({
  fg: "#FFF",
  bg: "#FFF",
  newline: true,
  escapeXML: true,
});

// Helper functions
const removeSearchSeparators = (text: string): string => {
  return text.toLowerCase().replace(/[-\/]/g, "");
};

const generateFileName = (): string => {
  return `Reruns_${new Date().toISOString().replace(/[.Z]/g, "").replaceAll(/_/g, ":").replace("T", "_")}.xlsx`;
};

const matchesSearchQuery = (result: any, query: string): boolean => {
  const lowerQuery = query.toLowerCase();
  const normalizedQuery = removeSearchSeparators(lowerQuery);

  const searchFields = [result.test.featureName.toLowerCase(), result.test.scenarioName.toLowerCase(), result.test.example?.toLowerCase() || "", result.status.toLowerCase(), result.env.toLowerCase(), result.date.toLowerCase(), result.mode.toLowerCase(), `#${result.build.buildId}`];

  const dateFields = [removeSearchSeparators(result.build.date), removeSearchSeparators(result.date)];

  return searchFields.some((field) => field.includes(lowerQuery)) || dateFields.some((field) => field.includes(normalizedQuery));
};

// LogsViewer component
const LogsViewer = ({ logs, cleanLogs }: { logs: string; cleanLogs: (logs: string) => string }) => {
  const html = useMemo(() => ANSI_CONVERTER.toHtml(cleanLogs(logs)), [logs, cleanLogs]);

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

export default function Results({ state, dispatch, cleanPlaywrightLogs, handleRerun }: ResultsProps) {
  const { user, update } = useAuth();
  const [selectedResults, setSelectedResults] = useState<number[]>([]);

  const totalCount = useMemo(() => user.results?.length || 0, [user.results]);
  const searchedCount = useMemo(() => state.result?.length || 0, [state.result]);
  const selectedCount = selectedResults.length;
  const isSearchActive = searchedCount !== totalCount;

  const handleDownloadResults = useCallback(
    async (selectedIds: number[]) => {
      const consent = window.confirm("Do you want to download the results?");
      if (!consent) return;
      dispatch({ type: "SET_SPINNER", payload: { visible: true, message: "Downloading results..." } });

      try {
        const resultsToDownload = selectedIds.length === 0 ? state.result : state.result.filter((r: any) => selectedIds.includes(r.runId));

        const blob = await downloadResults(resultsToDownload);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = generateFileName();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        dispatch({ type: "SET_MESSAGE", payload: { color: "red", text: "❌ Failed to download file." } });
      } finally {
        dispatch({ type: "SET_SPINNER", payload: { visible: false, message: "" } });
      }
    },
    [dispatch, state.result],
  );

  const handleDelete = useCallback(
    (runId: number) => {
      const consent = window.confirm("Are you sure you want to delete this result?");
      if (!consent) return;

      const updatedResult = user.results.filter((item: any) => item.runId !== runId);
      dispatch({ type: "SET_RESULT", payload: updatedResult });
      update({ result: updatedResult });
    },
    [user.results, dispatch, update],
  );

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value.trim();

      if (!query) {
        dispatch({ type: "SET_RESULT", payload: user.results });
        return;
      }

      const filteredResult = user.results.filter((r: any) => matchesSearchQuery(r, query)).map((r: any) => ({ ...r, isOpen: false }));
      dispatch({ type: "SET_RESULT", payload: filteredResult });
    },
    [user.results, dispatch],
  );

  const handleShowHideLog = useCallback(
    (runId: number) => {
      const updatedResult = state.result.map((item: any) => ({
        ...item,
        isOpen: item.runId === runId ? !item.isOpen : item.isOpen,
      }));

      dispatch({ type: "SET_RESULT", payload: updatedResult });
      update({ result: updatedResult });
    },
    [state.result, dispatch, update],
  );

  const handleSelection = useCallback((runId: number, isChecked: boolean) => {
    setSelectedResults((prev) => (isChecked ? [...prev, runId] : prev.filter((id) => id !== runId)));
  }, []);

  const downloadButtonLabel = useMemo(() => {
    if (selectedCount > 0) return `Download Selected (${selectedCount})`;
    if (isSearchActive) return `Download Searched (${searchedCount})`;
    return "Download All";
  }, [selectedCount, isSearchActive, searchedCount]);

  return (
    <div style={{ display: "flex", width: "65%", height: "100%", flexDirection: "column", gap: "10px", filter: state.spinner?.visible ? "blur(5px)" : "none" }}>
      <div style={{ width: "100%", height: "30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <input disabled={state.spinner?.visible || user.results.length === 0} style={{ fontSize: "12px", width: "85%", height: "100%" }} type="text" placeholder="search..." onChange={handleSearch} />
        <button className="medium-button" style={{ width: "auto" }} disabled={state.spinner?.visible || state.result.length === 0} onClick={() => handleDownloadResults(selectedResults)}>
          {downloadButtonLabel}
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
                      <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Failed on ${r.build.date}`}</div>
                      <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Pipeline: ${r.build.pipelineName}`}</div>
                      <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Build #${r.build.buildId}`}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Reran on ${r.date}`}</div>
                      <div style={{ backgroundColor: "#eee", border: "1px solid #ccc", borderRadius: "5px", padding: "0.2rem 0.5rem" }}>{`Environment ${r.env.toUpperCase()}`}</div>
                    </div>
                  </div>
                  <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "10px", width: "75%" }}>
                      <div style={{ backgroundColor: r.status === "Passed" ? "#ada" : "#fdd", border: "1px solid #ccc", borderRadius: "5px", padding: "0.25rem 0.5rem" }}>{r.status}</div>
                      <div style={{ lineHeight: "1.5", width: "100%" }}>
                        <span>{`${r.test.featureName} →`}</span>
                        <span style={{ marginLeft: "5px", color: "#777", fontStyle: "italic" }}>{r.test.scenarioName}</span> {r.test.example ? <span style={{ marginLeft: "5px", backgroundColor: "#ddd", color: "#555", padding: "5px 7px", borderRadius: "5px", fontSize: "11px" }}>{r.test.example}</span> : ""}
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
                {r.isOpen && <LogsViewer logs={r.logs} cleanLogs={cleanPlaywrightLogs} />}
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
