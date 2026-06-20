import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";
import { initials } from "~/lib/format";

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & Record<string, unknown>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}
export function CardHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card-head">
      <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
      {action}
    </div>
  );
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "soft"; size?: "sm" | "md"; icon?: string;
}
export function Button({ variant = "soft", size = "md", icon, children, className = "", ...rest }: BtnProps) {
  const v = variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : variant === "danger" ? "btn-danger" : "";
  return (
    <button className={`btn ${v} ${size === "sm" ? "btn-sm" : ""} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 16} />}{children}
    </button>
  );
}

export function Badge({ tone = "b-muted", children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Avatar({ name, color, size = 40, src }: { name: string; color?: string; size?: number; src?: string }) {
  if (src) return <img className="avatar" src={src} alt={name} style={{ width: size, height: size }} />;
  return (
    <span className="avatar" style={{ width: size, height: size, background: color ?? "#6366f1", fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function Field({ label, hint, required, children }: { label?: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="field">
      {label && <label>{label}{required && <span className="req">*</span>}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div><h1 className="page-title">{title}</h1>{sub && <p className="page-sub">{sub}</p>}</div>
      {action && <div className="head-actions">{action}</div>}
    </div>
  );
}

export function Kpi({ label, value, delta, icon, tone }: { label: string; value: ReactNode; delta?: ReactNode; icon?: string; tone?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className={`kpi-ico ${tone ?? ""}`}><Icon name={icon} size={16} /></span>}
      </div>
      <div className="kpi-value num">{value}</div>
      {delta != null && <div className="kpi-delta">{delta}</div>}
    </div>
  );
}

export function EmptyState({ icon = "file", title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} size={26} /></div>
      <h4>{title}</h4>{body && <p>{body}</p>}{action}
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="cluster" style={{ gap: 1 }} title={rating.toFixed(1)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={14} className={i <= Math.round(rating) ? "flag-high" : "dim"} />
      ))}
    </span>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-top">
          <h3>{title}</h3>
          <button className="icon-btn plain" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-content">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Toasts ----
type ToastKind = "success" | "error" | "info" | "warn";
interface Toast { id: number; kind: ToastKind; message: string; }
const ToastCtx = createContext<{ push: (k: ToastKind, m: string) => void } | null>(null);
const ICONS: Record<ToastKind, string> = { success: "✓", error: "✕", info: "i", warn: "!" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toaster">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role="status">
            <span className="t-ico">{ICONS[t.kind]}</span><span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  return useContext(ToastCtx) ?? { push: () => {} };
}
