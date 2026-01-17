export default function Spinner({ visible, message }: { visible: boolean; message: string }) {
  return (
    <div className="spinner-container" style={{ display: visible ? "block" : "none" }}>
      {visible && (
        <div className="spinner-block">
          <div className="spinner"></div>
          <h4>{message}</h4>
        </div>
      )}
    </div>
  );
}
