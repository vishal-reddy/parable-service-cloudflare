import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { stories, acts, beats, characters, locations } from "../db/schema";
import {
  CreateStorySchema,
  UpdateStorySchema,
  PaginationSchema,
} from "../types";
import type { Env } from "../types";

export const storiesRoutes = new Hono<{ Bindings: Env }>();

// List stories with pagination
storiesRoutes.get("/", async (c) => {
  const { limit, offset } = PaginationSchema.parse(c.req.query());
  const db = drizzle(c.env.DB);

  const storyList = await db
    .select()
    .from(stories)
    .limit(limit)
    .offset(offset)
    .orderBy(stories.created_at);

  return c.json({ stories: storyList, limit, offset });
});

// Get sample stories
storiesRoutes.get("/samples", async (c) => {
  const db = drizzle(c.env.DB);
  const sampleStories = await db.select().from(stories).limit(5);
  return c.json({ stories: sampleStories });
});

// Get story by ID with nested data
storiesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [story] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, id))
    .limit(1);

  if (!story) {
    return c.json({ error: "Story not found" }, 404);
  }

  const storyActs = await db
    .select()
    .from(acts)
    .where(eq(acts.story_id, id))
    .orderBy(acts.position);

  const actsWithBeats = await Promise.all(
    storyActs.map(async (act) => {
      const actBeats = await db
        .select()
        .from(beats)
        .where(eq(beats.act_id, act.id))
        .orderBy(beats.position);
      return { ...act, beats: actBeats };
    })
  );

  const storyCharacters = await db
    .select()
    .from(characters)
    .where(eq(characters.story_id, id));

  const storyLocations = await db
    .select()
    .from(locations)
    .where(eq(locations.story_id, id));

  return c.json({
    ...story,
    acts: actsWithBeats,
    characters: storyCharacters,
    locations: storyLocations,
  });
});

// Create story
storiesRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const validated = CreateStorySchema.parse(body);
  const db = drizzle(c.env.DB);

  const storyId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(stories).values({
    id: storyId,
    title: validated.title,
    description: validated.description ?? null,
    created_at: now,
    updated_at: now,
  });

  // Insert acts and beats
  if (validated.acts) {
    for (const act of validated.acts) {
      const actId = crypto.randomUUID();
      await db.insert(acts).values({
        id: actId,
        story_id: storyId,
        title: act.title,
        description: act.description ?? null,
        type: act.type,
        position: act.position,
      });

      if (act.beats) {
        for (const beat of act.beats) {
          await db.insert(beats).values({
            id: crypto.randomUUID(),
            act_id: actId,
            description: beat.description,
            type: beat.type,
            position: beat.position,
          });
        }
      }
    }
  }

  // Insert characters
  if (validated.characters) {
    for (const char of validated.characters) {
      await db.insert(characters).values({
        id: crypto.randomUUID(),
        story_id: storyId,
        name: char.name,
        age: char.age ?? null,
        gender: char.gender,
        build: char.build,
        height: char.height,
        temperament_major: char.temperament_major,
        temperament_minor: char.temperament_minor,
      });
    }
  }

  // Insert locations
  if (validated.locations) {
    for (const loc of validated.locations) {
      await db.insert(locations).values({
        id: crypto.randomUUID(),
        story_id: storyId,
        title: loc.title,
        resemblance: loc.resemblance ?? null,
      });
    }
  }

  return c.json({ id: storyId, message: "Story created" }, 201);
});

// Update story
storiesRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const validated = UpdateStorySchema.parse(body);
  const db = drizzle(c.env.DB);

  const [existing] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Story not found" }, 404);
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (validated.title !== undefined) updates.title = validated.title;
  if (validated.description !== undefined)
    updates.description = validated.description;

  await db.update(stories).set(updates).where(eq(stories.id, id));

  // Replace nested data if provided
  if (validated.acts) {
    // Delete existing acts (cascades to beats)
    await db.delete(acts).where(eq(acts.story_id, id));
    for (const act of validated.acts) {
      const actId = crypto.randomUUID();
      await db.insert(acts).values({
        id: actId,
        story_id: id,
        title: act.title,
        description: act.description ?? null,
        type: act.type,
        position: act.position,
      });
      if (act.beats) {
        for (const beat of act.beats) {
          await db.insert(beats).values({
            id: crypto.randomUUID(),
            act_id: actId,
            description: beat.description,
            type: beat.type,
            position: beat.position,
          });
        }
      }
    }
  }

  if (validated.characters) {
    await db.delete(characters).where(eq(characters.story_id, id));
    for (const char of validated.characters) {
      await db.insert(characters).values({
        id: crypto.randomUUID(),
        story_id: id,
        name: char.name,
        age: char.age ?? null,
        gender: char.gender,
        build: char.build,
        height: char.height,
        temperament_major: char.temperament_major,
        temperament_minor: char.temperament_minor,
      });
    }
  }

  if (validated.locations) {
    await db.delete(locations).where(eq(locations.story_id, id));
    for (const loc of validated.locations) {
      await db.insert(locations).values({
        id: crypto.randomUUID(),
        story_id: id,
        title: loc.title,
        resemblance: loc.resemblance ?? null,
      });
    }
  }

  return c.json({ id, message: "Story updated" });
});

// Delete story
storiesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = drizzle(c.env.DB);

  const [existing] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Story not found" }, 404);
  }

  await db.delete(stories).where(eq(stories.id, id));
  return c.json({ message: "Story deleted" });
});
