export default function StatCard({ icon: Icon, label, value, hint, tone = "default" }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-icon"><Icon size={18} /></div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}