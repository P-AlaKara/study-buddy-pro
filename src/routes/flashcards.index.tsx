import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Layers3, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { SuggestionPrompt } from "@/components/suggestion-prompt";
import { supabase } from "@/integrations/supabase/client";
import { fetchDecks, type Deck } from "@/lib/flashcards";

export const Route = createFileRoute("/flashcards/")({
  head: () => ({ meta: [
    { title: "Flashcards | Medley" },
    { name: "description", content: "Official and personal flashcard decks with spaced repetition review." },
    { property: "og:title", content: "Flashcards | Medley" },
    { property: "og:description", content: "Official and personal flashcard decks with spaced repetition review." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: DeckBrowser,
});

type Tab = "official" | "mine" | "saved";

function DeckBrowser() {
  const student = useActingStudent();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [due, setDue] = useState(0);
  const [sugg, setSugg] = useState<{ id: string; front: string; back: string }[]>([]);
  const [tab, setTab] = useState<Tab>("official");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", description: "" });

  async function load() {
    const d = await fetchDecks(); setDecks(d);
    const { data: cards } = await supabase.from("flashcards").select("deck_id");
    const c: Record<string, number> = {}; (cards ?? []).forEach(x => { c[x.deck_id] = (c[x.deck_id] ?? 0) + 1; }); setCounts(c);
    if (!student) return;
    const [s, r, sg] = await Promise.all([
      supabase.from("saved_decks").select("deck_id").eq("student_id", student.id),
      supabase.from("flashcard_reviews").select("id", { count: "exact", head: true }).eq("student_id", student.id).lte("due_date", new Date().toISOString()),
      supabase.from("suggested_flashcards").select("id,front,back").eq("student_id", student.id).eq("status", "pending").order("created_at", { ascending: false }).limit(5),
    ]);
    setSaved(new Set((s.data ?? []).map(x => x.deck_id))); setDue(r.count ?? 0); setSugg(sg.data ?? []);
  }
  useEffect(() => { load(); }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleSave(id: string) {
    if (!student) return;
    const s = new Set(saved);
    if (s.has(id)) { s.delete(id); await supabase.from("saved_decks").delete().eq("student_id", student.id).eq("deck_id", id); }
    else { s.add(id); await supabase.from("saved_decks").insert({ student_id: student.id, deck_id: id }); }
    setSaved(s);
  }
  async function create() {
    if (!student || form.title.trim().length < 2) return;
    await supabase.from("flashcard_decks").insert({ title: form.title.trim(), subject: form.subject.trim() || "General", description: form.description.trim(), owner_student_id: student.id, is_official: false });
    setForm({ title: "", subject: "", description: "" }); setCreating(false); setTab("mine"); load();
  }

  const shown = decks.filter(d => tab === "official" ? d.is_official : tab === "mine" ? d.owner_student_id === student?.id : saved.has(d.id));

  return (
    <div className="max-w-5xl space-y-6">
      <Link to="/practice" className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Practice</Link>
      <div>
        <p className="text-xs font-extrabold tracking-widest text-yellow">FLASHCARDS</p>
        <h1 className="mt-1 font-display text-3xl font-black md:text-4xl">Your decks</h1>
      </div>

      <div className="clay-card flex flex-wrap items-center justify-between gap-4 bg-yellow-soft p-5">
        <div><p className="font-display text-2xl font-black">{due} cards due</p><p className="text-sm text-ink-soft">Plus new cards from your decks · about {Math.max(2, Math.ceil((due + 10) * 0.25))} min</p></div>
        <Button variant="yellow" size="lg" asChild><Link to="/flashcards/review" search={{}}><Layers3 /> Review now</Link></Button>
      </div>

      {sugg.length > 0 && student && <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-black"><Sparkles className="h-5 w-5 text-yellow" /> Suggested for you</h2>
        <p className="text-sm text-muted-foreground">From quiz questions and OSCE checklist items you missed.</p>
        <div className="grid gap-3 md:grid-cols-2">{sugg.map(s => <SuggestionPrompt key={s.id} studentId={student.id} s={s} />)}</div>
      </section>}

      <div className="flex flex-wrap items-center gap-2">
        {(["official", "mine", "saved"] as Tab[]).map(t => <Button key={t} variant={tab === t ? "yellow" : "secondary"} onClick={() => setTab(t)}>{t === "official" ? "Official" : t === "mine" ? "My decks" : "Saved"}</Button>)}
        <Button variant="ghost" className="ml-auto" onClick={() => setCreating(!creating)}><Plus /> New deck</Button>
      </div>

      {creating && <div className="clay-card space-y-3 bg-card p-5">
        <input className="w-full rounded-full bg-muted px-4 py-3 soft-inset" placeholder="Deck title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={80} />
        <input className="w-full rounded-full bg-muted px-4 py-3 soft-inset" placeholder="Subject (e.g. Pharmacology)" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} maxLength={40} />
        <textarea className="w-full rounded-2xl bg-muted px-4 py-3 soft-inset" placeholder="Short description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={300} />
        <Button variant="yellow" onClick={create} disabled={form.title.trim().length < 2}>Create deck</Button>
      </div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(d => <div key={d.id} className="clay-card flex flex-col bg-yellow-soft p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="rounded-full bg-card px-3 py-1 text-xs font-extrabold">{d.subject}</span>
            <button aria-label={saved.has(d.id) ? "Unsave deck" : "Save deck"} onClick={() => toggleSave(d.id)} className="clay-button flex size-9 items-center justify-center bg-card"><Heart className={`h-4 w-4 ${saved.has(d.id) ? "fill-pink text-pink" : ""}`} /></button>
          </div>
          <Link to="/flashcards/$deckId" params={{ deckId: d.id }} className="mt-3 font-display text-lg font-black leading-snug hover:underline">{d.title}</Link>
          <p className="mt-1 flex-1 text-sm text-ink-soft">{d.description}</p>
          <div className="mt-4 flex items-center justify-between text-xs font-bold text-ink-soft">
            <span>{counts[d.id] ?? 0} cards</span>
            {d.is_official && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Official</span>}
          </div>
        </div>)}
        {!shown.length && <p className="text-sm text-muted-foreground">{tab === "mine" ? "You haven't made a deck yet. Tap “New deck”." : tab === "saved" ? "Tap the heart on any deck to save it here." : "No decks yet."}</p>}
      </div>
    </div>
  );
}
