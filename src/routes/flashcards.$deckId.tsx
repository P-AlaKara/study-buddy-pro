import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  Layers3,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { CardTypeIcon, ClozeText, Flashcard } from "@/components/flashcards/flashcard";
import { promptText } from "@/components/flashcards/card-text";
import { StudyPlayer } from "@/components/flashcards/study-player";
import { useStudyDeck } from "@/components/flashcards/use-study-deck";
import {
  CARD_TYPE_LABEL,
  CARD_TYPES,
  cardMastery,
  MASTERED_INTERVAL_DAYS,
  MASTERY_LABEL,
  type Card,
  type CardReviewState,
  type CardType,
  type Deck,
  type Mastery,
} from "@/lib/flashcards";
import {
  DECK_COLORS,
  DEFAULT_DECK_COLOR,
  deckColorVars,
  deckEmoji,
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
/** Matches getReviewQueue: due cards plus up to 10 unseen ones per session. */
const NEW_PER_SESSION = 10;
const PLAYER_ID = "study-mode";

const MASTERY_STYLE: Record<Mastery, { pill: string; dot: string; bar: string }> = {
  new: { pill: "bg-blue-soft", dot: "bg-blue", bar: "bg-blue/45" },
  learning: { pill: "bg-yellow-soft", dot: "bg-yellow", bar: "bg-yellow" },
  mastered: { pill: "bg-mint-soft", dot: "bg-mint", bar: "bg-mint" },
};

function smoothScroll(el: Element | null) {
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function DeckPage() {
  const { deckId } = Route.useParams();
  const student = useActingStudent();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [reviews, setReviews] = useState<Map<string, CardReviewState>>(new Map());
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [meta, setMeta] = useState<{ title: string; description: string } | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Mastery | "all">("all");
  const [typeFilter, setTypeFilter] = useState<CardType | "all">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [previewFlipped, setPreviewFlipped] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  // Card colour is a browser-only presentation preference (see lib/deck-colors).
  // Start from the default so SSR and first client render match, then hydrate.
  const [color, setColorState] = useState<string>(DEFAULT_DECK_COLOR);
  const study = useStudyDeck(cards);

  async function load() {
    try {
      const { deck: d, cards: c, reviews: r } = await getDeck({ data: { deckId } });
      setDeck(d);
      setCards(c);
      setReviews(new Map(r.map((x) => [x.flashcard_id, x])));
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load this deck.");
    }
  }
  useEffect(() => {
    load();
  }, [deckId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setColorState(getDeckColor(deckId));
  }, [deckId]);
  // Links like "Practise all cards" target #study-mode, which only exists once
  // the cards have loaded, so scroll there ourselves.
  const hasCards = cards.length > 0;
  useEffect(() => {
    if (hasCards && window.location.hash === `#${PLAYER_ID}`) {
      smoothScroll(document.getElementById(PLAYER_ID));
    }
  }, [hasCards]);

  function chooseColor(v: string) {
    setColorState(v);
    setDeckColor(deckId, v);
  }

  const mine = !!deck && !deck.is_official && deck.owner_student_id === student?.id;

  const stats = useMemo(() => {
    const now = Date.now();
    const s = { new: 0, learning: 0, mastered: 0, due: 0 };
    for (const c of cards) {
      const r = reviews.get(c.id);
      s[cardMastery(r)]++;
      if (r && new Date(r.due_date).getTime() <= now) s.due++;
    }
    return s;
  }, [cards, reviews]);
  const sessionSize = stats.due + Math.min(stats.new, NEW_PER_SESSION);

  const typesPresent = useMemo(
    () => CARD_TYPES.filter((t) => cards.some((c) => c.type === t)),
    [cards],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards
      .map((c, i) => ({ c, n: i + 1 }))
      .filter(({ c }) => filter === "all" || cardMastery(reviews.get(c.id)) === filter)
      .filter(({ c }) => typeFilter === "all" || c.type === typeFilter)
      .filter(
        ({ c }) => !q || `${c.front} ${c.back} ${c.cloze_text ?? ""}`.toLowerCase().includes(q),
      );
  }, [cards, reviews, query, filter, typeFilter]);

  function openEditor(card?: Card) {
    setMsg("");
    setPreviewFlipped(false);
    if (card) {
      setEditing(card.id);
      setForm({
        type: card.type,
        front: card.front,
        back: card.back,
        cloze_text: card.cloze_text ?? "",
        image_url: card.image_url ?? "",
      });
    } else {
      setEditing(null);
      setForm(empty);
    }
    smoothScroll(editorRef.current);
    // Focus after the scroll has started so the field doesn't yank the page.
    setTimeout(() => frontInputRef.current?.focus({ preventScroll: true }), 250);
  }

  async function save() {
    const front = form.front.trim();
    const back = form.back.trim();
    if (!front || !back) return setMsg("Add a front and a back.");
    if (form.type === "cloze" && !/\{\{c\d+::.+?\}\}/.test(form.cloze_text)) {
      return setMsg("Cloze text needs at least one {{c1::hidden}} part.");
    }
    setSaving(true);
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
      setSaving(false);
      return setMsg(e instanceof Error ? e.message : "Could not save the card.");
    }
    setSaving(false);
    setForm(empty);
    setEditing(null);
    setPreviewFlipped(false);
    setMsg(editing ? "Card updated." : "Card added.");
    load();
  }
  async function remove(id: string) {
    setConfirmDelete(null);
    if (editing === id) {
      setEditing(null);
      setForm(empty);
    }
    await deleteCardFn({ data: { deckId, cardId: id } });
    load();
  }
  async function saveMeta() {
    if (!meta || !deck) return;
    await updateDeckMeta({
      data: {
        deckId,
        title: meta.title.trim() || deck.title,
        description: meta.description.trim(),
      },
    });
    setMeta(null);
    load();
  }
  function studyCard(id: string) {
    study.jumpTo(id);
    smoothScroll(document.getElementById(PLAYER_ID));
  }

  const vars = deckColorVars(color) as CSSProperties;

  if (loadError && !deck)
    return (
      <div className="space-y-5">
        <BackLink />
        <div className="clay-card grid place-items-center bg-card px-6 py-14 text-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-pink-soft text-4xl shadow-[inset_0_2px_1px_var(--card)]">
            🗂️
          </span>
          <h1 className="mt-5 font-display text-2xl font-black">We couldn't open this deck</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{loadError}</p>
          <Button variant="yellow" className="mt-5" asChild>
            <Link to="/flashcards">Back to your decks</Link>
          </Button>
        </div>
      </div>
    );

  if (!deck)
    return (
      <div className="space-y-5" aria-busy="true">
        <BackLink />
        <div className="h-56 w-full animate-pulse rounded-[28px] bg-yellow-soft" />
        <div className="h-96 w-full animate-pulse rounded-[28px] bg-card" />
      </div>
    );

  const previewCard: Card = {
    id: "preview",
    deck_id: deckId,
    type: form.type,
    front: form.front.trim() || (form.type === "cloze" ? "" : "Your question appears here"),
    back: form.back.trim() || "Your answer appears here",
    cloze_text:
      form.type === "cloze" ? form.cloze_text.trim() || "Type {{c1::cloze}} text to preview" : null,
    image_url:
      form.type !== "basic" && form.type !== "cloze" ? form.image_url.trim() || null : null,
    position: 0,
  };

  return (
    <div className="space-y-6" style={vars}>
      <BackLink />

      {/* ---------------- Deck banner ---------------- */}
      <header className="fc-banner relative overflow-hidden rounded-[28px] p-5 shadow-[0_14px_30px_-20px_oklch(0.43_0.035_280/30%),inset_0_2px_1px_oklch(1_0_0/85%)] md:p-7">
        <span
          className="pointer-events-none absolute -bottom-16 -left-10 size-48 rounded-full bg-[var(--fc-accent)] opacity-15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-3xl bg-white/75 text-3xl shadow-[inset_0_2px_1px_white,0_8px_18px_-12px_oklch(0.35_0.06_285/0.4)] ring-1 ring-white md:size-20 md:text-4xl">
              {deckEmoji(deck)}
            </span>
            <div className="min-w-0 flex-1">
              {meta ? (
                <div className="space-y-2">
                  <label className="sr-only" htmlFor="deck-title">
                    Deck title
                  </label>
                  <input
                    id="deck-title"
                    className="w-full rounded-full bg-card px-4 py-2.5 font-display text-lg font-black soft-inset"
                    value={meta.title}
                    onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                    maxLength={80}
                  />
                  <label className="sr-only" htmlFor="deck-description">
                    Description
                  </label>
                  <textarea
                    id="deck-description"
                    className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm soft-inset"
                    placeholder="Short description"
                    value={meta.description}
                    onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                    maxLength={300}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="yellow" onClick={saveMeta}>
                      <Check /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setMeta(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="fc-badge inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider">
                      {deck.is_official ? (
                        <ShieldCheck className="size-3.5" aria-hidden />
                      ) : (
                        <User className="size-3.5" aria-hidden />
                      )}
                      {deck.is_official ? "Official deck" : "Personal deck"}
                    </span>
                    {deck.subject && (
                      <span className="fc-badge inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider">
                        <span className="fc-dot size-1.5" aria-hidden /> {deck.subject}
                      </span>
                    )}
                    {deck.topic && deck.topic !== deck.subject && (
                      <span className="fc-badge px-2.5 py-1 text-[11px] font-extrabold">
                        {deck.topic}
                      </span>
                    )}
                  </div>
                  <h1 className="mt-3 flex gap-3 font-display text-2xl font-black leading-tight md:text-4xl">
                    <span className="fc-accent-bar my-1" aria-hidden />
                    <span className="min-w-0">{deck.title}</span>
                  </h1>
                  {deck.description && (
                    <p className="mt-2 max-w-2xl text-sm text-ink-soft md:text-base">
                      {deck.description}
                    </p>
                  )}
                </>
              )}

              {/* Stats */}
              {cards.length > 0 && (
                <div className="mt-5 max-w-xl">
                  <div className="flex flex-wrap gap-2 text-xs font-extrabold">
                    <span className="rounded-full bg-white/80 px-3 py-1.5 shadow-[inset_0_1px_0_white]">
                      {cards.length} {cards.length === 1 ? "card" : "cards"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1.5 shadow-[inset_0_1px_0_white] ${stats.due ? "bg-pink-soft" : "bg-white/80"}`}
                    >
                      {stats.due ? `${stats.due} due now` : "Nothing due"}
                    </span>
                  </div>
                  <MasteryBar stats={stats} total={cards.length} />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {cards.length > 0 && (
                <Button variant="yellow" className="bg-[var(--fc-accent)]" asChild>
                  <Link to="/flashcards/review" search={{ deck: deck.id }}>
                    <Layers3 />
                    {sessionSize
                      ? `Review ${sessionSize} ${sessionSize === 1 ? "card" : "cards"}`
                      : "Review"}
                  </Link>
                </Button>
              )}
              {mine && !meta && (
                <Button
                  variant="secondary"
                  className="bg-white/80 hover:bg-white"
                  onClick={() => setMeta({ title: deck.title, description: deck.description })}
                >
                  <Pencil /> Edit details
                </Button>
              )}
            </div>
            {/* Deck colour: applied to cards here and in review */}
            <fieldset>
              <legend className="mb-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-soft lg:ml-auto lg:text-right">
                Card colour
              </legend>
              <div className="flex flex-wrap gap-1.5 rounded-full bg-white/60 p-1.5 shadow-[inset_0_1px_0_white]">
                {DECK_COLORS.map((c) => {
                  const on = color === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      aria-label={c.label}
                      aria-pressed={on}
                      title={c.label}
                      onClick={() => chooseColor(c.value)}
                      className={`grid size-8 place-items-center rounded-full border-2 border-white transition-transform hover:scale-110 active:scale-95 ${on ? "scale-110 shadow-[0_4px_10px_-4px_rgb(0_0_0/0.35)]" : ""}`}
                      style={{ background: on ? c.accent : c.value }}
                    >
                      {on && (
                        <Check className="size-4 text-foreground" strokeWidth={3} aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </div>
      </header>

      <div className={mine ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" : ""}>
        <div className="min-w-0 space-y-6">
          {/* ---------------- Study mode ---------------- */}
          {cards.length > 0 ? (
            <StudyPlayer id={PLAYER_ID} study={study} color={color} subject={deck.subject} />
          ) : (
            <div className="grid place-items-center rounded-[28px] bg-card px-6 py-14 text-center shadow-[0_14px_30px_-20px_oklch(0.43_0.035_280/30%)]">
              <span className="flex size-20 items-center justify-center rounded-3xl bg-[color-mix(in_oklab,var(--fc-base)_70%,white)] text-4xl shadow-[inset_0_2px_1px_white]">
                🃏
              </span>
              <h3 className="mt-5 font-display text-2xl font-black">This deck has no cards yet</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {mine
                  ? "Add your first flashcard to start building a review-ready deck."
                  : "Cards will appear here once they're added."}
              </p>
              {mine && (
                <Button
                  variant="yellow"
                  className="mt-5 bg-[var(--fc-accent)]"
                  onClick={() => openEditor()}
                >
                  <Plus /> Add a card
                </Button>
              )}
            </div>
          )}

          {/* ---------------- All cards ---------------- */}
          {cards.length > 0 && (
            <section aria-labelledby="all-cards" className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="all-cards" className="font-display text-xl font-black md:text-2xl">
                  All cards <span className="text-ink-soft">{cards.length}</span>
                </h2>
                <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                  <label className="relative flex-1 sm:w-64 sm:flex-none">
                    <span className="sr-only">Search cards</span>
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search cards"
                      className="h-10 w-full rounded-full bg-card pl-10 pr-4 text-sm ring-1 ring-border soft-inset focus:outline-none focus:ring-2 focus:ring-[var(--fc-accent)]"
                    />
                  </label>
                  {mine && (
                    <Button
                      variant="yellow"
                      size="sm"
                      className="h-10 bg-[var(--fc-accent)]"
                      onClick={() => openEditor()}
                    >
                      <Plus /> <span className="sr-only sm:not-sr-only">Add card</span>
                    </Button>
                  )}
                </div>
              </div>

              <div
                className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0"
                role="group"
                aria-label="Filter cards"
              >
                {(["all", "new", "learning", "mastered"] as const).map((f) => (
                  <FilterChip key={f} on={filter === f} onClick={() => setFilter(f)}>
                    {f === "all" ? "All" : MASTERY_LABEL[f]}
                    <span className="tabular-nums opacity-70">
                      {f === "all" ? cards.length : stats[f]}
                    </span>
                  </FilterChip>
                ))}
                {typesPresent.length > 1 && (
                  <>
                    <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
                    <FilterChip on={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
                      All types
                    </FilterChip>
                    {typesPresent.map((t) => (
                      <FilterChip key={t} on={typeFilter === t} onClick={() => setTypeFilter(t)}>
                        <CardTypeIcon type={t} className="size-3.5" /> {CARD_TYPE_LABEL[t]}
                      </FilterChip>
                    ))}
                  </>
                )}
              </div>

              {visible.length ? (
                <ul className="grid gap-3 md:grid-cols-2">
                  {visible.map(({ c, n }) => (
                    <CardTile
                      key={c.id}
                      card={c}
                      n={n}
                      mastery={cardMastery(reviews.get(c.id))}
                      current={study.current?.id === c.id}
                      editing={editing === c.id}
                      mine={mine}
                      confirming={confirmDelete === c.id}
                      onStudy={() => studyCard(c.id)}
                      onEdit={() => openEditor(c)}
                      onAskDelete={() => setConfirmDelete(c.id)}
                      onCancelDelete={() => setConfirmDelete(null)}
                      onDelete={() => remove(c.id)}
                    />
                  ))}
                </ul>
              ) : (
                <div className="rounded-[22px] bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-[0_10px_22px_-16px_oklch(0.35_0.06_285/0.3)]">
                  No cards match.{" "}
                  <button
                    type="button"
                    className="font-extrabold text-foreground underline underline-offset-2"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                      setTypeFilter("all");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ---------------- Add / edit card ---------------- */}
        {mine && (
          <aside
            ref={editorRef}
            aria-label={editing ? "Edit card" : "Add a card"}
            className="scroll-mt-24 space-y-4 self-start rounded-[28px] bg-card p-5 shadow-[0_14px_30px_-20px_oklch(0.43_0.035_280/30%),inset_0_2px_1px_oklch(1_0_0/85%)] lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-black">
                <span className="grid size-8 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--fc-accent)_30%,white)] text-[var(--fc-ink)]">
                  {editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                </span>
                {editing ? "Edit card" : "Add a card"}
              </h2>
              {editing && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-extrabold text-ink-soft">
                  Card {cards.findIndex((c) => c.id === editing) + 1}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Card type">
              {CARD_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors ${form.type === t ? "bg-[var(--fc-accent)] shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]" : "bg-muted hover:bg-secondary"}`}
                >
                  <CardTypeIcon type={t} className="size-3.5" /> {CARD_TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            <Field
              label={form.type === "cloze" ? "Title" : "Front"}
              count={form.front.length}
              max={300}
            >
              <input
                ref={frontInputRef}
                className="w-full rounded-2xl bg-muted px-4 py-3 soft-inset focus:outline-none focus:ring-2 focus:ring-[var(--fc-accent)]"
                placeholder={form.type === "cloze" ? "e.g. ADH action" : "Question or prompt"}
                value={form.front}
                onChange={(e) => setForm({ ...form, front: e.target.value })}
                maxLength={300}
              />
            </Field>
            {form.type === "cloze" && (
              <Field
                label="Cloze text"
                count={form.cloze_text.length}
                max={400}
                hint="Wrap hidden parts in {{c1::…}}"
              >
                <textarea
                  className="w-full rounded-2xl bg-muted px-4 py-3 soft-inset focus:outline-none focus:ring-2 focus:ring-[var(--fc-accent)]"
                  placeholder="ADH inserts {{c1::aquaporin-2}} channels"
                  value={form.cloze_text}
                  onChange={(e) => setForm({ ...form, cloze_text: e.target.value })}
                  maxLength={400}
                  rows={3}
                />
              </Field>
            )}
            <Field
              label={form.type === "cloze" ? "Notes" : "Back"}
              count={form.back.length}
              max={600}
              hint="One line per point shows as separate answer boxes"
            >
              <textarea
                className="w-full rounded-2xl bg-muted px-4 py-3 soft-inset focus:outline-none focus:ring-2 focus:ring-[var(--fc-accent)]"
                placeholder="Answer"
                value={form.back}
                onChange={(e) => setForm({ ...form, back: e.target.value })}
                maxLength={600}
                rows={3}
              />
            </Field>
            {form.type !== "basic" && form.type !== "cloze" && (
              <Field label="Image link">
                <input
                  className="w-full rounded-2xl bg-muted px-4 py-3 soft-inset focus:outline-none focus:ring-2 focus:ring-[var(--fc-accent)]"
                  placeholder="https://…"
                  inputMode="url"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                />
              </Field>
            )}

            <div>
              <p className="mb-2 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-ink-soft">
                Live preview
                <span className="normal-case tracking-normal text-muted-foreground">
                  tap to flip
                </span>
              </p>
              <Flashcard
                compact
                card={previewCard}
                color={color}
                subject={deck.subject}
                flipped={previewFlipped}
                onFlip={() => setPreviewFlipped((f) => !f)}
              />
            </div>

            {msg && (
              <p role="status" className="rounded-2xl bg-muted px-4 py-2.5 text-sm font-bold">
                {msg}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="yellow"
                className="bg-[var(--fc-accent)]"
                onClick={save}
                disabled={saving}
              >
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
                    setMsg("");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/flashcards"
      className="inline-flex items-center gap-1 rounded-full text-sm font-extrabold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Decks
    </Link>
  );
}

function MasteryBar({ stats, total }: { stats: Record<Mastery, number>; total: number }) {
  const order: Mastery[] = ["mastered", "learning", "new"];
  return (
    <div className="mt-3">
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/70 p-0.5 shadow-[inset_0_2px_4px_oklch(0.43_0.035_280/10%)]"
        role="img"
        aria-label={`${stats.mastered} mastered, ${stats.learning} learning, ${stats.new} new`}
      >
        {order.map((m) =>
          stats[m] ? (
            <span
              key={m}
              className={`h-full rounded-full ${MASTERY_STYLE[m].bar}`}
              style={{ width: `${(stats[m] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink-soft">
        {order.map((m) => (
          <li
            key={m}
            className="inline-flex items-center gap-1.5"
            title={
              m === "mastered"
                ? `Next review is ${MASTERED_INTERVAL_DAYS}+ days away`
                : m === "learning"
                  ? "Seen, still building up the interval"
                  : "Not reviewed yet"
            }
          >
            <span className={`size-2 rounded-full ${MASTERY_STYLE[m].dot}`} aria-hidden />
            {stats[m]} {MASTERY_LABEL[m].toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors active:scale-95 ${on ? "bg-[var(--fc-accent)] shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]" : "bg-card shadow-[0_4px_10px_-8px_oklch(0.35_0.06_285/0.5)] hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  count,
  max,
  hint,
  children,
}: {
  label: string;
  count?: number;
  max?: number;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-xs font-extrabold text-ink-soft">
        <span>{label}</span>
        {max !== undefined && (
          <span
            className={`tabular-nums ${count && count > max * 0.9 ? "text-[var(--fc-ink)]" : "text-muted-foreground"}`}
          >
            {count}/{max}
          </span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1 block px-1 text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function CardTile({
  card,
  n,
  mastery,
  current,
  editing,
  mine,
  confirming,
  onStudy,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  card: Card;
  n: number;
  mastery: Mastery;
  current: boolean;
  editing: boolean;
  mine: boolean;
  confirming: boolean;
  onStudy: () => void;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const iconBtn =
    "grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white hover:text-foreground active:scale-95";
  return (
    <li
      className="fc-tile flex flex-col p-4"
      data-current={current || editing ? "true" : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="fc-answer-num flex size-7 shrink-0 items-center justify-center text-xs font-black tabular-nums">
          {n}
        </span>
        <span className="fc-badge inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-extrabold">
          <CardTypeIcon type={card.type} className="size-3.5" /> {CARD_TYPE_LABEL[card.type]}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${MASTERY_STYLE[mastery].pill}`}
        >
          <span className={`size-1.5 rounded-full ${MASTERY_STYLE[mastery].dot}`} aria-hidden />
          {MASTERY_LABEL[mastery]}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-full bg-pink px-3 py-1 text-xs font-black shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] active:scale-95"
              >
                Delete
              </button>
              <button
                type="button"
                aria-label="Keep card"
                onClick={onCancelDelete}
                className={iconBtn}
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label={`Study card ${n}`}
                title="Study this card"
                onClick={onStudy}
                className={iconBtn}
              >
                <Eye className="size-4" />
              </button>
              {mine && (
                <>
                  <button
                    type="button"
                    aria-label={`Edit card ${n}`}
                    title="Edit"
                    onClick={onEdit}
                    className={iconBtn}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete card ${n}`}
                    title="Delete"
                    onClick={onAskDelete}
                    className={iconBtn}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <button type="button" onClick={onStudy} className="mt-3 flex flex-1 flex-col text-left">
        <span className="flex gap-2.5">
          <span className="fc-accent-bar" data-thin aria-hidden />
          <span className="min-w-0 font-display font-black leading-snug">
            {card.type === "cloze" && card.front.trim() ? card.front : promptText(card)}
          </span>
        </span>
        <span className="fc-answer mt-3 line-clamp-5 whitespace-pre-line px-3.5 py-2.5 text-sm leading-relaxed text-ink-soft">
          {card.type === "cloze" && card.cloze_text ? (
            <ClozeText text={card.cloze_text} revealed />
          ) : (
            card.back
          )}
        </span>
        {card.image_url && (
          <img
            src={card.image_url}
            alt=""
            className="mt-2 max-h-28 w-full rounded-xl bg-white/70 object-contain p-1"
          />
        )}
      </button>
    </li>
  );
}
