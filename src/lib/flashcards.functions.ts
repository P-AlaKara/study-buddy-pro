/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/features/auth/middleware";
import type { Card, Deck, Rating, Review } from "./flashcards";
import { schedule } from "./flashcards";

async function assertDeckOwner(db: any, deckId: string, profileId: string) {
  const { data, error } = await db
    .from("flashcard_decks")
    .select("id,owner_student_id,is_official")
    .eq("id", deckId)
    .single();
  if (error || !data) throw new Error("Deck not found.");
  if (data.is_official || data.owner_student_id !== profileId) {
    throw new Error("You can only edit your own decks.");
  }
}

const cardTypeEnum = z.enum([
  "basic",
  "cloze",
  "image",
  "image_identification",
  "anatomy_labeling",
  "ecg",
  "histology",
]);

const DECK_COLUMNS =
  "id,title,description,subject,topic,organ_system,year,difficulty,is_official,owner_student_id,tags,is_published";

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

// Official decks are shared; personal decks are visible only to their owner.
export const listDecks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<Deck[]> => {
    const db = await adminDb();
    const { data, error } = await db
      .from("flashcard_decks")
      .select(DECK_COLUMNS)
      .or(`is_official.eq.true,owner_student_id.eq.${context.profileId}`)
      .order("is_official", { ascending: false })
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Deck[];
  });

// Bundled data for the deck browser: card counts, saved ids, due count, and
// pending suggestions — all scoped to the signed-in user where relevant.
export const getFlashcardsIndex = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const db = await adminDb();
    const [cards, saved, due, suggestions] = await Promise.all([
      db.from("flashcards").select("deck_id"),
      db.from("saved_decks").select("deck_id").eq("student_id", context.profileId),
      db
        .from("flashcard_reviews")
        .select("id", { count: "exact", head: true })
        .eq("student_id", context.profileId)
        .lte("due_date", new Date().toISOString()),
      db
        .from("suggested_flashcards")
        .select("id,front,back")
        .eq("student_id", context.profileId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    const counts: Record<string, number> = {};
    for (const row of cards.data ?? []) counts[row.deck_id] = (counts[row.deck_id] ?? 0) + 1;
    return {
      counts,
      saved: (saved.data ?? []).map((x: any) => x.deck_id as string),
      due: due.count ?? 0,
      suggestions: (suggestions.data ?? []) as { id: string; front: string; back: string }[],
    };
  });

export const saveDeck = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ deckId: z.string().uuid(), save: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    if (data.save) {
      await db.from("saved_decks").insert({ student_id: context.profileId, deck_id: data.deckId });
    } else {
      await db
        .from("saved_decks")
        .delete()
        .eq("student_id", context.profileId)
        .eq("deck_id", data.deckId);
    }
  });

export const createDeck = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(2).max(80),
        subject: z.string().trim().max(40).optional(),
        description: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { error } = await db.from("flashcard_decks").insert({
      title: data.title,
      subject: data.subject || "General",
      description: data.description ?? "",
      owner_student_id: context.profileId,
      is_official: false,
    });
    if (error) throw new Error(error.message);
  });

// --- Deck detail -----------------------------------------------------------
export const getDeck = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ deckId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ deck: Deck; cards: Card[] }> => {
    const db = await adminDb();
    const [{ data: deck, error: de }, { data: cards }] = await Promise.all([
      db.from("flashcard_decks").select("*").eq("id", data.deckId).single(),
      db
        .from("flashcards")
        .select("*")
        .eq("deck_id", data.deckId)
        .order("position")
        .order("created_at"),
    ]);
    if (de || !deck) throw new Error("Deck not found.");
    // Personal decks are only visible to their owner.
    if (!deck.is_official && deck.owner_student_id !== context.profileId) {
      throw new Error("Deck not found.");
    }
    return { deck: deck as unknown as Deck, cards: (cards ?? []) as unknown as Card[] };
  });

