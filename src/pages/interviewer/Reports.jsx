import { useEffect, useState } from "react";
import { Download, FileText, Share2, Printer, CheckCircle2 } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import ProgressBar from "../../components/ProgressBar";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";

export default function Reports() {
  const [interviews, setInterviews] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [report, setReport] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/interviews")
      .then(({ data }) => {
        const list = data || [];
        setInterviews(list);
        if (list[0]) {
          setSelectedId(list[0].id);
          api.get(`/reports/${list[0].id}`)
            .then(response => setReport(response.data))
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function selectInterview(id) {
    setSelectedId(id);
    try {
      const response = await api.get(`/reports/${id}`);
      setReport(response.data);
    } catch {
      setReport(null);
    }
  }

  function handleShare() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setToast("Report link copied to clipboard!");
      setTimeout(() => setToast(""), 2500);
    }
  }

  const interview = interviews.find(item => item.id === selectedId);
  const scores = report?.content?.scores || {};
  const candidateName =
    interview?.candidate?.full_name ||
    interview?.profiles?.full_name ||
    (interview?.title?.includes("—") ? interview.title.split("—")[1]?.trim() : "") ||
    "Candidate";

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />

      <SectionTitle
        eyebrow="REPORTS"
        title={`${candidateName} — Interview report`}
        description={interview ? `${candidateName} · ${interview.title}` : "Reports generated from completed interviews."}
        action={
          <div className="btn-group">
            <button className="btn btn-outline" type="button" onClick={handleShare}>
              <Share2 size={15} /> Share Link
            </button>
            <button className="btn btn-primary" type="button" onClick={() => window.print()}>
              <Download size={15} /> Download PDF
            </button>
          </div>
        }
      />

      <div className="candidate-picker card" style={{ marginBottom: "18px" }}>
        <div>
          <h3>Select candidate interview report</h3>
          <p>Review comprehensive scorecards and integrity evaluations.</p>
        </div>
        <select value={selectedId} onChange={event => selectInterview(event.target.value)}>
          {interviews.map(item => (
            <option value={item.id} key={item.id}>
              {(item.candidate?.full_name || item.profiles?.full_name || (item.title?.includes("—") ? item.title.split("—")[1]?.trim() : "") || "Candidate")} · {item.title} ({item.status?.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {report ? (
        <>
          <div className="report-header card">
            <div className="report-score">
              <span>Overall score</span>
              <b>{scores.overall_score ?? "—"}</b>
              <Badge tone="info">{interview?.status}</Badge>
            </div>
            <div className="report-summary">
              <h3>Summary & Evaluation</h3>
              <p>{scores.summary || "No summary was added to this report."}</p>
            </div>
          </div>

          <div className="report-grid">
            <section className="card">
              <div className="card-head">
                <h3>Detailed Score Breakdown</h3>
                <FileText size={18} />
              </div>
              {[
                ["Technical round", scores.technical_score],
                ["Communication", scores.communication_score],
                ["Problem solving", scores.problem_solving_score],
                ["Confidence", scores.confidence_score],
                ["Behavioral", scores.behavioral_score]
              ].map(([label, value]) => (
                <ProgressBar key={label} label={label} value={value || 0} />
              ))}
            </section>

            <section className="card">
              <div className="card-head">
                <h3>Integrity & Proctoring Signals</h3>
                <Badge tone="info">Audit Log</Badge>
              </div>
              <p style={{ fontSize: "13px", lineHeight: "1.5" }}>
                {report.content?.monitoring_summary?.length || 0} monitoring events recorded during the live evaluation.
              </p>
            </section>
          </div>
        </>
      ) : (
        <p className="empty-state">No structured report is available for this interview yet.</p>
      )}
    </div>
  );
}