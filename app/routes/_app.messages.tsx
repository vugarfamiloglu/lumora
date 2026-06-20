import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams, Form } from "@remix-run/react";
import { useState } from "react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { newId } from "~/lib/ids.server";
import { Card, PageHeader, Button, Modal, Field, Avatar, EmptyState } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { relTime, timeOnly, initials } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Messages · Lumora" }];
export const handle = { title: "Messages", crumb: "COORDINATION" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "message");
  const url = new URL(request.url);
  const tid = url.searchParams.get("t");

  const threads = db.prepare(`SELECT t.id, t.subject, t.last_at, tm.read_at,
      (SELECT body FROM messages WHERE thread_id=t.id ORDER BY created_at DESC LIMIT 1) AS last_msg,
      (SELECT GROUP_CONCAT(s.full_name, ', ') FROM thread_members m JOIN staff s ON s.id=m.staff_id WHERE m.thread_id=t.id AND m.staff_id != ?) AS others
    FROM threads t JOIN thread_members tm ON tm.thread_id=t.id AND tm.staff_id=?
    ORDER BY t.last_at DESC`).all(staff.id, staff.id) as any[];

  let active: any = null;
  if (tid) {
    const isMember = db.prepare("SELECT 1 FROM thread_members WHERE thread_id=? AND staff_id=?").get(tid, staff.id);
    if (isMember) {
      db.prepare("UPDATE thread_members SET read_at=datetime('now') WHERE thread_id=? AND staff_id=?").run(tid, staff.id);
      const t = db.prepare("SELECT * FROM threads WHERE id=?").get(tid) as any;
      const msgs = db.prepare(`SELECT m.*, s.full_name AS author, s.photo_color FROM messages m LEFT JOIN staff s ON s.id=m.author_id WHERE m.thread_id=? ORDER BY m.created_at`).all(tid) as any[];
      active = { ...t, messages: msgs };
    }
  }
  const colleagues = db.prepare("SELECT id, full_name, role FROM staff WHERE id != ? ORDER BY full_name").all(staff.id) as any[];
  return json({ threads, active, me: staff.id, colleagues });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "message");
  const f = await request.formData();
  const intent = String(f.get("intent"));

  if (intent === "send") {
    const tid = String(f.get("thread_id"));
    const body = String(f.get("body") ?? "").trim();
    if (body) {
      db.prepare("INSERT INTO messages (id, thread_id, author_id, body) VALUES (?,?,?,?)").run(newId(), tid, staff.id, body);
      db.prepare("UPDATE threads SET last_at=datetime('now') WHERE id=?").run(tid);
      db.prepare("UPDATE thread_members SET read_at=NULL WHERE thread_id=? AND staff_id != ?").run(tid, staff.id);
    }
    return redirect(`/messages?t=${tid}`);
  }
  if (intent === "new") {
    const to = String(f.get("to"));
    const subject = String(f.get("subject") ?? "Conversation");
    const body = String(f.get("body") ?? "").trim();
    const tid = newId();
    db.prepare("INSERT INTO threads (id, subject, created_by, last_at) VALUES (?,?,?,datetime('now'))").run(tid, subject, staff.id);
    db.prepare("INSERT INTO thread_members (thread_id, staff_id, read_at) VALUES (?,?,datetime('now'))").run(tid, staff.id);
    db.prepare("INSERT INTO thread_members (thread_id, staff_id) VALUES (?,?)").run(tid, to);
    if (body) db.prepare("INSERT INTO messages (id, thread_id, author_id, body) VALUES (?,?,?,?)").run(newId(), tid, staff.id, body);
    return redirect(`/messages?t=${tid}`);
  }
  return json({ ok: false });
}

export default function Messages() {
  const { threads, active, me, colleagues } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const tid = params.get("t");
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="stack">
      <PageHeader title="Secure Messaging" sub="Direct clinical communication between staff and care teams."
        action={<Button variant="primary" icon="plus" onClick={() => setNewOpen(true)}>New message</Button>} />

      <div className="msg-pane">
        <Card style={{ overflow: "hidden" }}>
          {threads.length === 0 && <EmptyState icon="messages" title="No conversations" />}
          {threads.map((t: any) => (
            <Link key={t.id} to={`/messages?t=${t.id}`} className={`thread-item ${tid === t.id ? "on" : ""}`}>
              <div className="between"><b style={{ fontSize: 13.5 }}>{t.subject}</b>{!t.read_at && <span className="unread" />}</div>
              <div className="mut-sm" style={{ marginTop: 2 }}>{t.others ?? "—"}</div>
              <div className="dim" style={{ marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.last_msg ?? "No messages"}</div>
            </Link>
          ))}
        </Card>

        <Card style={{ display: "flex", flexDirection: "column" }}>
          {!active ? <div className="card-body"><EmptyState icon="messages" title="Select a conversation" body="Choose a thread on the left or start a new message." /></div> : (
            <>
              <div className="card-head"><div><h3>{active.subject}</h3></div></div>
              <div className="msg-list">
                {active.messages.map((m: any) => {
                  const mine = m.author_id === me;
                  return (
                    <div key={m.id} style={{ display: "flex", gap: 8, flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end" }}>
                      {!mine && <Avatar name={m.author ?? "?"} color={m.photo_color} size={28} />}
                      <div>
                        <div className={`bubble ${mine ? "me" : "them"}`}>{m.body}</div>
                        <div className="msg-meta" style={{ textAlign: mine ? "right" : "left" }}>{mine ? "You" : m.author} · {timeOnly(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Form method="post" className="msg-compose">
                <input type="hidden" name="intent" value="send" />
                <input type="hidden" name="thread_id" value={active.id} />
                <input name="body" placeholder="Write a message…" autoComplete="off" autoFocus />
                <Button variant="primary" type="submit" icon="arrow-right">Send</Button>
              </Form>
            </>
          )}
        </Card>
      </div>

      {newOpen && (
        <Modal title="New message" onClose={() => setNewOpen(false)}
          footer={<><Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button><Button variant="primary" form="nm" type="submit">Send</Button></>}>
          <Form id="nm" method="post">
            <input type="hidden" name="intent" value="new" />
            <Field label="To" required><select name="to" required>{colleagues.map((c: any) => <option key={c.id} value={c.id}>{c.full_name} · {c.role}</option>)}</select></Field>
            <Field label="Subject"><input name="subject" placeholder="e.g. Bed 4 — review request" /></Field>
            <Field label="Message" required><textarea name="body" rows={4} required /></Field>
          </Form>
        </Modal>
      )}
    </div>
  );
}