export const upsertCard = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        deckId: z.string().uuid(),
        cardId: z.string().uuid().optional(),
        type: cardTypeEnum,
        front: z.string().trim().min(1).max(300),
        back: z.string().trim().min(1).max(600),
        cloze_text: z.string().trim().max(400).nullable().optional(),
        image_url: z.string().trim().max(2000).nullable().optional(),
        position: z.number().int().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await assertDeckOwner(db, data.deckId, context.profileId);
    const payload = {
      type: data.type,
      front: data.front,
      back: data.back,
      cloze_text: data.type === "cloze" ? data.cloze_text || null : null,
      image_url: data.image_url || null,
    };
    if (data.cardId) {
      // Confirm the card belongs to this deck before updating.
      const { data: card } = await db
        .from("flashcards")
        .select("id,deck_id")
        .eq("id", data.cardId)
        .single();
      if (!card || card.deck_id !== data.deckId) throw new Error("Card not found.");
      const { error } = await db.from("flashcards").update(payload).eq("id", data.cardId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("flashcards")
        .insert({ ...payload, deck_id: data.deckId, position: data.position ?? 1 });
      if (error) throw new Error(error.message);
    }
  });

export const deleteCard = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ deckId: z.string().uuid(), cardId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await assertDeckOwner(db, data.deckId, context.profileId);
    await db.from("flashcards").delete().eq("id", data.cardId).eq("deck_id", data.deckId);
  });

export const updateDeckMeta = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        deckId: z.string().uuid(),
        title: z.string().trim().min(1).max(80),
        description: z.string().trim().max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await assertDeckOwner(db, data.deckId, context.profileId);
    const { error } = await db
      .from("flashcard_decks")
      .update({ title: data.title, description: data.description })
      .eq("id", data.deckId);
    if (error) throw new Error(error.message);
  });

export const listMyGroups = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<{ id: string; name: string }[]> => {
    const db = await adminDb();
    const { data } = await db
      .from("group_members")
      .select("group_id, groups(id,name)")
      .eq("student_id", context.profileId);
    return (data ?? []).map((r: any) => r.groups as { id: string; name: string }).filter(Boolean);
  });

export const shareDeckToGroup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ groupId: z.string().uuid(), deckId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    // Must be a member of the target group and able to see the deck.
    const { data: member } = await db
      .from("group_members")
      .select("id")
      .eq("group_id", data.groupId)
      .eq("student_id", context.profileId)
      .maybeSingle();
    if (!member) throw new Error("Join the group first.");
    const { data: deck } = await db
      .from("flashcard_decks")
      .select("id,title,is_official,owner_student_id")
      .eq("id", data.deckId)
      .single();
    if (!deck || (!deck.is_official && deck.owner_student_id !== context.profileId)) {
      throw new Error("Deck not found.");
    }
    const { error } = await db.from("group_shared_resources").insert({
      group_id: data.groupId,
      resource_type: "deck",
      resource_ref: deck.id,
      title: deck.title,
      shared_by_student_id: context.profileId,
    });
    if (error) throw new Error(error.message);
  });

// --- Review session --------------------------------------------------------
type ReviewItem = { card: Card; review: Review | null };

export const getReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ deck: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<ReviewItem[]> => {
    const db = await adminDb();

    let deckIds: string[];
    if (data.deck) {
      const { data: deck } = await db
        .from("flashcard_decks")
        .select("id,is_official,owner_student_id")
        .eq("id", data.deck)
        .maybeSingle();
      if (!deck) return [];
      let allowed = deck.is_official || deck.owner_student_id === context.profileId;
      if (!allowed) {
        const { data: save } = await db
          .from("saved_decks")
          .select("deck_id")
          .eq("student_id", context.profileId)
          .eq("deck_id", data.deck)
          .maybeSingle();
        allowed = !!save;
      }
      if (!allowed) return [];
      deckIds = [data.deck];
    } else {
      const [{ data: decks }, { data: saved }] = await Promise.all([
        db.from("flashcard_decks").select("id,is_official,owner_student_id"),
        db.from("saved_decks").select("deck_id").eq("student_id", context.profileId),
      ]);
      const savedSet = new Set((saved ?? []).map((x: any) => x.deck_id));
      deckIds = (decks ?? [])
        .filter(
          (x: any) =>
            x.is_official || x.owner_student_id === context.profileId || savedSet.has(x.id),
        )
        .map((x: any) => x.id);
    }
    if (deckIds.length === 0) return [];

    const [{ data: cards }, { data: reviews }] = await Promise.all([
      db.from("flashcards").select("*").in("deck_id", deckIds).order("position"),
      db.from("flashcard_reviews").select("*").eq("student_id", context.profileId),
    ]);
    const byCard = new Map<string, Review>(
      (reviews ?? []).map((r: any) => [r.flashcard_id as string, r as unknown as Review]),
    );
    const now = Date.now();
    const items: ReviewItem[] = ((cards ?? []) as unknown as Card[]).map((card) => ({
      card,
      review: byCard.get(card.id) ?? null,
    }));
    const due = items.filter((i) => i.review && new Date(i.review.due_date).getTime() <= now);
    const fresh = items.filter((i) => !i.review).slice(0, 10);
    return [...due, ...fresh];
  });

