import { useRef, useState, type ReactNode } from "react";
import { EmptyState } from "./ui";

export interface Column<T> {
  key: string; header: ReactNode; render: (row: T) => ReactNode;
  width?: number; align?: "left" | "right" | "center"; mono?: boolean;
}
interface Props<T> {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string;
  onRowClick?: (row: T) => void; empty?: { icon?: string; title: string; body?: string }; dense?: boolean;
}

// Resizable-column table. Drag a header's right edge to resize.
export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, dense }: Props<T>) {
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.filter((c) => c.width).map((c) => [c.key, c.width as number])));
  const drag = useRef<{ key: string; x: number; w: number } | null>(null);

  function down(e: React.MouseEvent, key: string, th: HTMLTableCellElement) {
    e.preventDefault(); e.stopPropagation();
    drag.current = { key, x: e.clientX, w: widths[key] ?? th.offsetWidth };
    const move = (ev: MouseEvent) => {
      if (!drag.current) return;
      setWidths((p) => ({ ...p, [drag.current!.key]: Math.max(64, drag.current!.w + (ev.clientX - drag.current!.x)) }));
    };
    const up = () => { drag.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); document.body.classList.remove("col-resizing"); };
    document.body.classList.add("col-resizing");
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  if (rows.length === 0 && empty) return <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />;

  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>{columns.map((c) => (
            <th key={c.key} style={{ width: widths[c.key], textAlign: c.align ?? "left" }}>
              {c.header}
              <span className="col-resize" onMouseDown={(e) => down(e, c.key, e.currentTarget.parentElement as HTMLTableCellElement)} />
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={onRowClick ? "click" : ""} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align ?? "left", padding: dense ? "7px 16px" : undefined }} className={c.mono ? "num" : ""}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
