export default function Placeholder({ title, desc }) {
  return (
    <div className="panel">
      <div className="placeholder">
        <div className="big">{title}</div>
        <div>{desc}</div>
        <div style={{ marginTop: 12, fontSize: 13 }}>準備中</div>
      </div>
    </div>
  );
}