export const recordReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        flashcardId: z.string().uuid(),
        rating: z.enum(["again", "hard", "good", "easy"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Review | null> => {
    const db = await adminDb();
    const { data: prev } = await db
      .from("flashcard_reviews")
      .select("ease_factor,interval_days,repetitions")
      .eq("student_id", context.profileId)
      .eq("flashcard_id", data.flashcardId)
      .maybeSingle();
    const next = schedule(prev ?? null, data.rating as Rating);
    const { data: row, error } = await db
      .from("flashcard_reviews")
      .upsert(
        {
          student_id: context.profileId,
          flashcard_id: data.flashcardId,
          ...next,
          last_rating: data.rating,
          last_reviewed_at: new Date().toISOString(),
        },
        { onConflict: "student_id,flashcard_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return (row as unknown as Review) ?? null;
  });

export const createSuggestionFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        sourceType: z.enum(["quiz", "osce", "case"]),
        sourceId: z.string().max(200),
        front: z.string().min(1).max(2000),
        back: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const { data: existing } = await db
      .from("suggested_flashcards")
      .select("id,front,back,status")
      .eq("student_id", context.profileId)
      .eq("source_id", data.sourceId)
      .eq("front", data.front)
      .maybeSingle();
    if (existing) return existing;
    const { data: row, error } = await db
      .from("suggested_flashcards")
      .insert({
        student_id: context.profileId,
        source_type: data.sourceType,
        source_id: data.sourceId,
        front: data.front,
        back: data.back,
      })
      .select("id,front,back,status")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const acceptSuggestionFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        suggestionId: z.string().uuid(),
        front: z.string().min(1).max(2000),
        back: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    // Only act on a suggestion the caller owns.
    const { data: suggestion } = await db
      .from("suggested_flashcards")
      .select("id")
      .eq("id", data.suggestionId)
      .eq("student_id", context.profileId)
      .maybeSingle();
    if (!suggestion) throw new Error("Suggestion not found.");

    let { data: deck } = await db
      .from("flashcard_decks")
      .select("id")
      .eq("owner_student_id", context.profileId)
      .eq("title", "Suggested for me")
      .maybeSingle();
    if (!deck) {
      const created = await db
        .from("flashcard_decks")
        .insert({
          title: "Suggested for me",
          description: "Cards created from questions and checklist items you missed.",
          owner_student_id: context.profileId,
          is_official: false,
          subject: "Mixed",
          tags: ["suggested"],
        })
        .select("id")
        .single();
      if (created.error) throw new Error(created.error.message);
      deck = created.data;
    }

    const { data: card, error } = await db
      .from("flashcards")
      .insert({ deck_id: deck.id, type: "basic", front: data.front, back: data.back })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await db
      .from("suggested_flashcards")
      .update({ status: "added", suggested_flashcard_id: card.id })
      .eq("id", data.suggestionId)
      .eq("student_id", context.profileId);
  });

export const dismissSuggestionFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ suggestionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    await db
      .from("suggested_flashcards")
      .update({ status: "dismissed" })
      .eq("id", data.suggestionId)
      .eq("student_id", context.profileId);
  });
