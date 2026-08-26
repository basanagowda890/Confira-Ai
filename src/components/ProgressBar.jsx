export default function ProgressBar({ value, label, tone = "" }) {
  return (
    <div className="progress-wrap">
      {label && <div className="progress-head"><span>{label}</span><b>{value}%</b></div>}
      <div className="progress-track"><div className={`progress-fill ${tone}`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}