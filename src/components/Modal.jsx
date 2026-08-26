import { X } from "lucide-react";

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}