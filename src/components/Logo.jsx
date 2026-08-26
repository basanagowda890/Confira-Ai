import { ScanFace } from "lucide-react";
import { Link } from "react-router-dom";

export default function Logo({ dark = false }) {
  return (
    <Link className={`brand ${dark ? "brand-dark" : ""}`} to="/">
      <span className="brand-mark"><ScanFace size={20} /></span>
      <span>confira</span>
    </Link>
  );
}