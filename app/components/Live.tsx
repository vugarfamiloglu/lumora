import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Handler = (data: any) => void;
interface LiveCtx { on: (type: string, fn: Handler) => () => void; connected: boolean; }
const Ctx = createContext<LiveCtx | null>(null);
const EVENT_TYPES = ["vitals", "notification"];

export function LiveProvider({ children }: { children: ReactNode }) {
  const handlers = useRef(new Map<string, Set<Handler>>());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const bound: Array<[string, (e: MessageEvent) => void]> = [];
    for (const t of EVENT_TYPES) {
      const l = (e: MessageEvent) => {
        let data: unknown;
        try { data = JSON.parse(e.data); } catch { return; }
        handlers.current.get(t)?.forEach((fn) => fn(data));
      };
      es.addEventListener(t, l);
      bound.push([t, l]);
    }
    return () => { bound.forEach(([t, l]) => es.removeEventListener(t, l)); es.close(); };
  }, []);

  const on = useCallback((type: string, fn: Handler) => {
    let set = handlers.current.get(type);
    if (!set) { set = new Set(); handlers.current.set(type, set); }
    set.add(fn);
    return () => { handlers.current.get(type)?.delete(fn); };
  }, []);

  return <Ctx.Provider value={{ on, connected }}>{children}</Ctx.Provider>;
}

export function useConnected(): boolean {
  return useContext(Ctx)?.connected ?? false;
}

// Subscribe to a live event type. The latest handler is always used (no resubscribe churn).
export function useLive(type: string, fn: Handler): void {
  const ctx = useContext(Ctx);
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ctx) return;
    return ctx.on(type, (d) => ref.current(d));
  }, [ctx, type]);
}
