// src/server/db/schema.ts
import { relations, sql } from "drizzle-orm";
import { uniqueIndex } from "drizzle-orm/pg-core";

import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import { type AdapterAccount } from "@auth/core/adapters";
import { type InputProps } from "~/types/input-props";
import { type JsonPatch } from "~/types/json-patch";
import { type AnimationDesignBrief } from "~/lib/schemas/animationDesignBrief.schema";

// Import the InputProps type for the projects table


/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `bazaar-vid_${name}`);


export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .default(sql`CURRENT_TIMESTAMP`),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verificationToken", // Renamed to singular camel-case for Drizzle-adapter compatibility
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// --- Projects table ---
// Stores Remotion player state per user.
// The `props` column stores the full canonical state as JSON.
export const projects = createTable(
  "project",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    userId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    title: d.varchar({ length: 255 }).notNull(),
    props: d.jsonb().$type<InputProps>().notNull(),
    createdAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("project_user_idx").on(t.userId),
    index("project_title_idx").on(t.title),
    uniqueIndex("project_unique_name").on(t.userId, t.title), // Added unique index on projects.title per user
  ],
);

export const projectsRelations = relations(projects, ({ many }) => ({ // Added projectsRelations
  patches: many(patches),
  messages: many(messages), // Add relation to messages
}));

// --- Patches table ---
// Stores JSON patches for projects, referencing the project by ID.
export const patches = createTable(
  "patch",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d.uuid().notNull().references(() => projects.id, { onDelete: "cascade" }),
    patch: d.jsonb().$type<JsonPatch>().notNull(),
    createdAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [index("patch_project_idx").on(t.projectId)],
);

export const patchesRelations = relations(patches, ({ one }) => ({ // Added patchesRelations
  project: one(projects, { fields: [patches.projectId], references: [projects.id] }),
}));

// --- Messages table ---
// Stores chat messages for projects
export const messages = createTable(
  "message",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d
      .uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    content: d.text().notNull(),
    role: d.varchar({ length: 50 }).notNull(), // 'user' or 'assistant'
    kind: d.varchar({ length: 50 }).default("message").notNull(), // 'message' | 'status'
    status: d.varchar({ length: 50 }), // 'pending' | 'building' | 'success' | 'error'
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => new Date()),
    originalTsxCode: d.text(), // Store the original code before fixing
    lastFixAttempt: d.timestamp({ withTimezone: true }), // When the last fix attempt was made
    fixIssues: d.text(), // Issues identified and fixed by the preprocessor
  }),
  (t) => [
    index("message_project_idx").on(t.projectId),
    index("message_status_idx").on(t.status),
  ],
);

export const messagesRelations = relations(messages, ({ one }) => ({
  project: one(projects, { fields: [messages.projectId], references: [projects.id] }),
}));

// --- Custom Component Jobs table ---
// Stores jobs for generating and compiling custom Remotion components
export const customComponentJobs = createTable(
  "custom_component_job",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d
      .uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    effect: d.text().notNull(), // Natural language description of the effect
    tsxCode: d.text(), // Generated TSX code for the component
    metadata: d.jsonb(), // NEW – intent or other metadata
    statusMessageId: d.uuid().references(() => messages.id), // Link to status message for streaming updates
    status: d.varchar({ length: 50 }).default("pending").notNull(), // "pending"|"building"|"success"|"error"
    outputUrl: d.text(), // URL to the compiled JS hosted on R2
    errorMessage: d.text(), // Error message if compilation failed
    retryCount: d.integer().default(0).notNull(), // Number of retry attempts
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => new Date()),
    originalTsxCode: d.text(), // Store the original code before fixing
    lastFixAttempt: d.timestamp({ withTimezone: true }), // When the last fix attempt was made
    fixIssues: d.text() // Issues identified and fixed by the preprocessor
  }),
  (t) => [
    index("custom_component_job_project_idx").on(t.projectId),
    index("custom_component_job_status_idx").on(t.status),
  ],
);

// Add relations for custom component jobs
export const customComponentJobsRelations = relations(customComponentJobs, ({ one }) => ({
  project: one(projects, { fields: [customComponentJobs.projectId], references: [projects.id] }),
}));

// --- Component Errors table ---
// Stores errors for custom component jobs
export const componentErrors = createTable(
  "component_error",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    jobId: d
      .uuid()
      .notNull()
      .references(() => customComponentJobs.id, { onDelete: "cascade" }),
    errorType: d.varchar({ length: 100 }).notNull(),
    details: d.text().notNull(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [index("component_error_job_idx").on(t.jobId)],
);

export const componentErrorsRelations = relations(componentErrors, ({ one }) => ({
  job: one(customComponentJobs, {
    fields: [componentErrors.jobId],
    references: [customComponentJobs.id],
  }),
}));

// --- Metrics table ---
export const metrics = createTable(
  "metric",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    name: d.varchar({ length: 100 }).notNull(),
    value: d.real().notNull(),
    tags: d.jsonb(),
    timestamp: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  })
);

// --- Scene Plans table ---
// Stores LLM reasoning about scene planning
export const scenePlans = createTable(
  "scene_plan",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d
      .uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    messageId: d
      .uuid()
      .references(() => messages.id, { onDelete: "cascade" }),
    rawReasoning: d.text().notNull(), // Raw LLM reasoning about the plan
    planData: d.jsonb().notNull(), // The structured scene plan data
    userPrompt: d.text().notNull(), // Prompt that generated this plan
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    index("scene_plan_project_idx").on(t.projectId),
  ],
);

export const scenePlansRelations = relations(scenePlans, ({ one }) => ({
  project: one(projects, { fields: [scenePlans.projectId], references: [projects.id] }),
  message: one(messages, { fields: [scenePlans.messageId], references: [messages.id] }),
}));

// --- Animation Design Briefs table ---
// Stores detailed animation specifications that bridge scene plans and component generation
export const animationDesignBriefs = createTable(
  "animation_design_brief",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d
      .uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sceneId: d.uuid().notNull(), // References scene plan ID (or scene ID within project)
    componentJobId: d
      .uuid()
      .references(() => customComponentJobs.id), // Optional link to component job
    designBrief: d.jsonb().$type<AnimationDesignBrief>().notNull(), // The structured design brief
    llmModel: d.varchar({ length: 100 }).notNull(), // Model used to generate the brief
    status: d
      .varchar({ length: 50 })
      .default("pending")
      .notNull(), // "pending"|"complete"|"error"
    errorMessage: d.text(), // Error message if generation failed
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => new Date()),
    originalTsxCode: d.text(), // Store the original code before fixing
    lastFixAttempt: d.timestamp({ withTimezone: true }), // When the last fix attempt was made
    fixIssues: d.text(), // Issues identified and fixed by the preprocessor
  }),
  (t) => [
    index("animation_design_brief_project_idx").on(t.projectId),
    index("animation_design_brief_scene_idx").on(t.sceneId),
    index("animation_design_brief_component_idx").on(t.componentJobId),
  ],
);

export const animationDesignBriefsRelations = relations(animationDesignBriefs, ({ one }) => ({
  project: one(projects, { fields: [animationDesignBriefs.projectId], references: [projects.id] }),
  componentJob: one(customComponentJobs, { 
    fields: [animationDesignBriefs.componentJobId], 
    references: [customComponentJobs.id] 
  }),
}));
