import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Layers3, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingStudent } from "@/components/study-app";
import { SuggestionPrompt } from "@/components/suggestion-prompt";
import { fetchDecks, type Deck } from "@/lib/flashcards";
import { deckEmoji, deckTint } from "@/lib/deck-colors";
import {
  getFlashcardsIndex,
  saveDeck as saveDeckFn,
  createDeck as createDeckFn,
} from "@/lib/flashcards.functions";

export const Route = createFileRoute("/flashcards/")({
  head: () => ({
    meta: [
      { title: "Flashcards | Medley" },
      {
        name: "description",
        content: "Official and personal flashcard decks with spaced repetition review.",
      },
      { property: "og:title", content: "Flashcards | Medley" },
      {
        property: "og:description",
        content: "Official and personal flashcard decks with spaced repetition review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
    const d = await fetchDecks();
    setDecks(d);
    if (!student) return;
    const { counts, saved: savedIds, due: dueCount, suggestions } = await getFlashcardsIndex();
    setCounts(counts);
    setSaved(new Set(savedIds));
    setDue(dueCount);
    setSugg(suggestions);
  }
  useEffect(() => {
    load();
  }, [student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleSave(id: string) {
    if (!student) return;
    const s = new Set(saved);
    const willSave = !s.has(id);
    if (willSave) s.add(id);
    else s.delete(id);
    setSaved(s);
    await saveDeckFn({ data: { deckId: id, save: willSave } });
  }
  async function create() {
    if (!student || form.title.trim().length < 2) return;
    await createDeckFn({
      data: {
        title: form.title.trim(),
        subject: form.subject.trim() || undefined,
        description: form.description.trim() || undefined,
      },
    });
    setForm({ title: "", subject: "", description: "" });
    setCreating(false);
    setTab("mine");
    load();
  }

  const shown = decks.filter((d) =>
    tab === "official"
      ? d.is_official
      : tab === "mine"
        ? d.owner_student_id === student?.id
        : saved.has(d.id),
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="clay-card overflow-hidden bg-gradient-to-br from-yellow-soft to-peach/50 p-6 md:p-8">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-widest text-yellow">
              <Layers3 className="h-4 w-4" /> FLASHCARDS
            </p>
            <h1 className="mt-2 font-display text-3xl font-black md:text-5xl">Your deck library</h1>
            <p className="mt-3 max-w-xl text-sm text-ink-soft md:text-base">
              Review, build and organise your knowledge. All your active recall, in one place.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="yellow" asChild>
                <Link to="/flashcards/review" search={{}}>
                  <Layers3 /> Review now
                </Link>
              </Button>
              <Button variant="lavender" onClick={() => setTab("official")}>
                Browse official decks
              </Button>
            </div>
          </div>
          <span className="hidden size-28 shrink-0 place-items-center rounded-[28px] bg-card/70 text-6xl shadow-[inset_0_2px_1px_var(--card)] md:grid">
            🧠
          </span>
        </div>
      </div>

      {due > 0 && (
        <div className="clay-card flex flex-wrap items-center justify-between gap-4 bg-yellow-soft p-5">
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-card text-2xl shadow-[inset_0_2px_1px_var(--card)]">
              ⏰
            </span>
            <div>
              <p className="font-display text-xl font-black">{due} cards due for review</p>
              <p className="text-sm text-ink-soft">
                Keep your recall fresh · about {Math.max(2, Math.ceil((due + 10) * 0.25))} min
              </p>
            </div>
          </div>
          <Button variant="yellow" size="lg" asChild>
            <Link to="/flashcards/review" search={{}}>
              Start review →
            </Link>
          </Button>
        </div>
      )}

      {sugg.length > 0 && student && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-display text-xl font-black md:text-2xl">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-yellow-soft text-xl shadow-[inset_0_2px_1px_var(--card)]">
              ✨
            </span>
            Suggested for you
          </h2>
          <p className="text-sm text-muted-foreground">
            Built from your saved review material and quiz practice.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {sugg.map((s) => (
              <SuggestionPrompt key={s.id} studentId={student.id} s={s} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["official", "mine", "saved"] as Tab[]).map((t) => (
          <Button key={t} variant={tab === t ? "yellow" : "secondary"} onClick={() => setTab(t)}>
            {t === "official" ? "Official decks" : t === "mine" ? "My decks" : "Saved decks"}
          </Button>
        ))}
        <Button variant="yellow" className="ml-auto" onClick={() => setCreating(!creating)}>
          <Plus /> New deck
        </Button>
      </div>

      {creating && (
        <div className="clay-card space-y-3 bg-card p-5">
          <input
            className="w-full rounded-full bg-muted px-4 py-3 soft-inset"
            placeholder="Deck title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={80}
          />
          <input
            className="w-full rounded-full bg-muted px-4 py-3 soft-inset"
            placeholder="Subject (e.g. Pharmacology)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            maxLength={40}
          />
          <textarea
            className="w-full rounded-2xl bg-muted px-4 py-3 soft-inset"
            placeholder="Short description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={300}
          />
          <Button variant="yellow" onClick={create} disabled={form.title.trim().length < 2}>
            Create deck
          </Button>
        </div>
      )}

      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => (
            <div key={d.id} className="clay-card flex items-center gap-4 bg-card p-4 pr-5">
              <span
                className={`flex size-16 shrink-0 items-center justify-center rounded-3xl text-3xl shadow-[inset_0_2px_1px_var(--card)] ${deckTint(d.id)}`}
              >
                {deckEmoji(d)}
              </span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-extrabold text-ink-soft">
                  {d.subject}
                </span>
                <Link
                  to="/flashcards/$deckId"
                  params={{ deckId: d.id }}
                  className="mt-1.5 block truncate font-display text-lg font-black hover:underline"
                >
                  {d.title}
                </Link>
                <div className="mt-1 flex items-center gap-3 text-xs font-bold text-ink-soft">
                  <span>{counts[d.id] ?? 0} cards</span>
                  {d.is_official && (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Official
                    </span>
                  )}
                </div>
              </div>
              <button
                aria-label={saved.has(d.id) ? "Unsave deck" : "Save deck"}
                onClick={() => toggleSave(d.id)}
                className="clay-button flex size-9 shrink-0 items-center justify-center bg-card"
              >
                <Heart className={`h-4 w-4 ${saved.has(d.id) ? "fill-pink text-pink" : ""}`} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyLibrary
          tab={tab}
          onCreate={() => setCreating(true)}
          onBrowse={() => setTab("official")}
        />
      )}
    </div>
  );
}

function EmptyLibrary({
  tab,
  onCreate,
  onBrowse,
}: {
  tab: Tab;
  onCreate: () => void;
  onBrowse: () => void;
}) {
  const copy =
    tab === "mine"
      ? {
          icon: "🗂️",
          title: "No personal decks yet",
          body: "Create a deck to organise your own flashcards, or save questions from the Exam Generator.",
          action: (
            <Button variant="yellow" onClick={onCreate}>
              <Plus /> New deck
            </Button>
          ),
        }
      : tab === "saved"
        ? {
            icon: "🔖",
            title: "No saved decks yet",
            body: "Explore official decks and tap the heart to save the ones you want to revisit later.",
            action: (
              <Button variant="yellow" onClick={onBrowse}>
                Browse official decks →
              </Button>
            ),
          }
        : {
            icon: "📚",
            title: "No official decks yet",
            body: "Official decks will appear here as they're published.",
            action: null,
          };
  return (
    <div className="clay-card grid place-items-center bg-card px-6 py-14 text-center">
      <span className="flex size-20 items-center justify-center rounded-3xl bg-yellow-soft text-4xl shadow-[inset_0_2px_1px_var(--card)]">
        {copy.icon}
      </span>
      <h3 className="mt-5 font-display text-2xl font-black">{copy.title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{copy.body}</p>
      {copy.action && <div className="mt-5">{copy.action}</div>}
    </div>
  );
}
