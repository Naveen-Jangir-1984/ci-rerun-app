export default function Spinner({ visible, message }: { visible: boolean; message: string }) {
  return (
    <div className="spinner-container" style={{ display: visible ? "flex" : "none" }}>
      {visible && (
        <div className="spinner-block">
          <div className="spinner"></div>
          <div>{message}</div>
        </div>
      )}
    </div>
  );
}
