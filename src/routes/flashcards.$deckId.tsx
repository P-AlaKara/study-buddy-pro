import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Layers3, Pencil, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { supabase } from "@/integrations/supabase/client";
import { CARD_TYPE_LABEL, CARD_TYPES, clozeBack, type Card, type CardType, type Deck } from "@/lib/flashcards";

export const Route = createFileRoute("/flashcards/$deckId")({
  head: () => ({ meta: [
    { title: "Flashcard deck | Medley" },
    { name: "description", content: "Browse, edit and share the cards in this deck." },
    { property: "og:title", content: "Flashcard deck | Medley" },
    { property: "og:description", content: "Browse, edit and share the cards in this deck." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DeckPage,
});

const empty = { type: "basic" as CardType, front: "", back: "", cloze_text: "", image_url: "" };

function DeckPage() {
  const { deckId } = Route.useParams();
  const student = useActingStudent();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [meta, setMeta] = useState<{ title: string; description: string } | null>(null);

  async function load() {
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase.from("flashcard_decks").select("*").eq("id", deckId).single(),
      supabase.from("flashcards").select("*").eq("deck_id", deckId).order("position").order("created_at"),
    ]);
    setDeck(d as unknown as Deck); setCards((c ?? []) as unknown as Card[]);
  }
  useEffect(() => { load(); }, [deckId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!student) return;
    supabase.from("group_members").select("group_id, groups(id,name)").eq("student_id", student.id).then(({ data }) =>
      setGroups((data ?? []).map(r => r.groups as unknown as { id: string; name: string }).filter(Boolean)));
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = !!deck && !deck.is_official && deck.owner_student_id === student?.id;

  async function save() {
    const payload = { type: form.type, front: form.front.trim(), back: form.back.trim(), cloze_text: form.type === "cloze" ? form.cloze_text.trim() || null : null, image_url: form.image_url.trim() || null };
    if (!payload.front || !payload.back) return setMsg("Add a front and a back.");
    const { error } = editing ? await supabase.from("flashcards").update(payload).eq("id", editing) : await supabase.from("flashcards").insert({ ...payload, deck_id: deckId, position: cards.length + 1 });
    if (error) return setMsg(error.message);
    setForm(empty); setEditing(null); setMsg(""); load();
  }
  async function remove(id: string) { await supabase.from("flashcards").delete().eq("id", id); load(); }
  async function share(groupId: string) {
    if (!student || !deck) return;
    const { error } = await supabase.from("group_shared_resources").insert({ group_id: groupId, resource_type: "deck", resource_ref: deck.id, title: deck.title, shared_by_student_id: student.id });
    setMsg(error ? error.message : "Shared with your group!"); setShareOpen(false);
  }
  async function saveMeta() {
    if (!meta) return;
    await supabase.from("flashcard_decks").update({ title: meta.title.trim() || deck!.title, description: meta.description.trim() }).eq("id", deckId);
    setMeta(null); load();
  }

  if (!deck) return <div className="clay-card h-48 max-w-4xl animate-pulse bg-yellow-soft" />;
  return (
    <div className="max-w-4xl space-y-5">
      <Link to="/flashcards" className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Decks</Link>
      <div className="clay-card bg-yellow-soft p-6">
        {meta ? <div className="space-y-2">
          <input className="w-full rounded-full bg-card px-4 py-2 font-bold" value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} maxLength={80} />
          <textarea className="w-full rounded-2xl bg-card px-4 py-2" value={meta.description} onChange={e => setMeta({ ...meta, description: e.target.value })} maxLength={300} />
          <Button size="sm" variant="yellow" onClick={saveMeta}>Save</Button>
        </div> : <>
          <p className="text-xs font-black uppercase tracking-wider text-ink-soft">{deck.is_official ? "Official deck" : "Personal deck"} · {deck.subject}</p>
          <h1 className="mt-1 font-display text-3xl font-black">{deck.title}</h1>
          <p className="mt-2 text-ink-soft">{deck.description}</p>
        </>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="yellow" asChild><Link to="/flashcards/review" search={{ deck: deck.id }}><Layers3 /> Review {cards.length} cards</Link></Button>
          {mine && !meta && <Button variant="secondary" onClick={() => setMeta({ title: deck.title, description: deck.description })}><Pencil /> Edit details</Button>}
          <Button variant="secondary" onClick={() => setShareOpen(!shareOpen)}><Share2 /> Share to group</Button>
        </div>
        {shareOpen && <div className="mt-3 flex flex-wrap gap-2">{groups.length ? groups.map(g => <Button key={g.id} size="sm" variant="mint" onClick={() => share(g.id)}>{g.name}</Button>) : <p className="text-sm">Join a group first on the Groups page.</p>}</div>}
        {msg && <p className="mt-3 text-sm font-bold">{msg}</p>}
      </div>

      {mine && <div className="clay-card space-y-3 bg-card p-5">
        <h2 className="font-display text-lg font-black">{editing ? "Edit card" : "Add a card"}</h2>
        <div className="flex flex-wrap gap-2">{CARD_TYPES.map(t => <button key={t} onClick={() => setForm({ ...form, type: t })} className={`rounded-full px-3 py-1 text-xs font-extrabold ${form.type === t ? "bg-yellow" : "bg-muted"}`}>{CARD_TYPE_LABEL[t]}</button>)}</div>
        <input className="w-full rounded-full bg-muted px-4 py-3 soft-inset" placeholder={form.type === "cloze" ? "Card title (e.g. ADH action)" : "Front - question or prompt"} value={form.front} onChange={e => setForm({ ...form, front: e.target.value })} maxLength={300} />
        {form.type === "cloze" && <input className="w-full rounded-full bg-muted px-4 py-3 soft-inset" placeholder="Cloze text, e.g. ADH inserts {{c1::aquaporin-2}} channels" value={form.cloze_text} onChange={e => setForm({ ...form, cloze_text: e.target.value })} maxLength={400} />}
        <textarea className="w-full rounded-2xl bg-muted px-4 py-3 soft-inset" placeholder="Back - answer" value={form.back} onChange={e => setForm({ ...form, back: e.target.value })} maxLength={600} />
        {form.type !== "basic" && form.type !== "cloze" && <input className="w-full rounded-full bg-muted px-4 py-3 soft-inset" placeholder="Image link (https://…)" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} />}
        <div className="flex gap-2"><Button variant="yellow" onClick={save}>{editing ? "Save card" : "Add card"}</Button>{editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</Button>}</div>
      </div>}

      <div className="grid gap-3 md:grid-cols-2">
        {cards.map(c => <div key={c.id} className="clay-card bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="rounded-full bg-yellow-soft px-3 py-1 text-xs font-extrabold">{CARD_TYPE_LABEL[c.type]}</span>
            {mine && <span className="flex gap-1">
              <button aria-label="Edit card" onClick={() => { setEditing(c.id); setForm({ type: c.type, front: c.front, back: c.back, cloze_text: c.cloze_text ?? "", image_url: c.image_url ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-full p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
              <button aria-label="Delete card" onClick={() => remove(c.id)} className="rounded-full p-2 hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
            </span>}
          </div>
          {c.image_url && <img src={c.image_url} alt="" className="mt-3 max-h-32 w-full rounded-xl bg-muted object-contain" />}
          <p className="mt-3 font-bold">{c.front}</p>
          <p className="mt-1 text-sm text-ink-soft">{c.cloze_text ? clozeBack(c.cloze_text) : c.back}</p>
        </div>)}
        {!cards.length && <p className="text-sm text-muted-foreground">No cards yet.</p>}
      </div>
    </div>
  );
}
