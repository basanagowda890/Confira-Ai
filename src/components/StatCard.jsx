export default function StatCard({ icon: Icon, label, value, hint, tone = "default" }) {
  const safeValue = (value !== null && typeof value === "object")
    ? (Array.isArray(value) ? value.length : 0)
    : value;

  return (
    <div className={`stat-card stat-${tone}`}>
      {Icon && (
        <div className="stat-icon">
          <Icon size={18} />
        </div>
      )}
      <div>
        <div className="stat-value">{safeValue}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}