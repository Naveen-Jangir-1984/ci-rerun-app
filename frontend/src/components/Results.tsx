interface ResultsProps {
  result: any[];
  setResult: (value: any[]) => void;
  LogsViewer: React.FC<{ logs: string }>;
}

export default function Results({ result, setResult, LogsViewer }: ResultsProps) {
  return (
    <>
      {result.length > 0 ? (
        <div className="results">
          {result.map((r, idx) => (
            <div key={idx} className="result">
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
                <div style={{ width: "80%", display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "10px" }}>
                  <div style={{ color: r.status === "Passed" ? "green" : "red" }}>{` (${r.status})`}</div>
                  <div>{`${r.title}`}</div>
                </div>
                <button
                  className="medium-button"
                  onClick={() => {
                    setResult(
                      result.map((item) => {
                        if (r.title === item.title) {
                          item.isOpen = !item.isOpen;
                        } else item.isOpen = false;
                        return item;
                      })
                    );
                  }}
                >
                  {r.isOpen ? "Hide Logs" : "Show Logs"}
                </button>
              </div>
              {r.isOpen && <LogsViewer logs={r.logs} />}
            </div>
          ))}
        </div>
      ) : (
        <div className="results empty">
          <span>Rerun result will be displayed here.</span>
        </div>
      )}
    </>
  );
}
