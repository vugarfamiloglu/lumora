import { type LoaderFunctionArgs } from "@remix-run/node";
import { subscribe } from "~/lib/events.server";
import { requireStaff } from "~/lib/session.server";
import { startVitals } from "~/lib/vitals.server";

// Server-Sent Events stream: live vitals + notifications.
export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  startVitals();

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (e: { type: string; data: unknown }) => {
        try { controller.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`)); } catch { /* closed */ }
      };
      const unsub = subscribe(send);
      const ping = setInterval(() => { try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { /* closed */ } }, 25000);
      request.signal.addEventListener("abort", () => {
        clearInterval(ping); unsub();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
