import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Users, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/groups/")({
  head: () => ({ meta: [
    { title: "Study groups | Medley" },
    { name: "description", content: "Create or join study groups, chat, share decks and compete together." },
    { property: "og:title", content: "Study groups | Medley" },
    { property: "og:description", content: "Create or join study groups, chat, share decks and compete together." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: GroupsHome,
});

type G = { id: string; name: string; description: string; invite_code: string };

function GroupsHome() {
  const student = useActingStudent();
  const nav = useNavigate();
  const [mine, setMine] = useState<(G & { members: number })[]>([]);
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!student) return;
    (async () => {
      const { data } = await supabase.from("group_members").select("group_id, groups(id,name,description,invite_code)").eq("student_id", student.id);
      const gs = (data ?? []).map(r => r.groups as unknown as G).filter(Boolean);
      const { data: all } = await supabase.from("group_members").select("group_id").in("group_id", gs.map(g => g.id));
      setMine(gs.map(g => ({ ...g, members: (all ?? []).filter(m => m.group_id === g.id).length })));
    })();
  }, [student?.id]);

  async function join() {
    if (!student) return;
    const { data: g } = await supabase.from("groups").select("id").eq("invite_code", code.trim().toUpperCase()).maybeSingle();
    if (!g) return setMsg("No group found with that code.");
    await supabase.from("group_members").upsert({ group_id: g.id, student_id: student.id }, { onConflict: "group_id,student_id", ignoreDuplicates: true });
    nav({ to: "/groups/$groupId", params: { groupId: g.id } });
  }
  async function create() {
    if (!student || form.name.trim().length < 2) return;
    const { data: g, error } = await supabase.from("groups").insert({ name: form.name.trim(), description: form.description.trim(), created_by_student_id: student.id }).select("id").single();
    if (error || !g) return setMsg(error?.message ?? "Could not create group");
    await supabase.from("group_members").insert({ group_id: g.id, student_id: student.id, role: "team_lead" });
    nav({ to: "/groups/$groupId", params: { groupId: g.id } });
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-extrabold tracking-widest text-mint">LEARN TOGETHER</p>
        <h1 className="mt-1 font-display text-3xl font-black md:text-5xl">Study groups</h1>
        <p className="mt-2 text-muted-foreground">Chat, share decks, and take on quizzes and cases as a team.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="clay-card bg-mint-soft p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-black"><KeyRound className="h-5 w-5" /> Join with a code</h2>
          <div className="mt-3 flex gap-2">
            <input className="min-w-0 flex-1 rounded-full bg-card px-4 py-2 font-bold uppercase tracking-widest soft-inset" placeholder="KGL123" value={code} onChange={e => setCode(e.target.value)} maxLength={10} />
            <Button variant="mint" onClick={join} disabled={code.trim().length < 4}>Join</Button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">Try the demo code KGL123.</p>
        </div>
        <div className="clay-card bg-mint-soft p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-black"><Plus className="h-5 w-5" /> Create a group</h2>
          {!creating ? <Button variant="mint" className="mt-3" onClick={() => setCreating(true)}>Start a new group</Button> : <div className="mt-3 space-y-2">
            <input className="w-full rounded-full bg-card px-4 py-2 soft-inset" placeholder="Group name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={80} />
            <input className="w-full rounded-full bg-card px-4 py-2 soft-inset" placeholder="What will you study?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={200} />
            <Button variant="mint" onClick={create} disabled={form.name.trim().length < 2}>Create</Button>
          </div>}
        </div>
      </div>
      {msg && <p className="text-sm font-bold">{msg}</p>}

      <section>
        <h2 className="font-display text-xl font-black">Your groups</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {mine.map(g => <Link key={g.id} to="/groups/$groupId" params={{ groupId: g.id }} className="clay-card block bg-card p-5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-mint"><Users className="h-5 w-5" /></span>
            <p className="mt-3 font-display text-lg font-black">{g.name}</p>
            <p className="text-sm text-ink-soft">{g.description}</p>
            <p className="mt-3 text-xs font-bold text-ink-soft">{g.members} members · code {g.invite_code}</p>
          </Link>)}
          {!mine.length && <p className="text-sm text-muted-foreground">You're not in a group yet - join one with a code or start your own.</p>}
        </div>
      </section>
    </div>
  );
}
