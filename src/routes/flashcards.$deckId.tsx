import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Layers3, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import {
  CARD_TYPE_LABEL,
  CARD_TYPES,
  clozeBack,
  type Card,
  type CardType,
  type Deck,
} from "@/lib/flashcards";
import {
  DECK_COLORS,
  DEFAULT_DECK_COLOR,
  deckEmoji,
  deckTint,
  getDeckColor,
  setDeckColor,
} from "@/lib/deck-colors";
import {
  getDeck,
  upsertCard,
  deleteCard as deleteCardFn,
  updateDeckMeta,
} from "@/lib/flashcards.functions";

export const Route = createFileRoute("/flashcards/$deckId")({
  head: () => ({
    meta: [
      { title: "Flashcard deck | Medley" },
      { name: "description", content: "Browse, edit and share the cards in this deck." },
      { property: "og:title", content: "Flashcard deck | Medley" },
      { property: "og:description", content: "Browse, edit and share the cards in this deck." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
  const [msg, setMsg] = useState("");
  const [meta, setMeta] = useState<{ title: string; description: string } | null>(null);
  // Card colour is a browser-only presentation preference (see lib/deck-colors).
  // Start from the default so SSR and first client render match, then hydrate.
  const [color, setColorState] = useState<string>(DEFAULT_DECK_COLOR);

  async function load() {
    const { deck: d, cards: c } = await getDeck({ data: { deckId } });
    setDeck(d);
    setCards(c);
  }
  useEffect(() => {
    load();
  }, [deckId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setColorState(getDeckColor(deckId));
  }, [deckId]);

  function chooseColor(v: string) {
    setColorState(v);
    setDeckColor(deckId, v);
  }

  const mine = !!deck && !deck.is_official && deck.owner_student_id === student?.id;

  async function save() {
    const front = form.front.trim();
    const back = form.back.trim();
    if (!front || !back) return setMsg("Add a front and a back.");
    try {
      await upsertCard({
        data: {
          deckId,
          cardId: editing ?? undefined,
          type: form.type,
          front,
          back,
          cloze_text: form.type === "cloze" ? form.cloze_text.trim() || null : null,
          image_url: form.image_url.trim() || null,
          position: cards.length + 1,
        },
      });
    } catch (e) {
      return setMsg(e instanceof Error ? e.message : "Could not save the card.");
    }
    setForm(empty);
    setEditing(null);
    setMsg("");
    load();
  }
  async function remove(id: string) {
    await deleteCardFn({ data: { deckId, cardId: id } });
    load();
  }
  async function saveMeta() {
    if (!meta) return;
    await updateDeckMeta({
      data: {
        deckId,
        title: meta.title.trim() || deck!.title,
        description: meta.description.trim(),
      },
    });
    setMeta(null);
    load();
  }

  if (!deck) return <div className="clay-card h-48 w-full animate-pulse bg-yellow-soft" />;
  return (
    <div className="space-y-5">
      <Link
        to="/flashcards"
        className="inline-flex items-center gap-1 text-sm font-extrabold text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Decks
      </Link>

      {/* Deck banner */}
      <div className="clay-card overflow-hidden bg-gradient-to-br from-yellow-soft to-peach/50 p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={`flex size-16 shrink-0 items-center justify-center rounded-3xl text-3xl shadow-[inset_0_2px_1px_var(--card)] md:size-20 md:text-4xl ${deckTint(deck.id)}`}
            >
              {deckEmoji(deck)}
            </span>
            <div className="min-w-0 flex-1">
              {meta ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-full bg-card px-4 py-2 font-bold"
                    value={meta.title}
                    onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                    maxLength={80}
                  />
                  <textarea
                    className="w-full rounded-2xl bg-card px-4 py-2"
                    value={meta.description}
                    onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                    maxLength={300}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="yellow" onClick={saveMeta}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setMeta(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="inline-flex rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-ink-soft">
                    {deck.is_official ? "Official deck" : "Personal deck"} · {deck.subject}
                  </span>
                  <h1 className="mt-2 font-display text-2xl font-black md:text-4xl">
                    {deck.title}
                  </h1>
                  {deck.description && <p className="mt-2 text-ink-soft">{deck.description}</p>}
                  <p className="mt-3 text-xs font-bold text-ink-soft">{cards.length} cards</p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 md:items-end">
            {/* Deck colour — applied to card fronts here and in review */}
            <div>
              <p className="mb-1.5 text-xs font-extrabold uppercase text-ink-soft md:text-right">
                Deck colour
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DECK_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.label}
                    aria-pressed={color === c.value}
                    title={c.label}
                    onClick={() => chooseColor(c.value)}
                    className={`size-7 rounded-full border-2 border-card transition-transform hover:scale-110 ${color === c.value ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-background" : "ring-1 ring-border"}`}
                    style={{ background: c.value }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="yellow" asChild>
                <Link to="/flashcards/review" search={{ deck: deck.id }}>
                  <Layers3 /> Review {cards.length} cards
                </Link>
              </Button>
              {mine && !meta && (
                <Button
                  variant="secondary"
                  onClick={() => setMeta({ title: deck.title, description: deck.description })}
                >
                  <Pencil /> Edit details
                </Button>
              )}
            </div>
          </div>
        </div>
        {msg && <p className="mt-3 text-sm font-bold">{msg}</p>}
      </div>

      <div className={mine ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" : ""}>
        {/* Card list */}
        <div className="space-y-3">
          {cards.map((c, i) => (
            <div key={c.id} className="clay-card flex items-start gap-3 bg-card p-4">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-yellow-soft text-xs font-black">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div
                    className="rounded-2xl px-3 py-2 text-sm font-bold leading-snug"
                    style={{ background: color }}
                  >
                    {c.front}
                  </div>
                  <div className="text-sm leading-relaxed text-ink-soft">
                    {c.cloze_text ? clozeBack(c.cloze_text) : c.back}
                  </div>
                </div>
                {c.image_url && (
                  <img
                    src={c.image_url}
                    alt=""
                    className="mt-2 max-h-32 w-full rounded-xl bg-muted object-contain"
                  />
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-extrabold text-ink-soft">
                  {CARD_TYPE_LABEL[c.type]}
                </span>
                {mine && (
                  <span className="flex gap-1">
                    <button
                      aria-label="Edit card"
                      onClick={() => {
                        setEditing(c.id);
                        setForm({
                          type: c.type,
                          front: c.front,
                          back: c.back,
                          cloze_text: c.cloze_text ?? "",
                          image_url: c.image_url ?? "",
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-full p-2 hover:bg-muted"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Delete card"
                      onClick={() => remove(c.id)}
                      className="rounded-full p-2 hover:bg-muted"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
          {!cards.length && (
            <div className="clay-card grid place-items-center bg-card px-6 py-14 text-center">
              <span className="flex size-20 items-center justify-center rounded-3xl bg-yellow-soft text-4xl shadow-[inset_0_2px_1px_var(--card)]">
                🃏
              </span>
              <h3 className="mt-5 font-display text-2xl font-black">This deck has no cards yet</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {mine
                  ? "Add your first flashcard to start building a review-ready deck."
                  : "Cards will appear here once they're added."}
              </p>
            </div>
          )}
        </div>

        {/* Add / edit card */}
        {mine && (
          <div className="clay-card space-y-3 self-start bg-card p-5 lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 font-display text-lg font-black">
              <Plus className="h-5 w-5" /> {editing ? "Edit card" : "Add a card"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {CARD_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`rounded-full px-3 py-1 text-xs font-extrabold ${form.type === t ? "bg-yellow" : "bg-muted"}`}
                >
                  {CARD_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <input
              className="w-full rounded-full bg-muted px-4 py-3 soft-inset"
              placeholder={
                form.type === "cloze"
                  ? "Card title (e.g. ADH action)"
                  : "Front - question or prompt"
              }
              value={form.front}
              onChange={(e) => setForm({ ...form, front: e.target.value })}
              maxLength={300}
            />
            {form.type === "cloze" && (
              <input
                className="w-full rounded-full bg-muted px-4 py-3 soft-inset"
                placeholder="Cloze text, e.g. ADH inserts {{c1::aquaporin-2}} channels"
                value={form.cloze_text}
                onChange={(e) => setForm({ ...form, cloze_text: e.target.value })}
                maxLength={400}
              />
            )}
            <textarea
              className="w-full rounded-2xl bg-muted px-4 py-3 soft-inset"
              placeholder="Back - answer"
              value={form.back}
              onChange={(e) => setForm({ ...form, back: e.target.value })}
              maxLength={600}
            />
            {form.type !== "basic" && form.type !== "cloze" && (
              <input
                className="w-full rounded-full bg-muted px-4 py-3 soft-inset"
                placeholder="Image link (https://…)"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            )}
            <div className="flex gap-2">
              <Button variant="yellow" onClick={save}>
                {editing ? (
                  <>
                    <Check /> Save card
                  </>
                ) : (
                  <>
                    <Plus /> Add card
                  </>
                )}
              </Button>
              {editing && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setForm(empty);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
