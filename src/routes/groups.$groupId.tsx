import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Brain, Crown, HeartPulse, Layers3, Link2, Send, StickyNote, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { supabase } from "@/integrations/supabase/client";
import { FEATURED_CASE } from "@/features/case-challenge/featured-case";

export const Route = createFileRoute("/groups/$groupId")({
  head: () => ({ meta: [
    { title: "Group | Medley" },
    { name: "description", content: "Group chat, members, shared decks and team challenges." },
    { property: "og:title", content: "Study group | Medley" },
    { property: "og:description", content: "Group chat, members, shared decks and team challenges." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GroupPage,
});

type Member = { student_id: string; role: string; students: { name: string; university: string; year_of_study: number; xp: number; level: number } };
type Msg = { id: string; student_id: string; message: string; created_at: string };
type Res = { id: string; resource_type: string; resource_ref: string; title: string; shared_by_student_id: string | null };
type Tab = "chat" | "members" | "shared" | "leaderboard";

function GroupPage() {
  const { groupId } = Route.useParams();
  const student = useActingStudent();
  const nav = useNavigate();
  const [group, setGroup] = useState<{ name: string; description: string; invite_code: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [res, setRes] = useState<Res[]>([]);
  const [quiz, setQuiz] = useState<{ student_id: string; score: number }[]>([]);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<Tab>("chat");
  const [link, setLink] = useState({ title: "", ref: "" });
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [g, m, ms, r, q] = await Promise.all([
      supabase.from("groups").select("name,description,invite_code").eq("id", groupId).single(),
      supabase.from("group_members").select("student_id, role, students(name,university,year_of_study,xp,level)").eq("group_id", groupId),
      supabase.from("group_messages").select("*").eq("group_id", groupId).order("created_at").limit(200),
      supabase.from("group_shared_resources").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("quiz_sessions").select("student_id,score").eq("group_id", groupId).not("completed_at", "is", null).gte("completed_at", today.toISOString()),
    ]);
    setGroup(g.data); setMembers((m.data ?? []) as unknown as Member[]); setMsgs(ms.data ?? []); setRes(r.data ?? []);
    setQuiz((q.data ?? []).map(x => ({ student_id: x.student_id, score: x.score ?? 0 })));
  }
  useEffect(() => {
    load();
    const ch = supabase.channel(`group-${groupId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
      p => setMsgs(prev => prev.some(x => x.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg])).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "chat") endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length, tab]);

  const name = (id: string | null) => members.find(m => m.student_id === id)?.students?.name ?? "A classmate";
  const isMember = !!student && members.some(m => m.student_id === student.id);

  async function send() {
    if (!student || !text.trim()) return;
    const { data } = await supabase.from("group_messages").insert({ group_id: groupId, student_id: student.id, message: text.trim().slice(0, 2000) }).select("*").single();
    if (data) setMsgs(p => p.some(x => x.id === data.id) ? p : [...p, data]);
    setText("");
  }
  async function join() { if (student) { await supabase.from("group_members").insert({ group_id: groupId, student_id: student.id }); load(); } }
  async function shareLink() {
    if (!student || !link.ref.trim()) return;
    const isUrl = /^https?:\/\//.test(link.ref.trim());
    await supabase.from("group_shared_resources").insert({ group_id: groupId, resource_type: isUrl ? "link" : "note", resource_ref: link.ref.trim().slice(0, 1000), title: link.title.trim() || (isUrl ? "Link" : "Note"), shared_by_student_id: student.id });
    setLink({ title: "", ref: "" }); load();
  }
  async function teamCase() {
    if (!student) return;
    const caseId = FEATURED_CASE.id;
    await supabase.from("case_rooms").insert({ case_id: caseId, group_id: groupId, name: `${group?.name ?? "Group"} team`, created_by: student.id });
    await supabase.from("group_messages").insert({ group_id: groupId, student_id: student.id, message: `Started a team case: ${FEATURED_CASE.title}` });
    nav({ to: "/cases/$caseId", params: { caseId } });
  }

  const ranked = [...members].sort((a, b) => (b.students?.xp ?? 0) - (a.students?.xp ?? 0));
  const totalXp = members.reduce((a, m) => a + (m.students?.xp ?? 0), 0);

  if (!group) return <div className="clay-card h-48 max-w-4xl animate-pulse bg-mint-soft" />;
  return (
    <div className="max-w-4xl space-y-5">
      <Link to="/groups" className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Groups</Link>
      <div className="clay-card bg-mint-soft p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-3xl bg-mint"><Users className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-black md:text-3xl">{group.name}</h1>
            <p className="mt-1 text-ink-soft">{group.description}</p>
            <p className="mt-2 text-xs font-bold text-ink-soft">{members.length} members · {totalXp.toLocaleString()} group XP · invite code <span className="rounded-full bg-card px-2 py-0.5 tracking-widest">{group.invite_code}</span></p>
          </div>
        </div>
        {isMember ? <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="blue" asChild><Link to="/quiz/play" search={{ mode: "group", group: groupId }}><Brain /> Start group quiz</Link></Button>
          <Button variant="lavender" onClick={teamCase}><HeartPulse /> Start team case</Button>
        </div> : <Button variant="mint" className="mt-5" onClick={join}>Join this group</Button>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["chat", "members", "shared", "leaderboard"] as Tab[]).map(t => <Button key={t} variant={tab === t ? "mint" : "secondary"} onClick={() => setTab(t)} className="shrink-0 capitalize">{t === "shared" ? "Shared" : t}</Button>)}
      </div>

      {tab === "chat" && <div className="clay-card bg-card p-4">
        <div className="max-h-[50vh] space-y-3 overflow-y-auto p-1">
          {msgs.map(m => { const me = m.student_id === student?.id; return <div key={m.id} className={`flex ${me ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-3xl px-4 py-2 ${me ? "bg-mint" : "bg-muted"}`}>
              {!me && <p className="text-xs font-black text-ink-soft">{name(m.student_id)}</p>}
              <p className="text-sm leading-relaxed">{m.message}</p>
              <p className="mt-0.5 text-[10px] text-ink-soft">{new Date(m.created_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>; })}
          <div ref={endRef} />
        </div>
        {isMember ? <div className="mt-3 flex gap-2">
          <input className="min-w-0 flex-1 rounded-full bg-muted px-4 py-3 soft-inset" placeholder="Message the group…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} maxLength={2000} />
          <Button variant="mint" size="icon" aria-label="Send" onClick={send}><Send /></Button>
        </div> : <p className="mt-3 text-sm text-muted-foreground">Join the group to chat.</p>}
      </div>}

      {tab === "members" && <div className="grid gap-3 sm:grid-cols-2">{members.map(m => <div key={m.student_id} className="clay-card flex items-center gap-3 bg-card p-4">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-soft font-black">{m.students?.name.split(" ").map(x => x[0]).join("")}</span>
        <div className="min-w-0 flex-1"><p className="font-bold">{m.students?.name}</p><p className="truncate text-xs text-ink-soft">{m.students?.university} · Year {m.students?.year_of_study}</p></div>
        {m.role === "team_lead" && <span className="inline-flex items-center gap-1 rounded-full bg-yellow-soft px-2 py-1 text-xs font-extrabold"><Crown className="h-3 w-3" /> Lead</span>}
      </div>)}</div>}

      {tab === "shared" && <div className="space-y-3">
        {res.map(r => { const Icon = r.resource_type === "deck" ? Layers3 : r.resource_type === "case" ? HeartPulse : r.resource_type === "link" ? Link2 : StickyNote;
          const inner = <><span className="flex size-10 items-center justify-center rounded-2xl bg-mint-soft"><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold">{r.title}</p><p className="text-xs text-ink-soft">{r.resource_type === "note" ? r.resource_ref : `${r.resource_type} · shared by ${name(r.shared_by_student_id)}`}</p></div></>;
          return r.resource_type === "deck" ? <Link key={r.id} to="/flashcards/$deckId" params={{ deckId: r.resource_ref }} className="clay-card flex items-center gap-3 bg-card p-4">{inner}</Link>
            : r.resource_type === "case" ? <Link key={r.id} to="/cases/$caseId" params={{ caseId: r.resource_ref }} className="clay-card flex items-center gap-3 bg-card p-4">{inner}</Link>
            : r.resource_type === "link" ? <a key={r.id} href={r.resource_ref} target="_blank" rel="noreferrer" className="clay-card flex items-center gap-3 bg-card p-4">{inner}</a>
            : <div key={r.id} className="clay-card flex items-center gap-3 bg-card p-4">{inner}</div>; })}
        {isMember && <div className="clay-card space-y-2 bg-mint-soft p-4">
          <p className="text-sm font-black">Share a note or link</p>
          <input className="w-full rounded-full bg-card px-4 py-2 soft-inset" placeholder="Title" value={link.title} onChange={e => setLink({ ...link, title: e.target.value })} maxLength={80} />
          <input className="w-full rounded-full bg-card px-4 py-2 soft-inset" placeholder="A note, or https://…" value={link.ref} onChange={e => setLink({ ...link, ref: e.target.value })} maxLength={1000} />
          <Button size="sm" variant="mint" onClick={shareLink}>Share</Button>
          <p className="text-xs text-ink-soft">To share a deck, open it and tap “Share to group”.</p>
        </div>}
      </div>}

      {tab === "leaderboard" && <div className="space-y-4">
        <div className="clay-card bg-card p-4">
          <p className="flex items-center gap-2 font-display text-lg font-black"><Trophy className="h-5 w-5 text-yellow" /> XP leaderboard</p>
          <ol className="mt-3 space-y-2">{ranked.map((m, i) => <li key={m.student_id} className={`flex items-center gap-3 rounded-2xl p-3 ${i === 0 ? "bg-yellow-soft" : "bg-muted"}`}>
            <span className="w-6 text-center font-black">{i + 1}</span><span className="flex-1 font-bold">{m.students?.name}</span><span className="text-sm font-black">{m.students?.xp.toLocaleString()} XP</span><span className="text-xs text-ink-soft">Lv {m.students?.level}</span>
          </li>)}</ol>
        </div>
        <div className="clay-card bg-blue-soft p-4">
          <p className="font-display text-lg font-black">Today's group quiz</p>
          {quiz.length ? <ol className="mt-3 space-y-2">{[...quiz].sort((a, b) => b.score - a.score).map((q, i) => <li key={i} className="flex justify-between rounded-2xl bg-card p-3 font-bold"><span>{i + 1}. {name(q.student_id)}</span><span>{q.score}%</span></li>)}</ol>
            : <p className="mt-2 text-sm text-ink-soft">No one has taken today's quiz yet. Everyone gets the same 10 questions.</p>}
        </div>
      </div>}
    </div>
  );
}
