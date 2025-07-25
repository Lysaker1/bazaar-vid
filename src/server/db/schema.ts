// src/server/db/schema.ts
import { relations, sql } from "drizzle-orm";
import { uniqueIndex } from "drizzle-orm/pg-core";

import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import { type AdapterAccount } from "@auth/core/adapters";
import { type InputProps } from "~/lib/types/video/input-props";
import { type JsonPatch } from "~/lib/types/shared/json-patch";
import { type InferSelectModel } from "drizzle-orm";

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
    .primaryKey(),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d.timestamp({
    mode: "date",
    withTimezone: true,
  }),
  image: d.text(),
  isAdmin: d.boolean().default(false).notNull(),
  stripeCustomerId: d.text("stripe_customer_id").unique(),
  createdAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sharedVideos: many(sharedVideos),
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
    expires: d.timestamp({ mode: "string", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// --- Projects table ---
// Stores Remotion player state per user.
// The `props` column stores the full canonical state as JSON.
// Audio track type for database storage
export type AudioTrack = {
  url: string;
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  volume: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  playbackRate?: number;
};

export const projects = createTable(
  "project",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    userId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    title: d.varchar({ length: 255 }).notNull(),
    props: d.jsonb().$type<InputProps>().notNull(),
    audio: d.jsonb().$type<AudioTrack>(),
    isWelcome: d.boolean().default(true).notNull(),
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
  scenes: many(scenes), // Add relation to scenes
  sharedVideos: many(sharedVideos), // Add relation to sharedVideos
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

export const patchesRelations = relations(patches, ({ one }) => ({
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
    imageUrls: d.jsonb("image_urls").$type<string[]>(), // 🚨 NEW: Support for uploaded images
    sequence: d.integer().notNull().default(0), // Message sequence number for ordering
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
    index("message_project_sequence_idx").on(t.projectId, t.sequence), // Index for efficient sequence-based queries
  ],
);

export const messagesRelations = relations(messages, ({ one }) => ({
  project: one(projects, { fields: [messages.projectId], references: [projects.id] }),
}));

// --- Scenes table ---
// Stores individual scene code and props for projects
export const scenes = createTable(
  "scene",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d.uuid().notNull().references(() => projects.id, { onDelete: "cascade" }),
    order: d.integer().notNull().default(0),
    name: d.varchar({ length: 255 }).default("Scene").notNull(),
    tsxCode: d.text().notNull(),
    props: d.jsonb(), // Scene-specific props for animation parameters
    duration: d.integer().default(150).notNull(), // Duration in frames (default 5 seconds at 30fps)
    // Publishing columns for BAZAAR-303
    publishedUrl: d.text(), // Public URL to the published bundle
    publishedHash: d.text(), // SHA-256 hash of the published bundle
    publishedAt: d.timestamp({ withTimezone: true }), // When the scene was published
    createdAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => new Date()),
    layoutJson: d.text("layout_json"), // NEW: Store JSON specification for two-step pipeline
    // Metadata for better scene targeting
    slug: d.varchar({ length: 255 }), // Auto-generated slug for identification
    dominantColors: d.jsonb(), // Array of dominant colors ["#000000", "#3B82F6"]
    firstH1Text: d.text(), // First H1 text content for easy identification
    lastFocused: d.boolean().default(false), // Track which scene user is working on
  }),
  (t) => [
    index("scene_project_idx").on(t.projectId),
    index("scene_order_idx").on(t.projectId, t.order),
    // Index for published scenes lookup
    index("scene_publish_idx").on(t.projectId, t.publishedHash),
  ],
);

export const scenesRelations = relations(scenes, ({ one }) => ({
  project: one(projects, { fields: [scenes.projectId], references: [projects.id] }),
}));

// ✅ NEW: Scene Iterations Tracking Table - Track every LLM operation for continuous improvement
export const sceneIterations = createTable(
  "scene_iteration",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    sceneId: d.uuid("scene_id").notNull().references(() => scenes.id, { onDelete: "cascade" }),
    projectId: d.uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    
    // LLM Decision Data
    operationType: d.varchar("operation_type", { length: 50 }).notNull(), // 'create', 'edit', 'delete'
    editComplexity: d.varchar("edit_complexity", { length: 20 }), // 'surgical', 'creative', 'structural'
    userPrompt: d.text("user_prompt").notNull(),
    brainReasoning: d.text("brain_reasoning"), // Brain LLM's tool selection reasoning
    toolReasoning: d.text("tool_reasoning"), // Tool's execution reasoning
    
    // Code Changes
    codeBefore: d.text("code_before"), // Previous TSX code (for edits)
    codeAfter: d.text("code_after"), // New TSX code
    changesApplied: d.jsonb("changes_applied"), // Structured list of changes
    changesPreserved: d.jsonb("changes_preserved"), // What was kept the same
    
    // Performance Metrics
    generationTimeMs: d.integer("generation_time_ms"),
    modelUsed: d.varchar("model_used", { length: 50 }), // 'gpt-4.1', 'gpt-4.1-mini', etc.
    temperature: d.real("temperature"),
    tokensUsed: d.integer("tokens_used"),
    
    // User Satisfaction Indicators
    userEditedAgain: d.boolean("user_edited_again").default(false), // Did user edit this scene again within 5 minutes?
    userSatisfactionScore: d.integer("user_satisfaction_score"), // 1-5 rating (future feature)
    sessionId: d.varchar("session_id", { length: 255 }), // Track user sessions
    changeSource: d.varchar({ length: 50 }).default('llm').notNull(), // Source of the change (llm, user, etc.)
    
    // Link to message that triggered this iteration
    messageId: d.uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    
    createdAt: d.timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [
    index("scene_iteration_scene_idx").on(t.sceneId),
    index("scene_iteration_project_idx").on(t.projectId),
    index("scene_iteration_operation_idx").on(t.operationType, t.editComplexity),
    index("scene_iteration_satisfaction_idx").on(t.userEditedAgain, t.createdAt),
    index("scene_iteration_message_idx").on(t.messageId),
  ],
);

export const sceneIterationsRelations = relations(sceneIterations, ({ one }) => ({
  scene: one(scenes, { fields: [sceneIterations.sceneId], references: [scenes.id] }),
  project: one(projects, { fields: [sceneIterations.projectId], references: [projects.id] }),
  message: one(messages, { fields: [sceneIterations.messageId], references: [messages.id] }),
}));

// --- Scene Specs table ---
// Stores SceneSpec JSON for MCP architecture
export const sceneSpecs = createTable(
  "scene_specs",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    projectId: d.uuid().notNull().references(() => projects.id, { onDelete: "cascade" }),
    sceneId: d.varchar({ length: 255 }).notNull(), // Scene identifier from SceneSpec
    name: d.varchar({ length: 255 }), // Human-readable scene name
    spec: d.jsonb().notNull(), // Complete SceneSpec JSON
    version: d.varchar({ length: 10 }).default("1.0").notNull(), // Schema version
    createdAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => new Date()),
    createdBy: d.varchar({ length: 255 }).references(() => users.id),
  }),
  (t) => [
    index("scene_spec_project_idx").on(t.projectId),
    index("scene_spec_created_at_idx").on(t.createdAt),
    index("scene_spec_scene_id_idx").on(t.sceneId),
    // Ensure unique scene_id per project
    uniqueIndex("scene_spec_unique_scene_id").on(t.projectId, t.sceneId),
    // Added missing GIN index for JSONB spec column
    index("scene_spec_spec_gin_idx").using("gin", t.spec),
  ],
);

export const sceneSpecsRelations = relations(sceneSpecs, ({ one }) => ({
  project: one(projects, { fields: [sceneSpecs.projectId], references: [projects.id] }),
  createdByUser: one(users, { fields: [sceneSpecs.createdBy], references: [users.id] }),
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
    lastSuccessfulStep: d.varchar('last_successful_step', { length: 50 }),
    nextRetryAt: d.timestamp('next_retry_at', { withTimezone: true }),
    errorContext: d.jsonb('error_context'),
    checkpointData: d.jsonb('checkpoint_data'),
    lastStep: d.varchar('last_step', { length: 50 }),
    // A2A protocol support fields
    taskId: d.text('task_id'), // A2A task ID
    internalStatus: d.varchar('internal_status', { length: 50 }), // For internal tracking
    requiresInput: d.boolean('requires_input').default(false), // Whether user input is needed
    inputType: d.text('input_type'), // What kind of input is needed
    taskState: d.jsonb('task_state'), // Current A2A task state details
    artifacts: d.jsonb('artifacts'), // A2A artifacts collection
    history: d.jsonb('history'), // Added history field for A2A task history
    sseEnabled: d.boolean('sse_enabled').default(false), // Whether SSE is enabled for this task
    // Timestamps
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => new Date()),
    
    // Original columns (using camelCase as in production)
    originalTsxCode: d.text(), // Original TSX code before fix attempts
    lastFixAttempt: d.timestamp({ withTimezone: true }), // Timestamp of last fix attempt
    fixIssues: d.text() // Issues encountered during fix attempts
  }),
  (t) => [
    index("custom_component_job_project_idx").on(t.projectId),
    index("custom_component_job_status_idx").on(t.status),
    index("custom_component_job_task_id_idx").on(t.taskId),
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
    designBrief: d.jsonb().notNull(), // Design brief data
    llmModel: d.varchar({ length: 100 }).notNull(), // Model used to generate the brief
    status: d.varchar({ length: 50 })
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
  project: one(projects, {
    fields: [animationDesignBriefs.projectId],
    references: [projects.id],
  }),
  componentJob: one(customComponentJobs, {
    fields: [animationDesignBriefs.componentJobId],
    references: [customComponentJobs.id],
  }),
}));

// --- Feedback table ---
// Stores user feedback and feature prioritization
export const feedback = createTable(
  "feedback",
  (d) => ({
    id: d.text('id').primaryKey().$defaultFn(() => crypto.randomUUID()), // Using text for createId compatibility if needed, else use uuid()
    content: d.text('content'), // Free-text comments, can be nullable if only features are prioritized
    name: d.text('name'), // Optional name provided by user
    email: d.text('email'), // Optional for anonymous, pre-filled for logged-in
    userId: d.varchar('user_id', { length: 255 }).references(() => users.id, { onDelete: 'set null' }),
    prioritizedFeatures: d.jsonb('prioritized_features').$type<string[]>(), // Array of selected feature IDs/names
    createdAt: d.timestamp('created_at', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    status: d.text('status').default('new').notNull(), // e.g., 'new', 'reviewed', 'planned', 'implemented', 'archived'
    adminNotes: d.text('admin_notes'), // For internal team notes
  }),
  (t) => [
    index("feedback_user_idx").on(t.userId),
    index("feedback_status_idx").on(t.status),
    index("feedback_created_at_idx").on(t.createdAt),
  ]
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, { fields: [feedback.userId], references: [users.id] }),
}));

// --- Email Subscribers table ---
// Stores email addresses for newsletter/updates signup
export const emailSubscribers = createTable(
  "email_subscriber",
  (d) => ({
    id: d.text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: d.text('email').notNull().unique(),
    subscribedAt: d.timestamp('subscribed_at', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    status: d.text('status').default('active').notNull(), // 'active', 'unsubscribed'
    source: d.text('source').default('homepage').notNull(), // 'homepage', 'footer', etc.
    userId: d.varchar('user_id', { length: 255 }).references(() => users.id, { onDelete: 'set null' }), // Optional link to user if logged in
  }),
  (t) => [
    index("email_subscriber_email_idx").on(t.email),
    index("email_subscriber_status_idx").on(t.status),
    index("email_subscriber_subscribed_at_idx").on(t.subscribedAt),
  ]
);

export const emailSubscribersRelations = relations(emailSubscribers, ({ one }) => ({
  user: one(users, { fields: [emailSubscribers.userId], references: [users.id] }),
}));

// --- Agent Messages table ---
// Stores messages exchanged between agents for A2A protocol support
export const agentMessages = createTable(
  "agent_message",
  (d) => ({
    id: d.text().primaryKey(), // UUID for the message
    sender: d.text("sender").notNull(), // Name of the sending agent
    recipient: d.text("recipient").notNull(), // Name of the recipient agent
    type: d.text("type").notNull(), // Type of the message (e.g., TASK_START, DATA_REQUEST)
    payload: d.jsonb("payload").$type<Record<string, any>>().notNull(), // Content of the message, typed
    correlationId: d.text("correlation_id"), // Optional ID to correlate messages
    status: d.text("status").default('pending').notNull(), // e.g., pending, processed, failed
    createdAt: d
      .timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    processedAt: d.timestamp({ withTimezone: true, mode: 'string' })
  }),
  (t) => [
    index("agent_message_correlation_id_idx").on(t.correlationId),
    index("agent_message_type_idx").on(t.type),
    index("agent_message_sender_idx").on(t.sender),
    index("agent_message_recipient_idx").on(t.recipient),
  ],
);

// Add custom index for task ID in payload
export const agentMessagesIndexes = {
  byTaskId: sql`CREATE INDEX IF NOT EXISTS "idx_agent_messages_task_id" ON "bazaar-vid_agent_message" ((payload->>'taskId'))`,
};

// Add history field to customComponentJobs to support A2A protocol task history
export const customComponentJobsUpdate = sql`
  ALTER TABLE "bazaar-vid_custom_component_job"
  ADD COLUMN IF NOT EXISTS "history" JSONB
`;

export const customComponentJobsRecoveryUpdate = sql`
  ALTER TABLE "bazaar-vid_custom_component_job"
  ADD COLUMN IF NOT EXISTS "last_successful_step" varchar(50),
  ADD COLUMN IF NOT EXISTS "next_retry_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "error_context" jsonb
`;

// --- Component Test Cases table ---
// Stores test cases for component generation evaluation
export const componentTestCases = createTable(
  "component_test_case",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    prompt: d.text().notNull(),
    category: d.varchar({ length: 50 }).notNull(),
    complexity: d.integer().notNull(),
    edgeCases: d.jsonb().default([]),
    createdAt: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  }),
  (t) => [
    index("component_test_cases_category_idx").on(t.category),
  ],
);

// --- Component Evaluation Metrics table ---
// Stores metrics from component generation evaluation
export const componentEvaluationMetrics = createTable(
  "component_evaluation_metric",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    testCaseId: d.uuid().notNull().references(() => componentTestCases.id),
    timestamp: d.timestamp({ withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    
    // Test case metadata
    category: d.varchar({ length: 50 }).notNull(),
    complexity: d.integer().notNull(),
    edgeCases: d.jsonb().default([]),
    
    // Pipeline success metrics
    success: d.boolean().notNull(),
    errorStage: d.varchar({ length: 50 }),
    errorType: d.varchar({ length: 100 }),
    errorMessage: d.text(),
    
    // Timing metrics
    promptSubmissionTime: d.timestamp({ withTimezone: true }).notNull(),
    codeGenerationStartTime: d.timestamp({ withTimezone: true }),
    codeGenerationEndTime: d.timestamp({ withTimezone: true }),
    validationStartTime: d.timestamp({ withTimezone: true }),
    validationEndTime: d.timestamp({ withTimezone: true }),
    buildStartTime: d.timestamp({ withTimezone: true }),
    buildEndTime: d.timestamp({ withTimezone: true }),
    uploadStartTime: d.timestamp({ withTimezone: true }),
    uploadEndTime: d.timestamp({ withTimezone: true }),
    componentCompletionTime: d.timestamp({ withTimezone: true }),
    
    // Derived timing metrics
    timeToFirstToken: d.integer(),
    codeGenerationTime: d.integer(),
    validationTime: d.integer(),
    buildTime: d.integer(),
    uploadTime: d.integer(),
    totalTime: d.integer(),
    
    // Code quality metrics
    syntaxErrorCount: d.integer(),
    eslintErrorCount: d.integer(),
    eslintWarningCount: d.integer(),
    codeLength: d.integer(),
    
    // Rendering metrics
    renderSuccess: d.boolean(),
    renderErrorMessage: d.text(),
    
    // References
    componentId: d.varchar({ length: 100 }),
    outputUrl: d.text(),
    taskId: d.uuid(),
    
    // A2A specific metrics
    stateTransitions: d.jsonb().default([]),
    artifacts: d.jsonb().default([]),
    
    // Analysis fields
    analysisNotes: d.text(),
    tags: d.jsonb().default([]),
  }),
  (t) => [
    index("component_evaluation_metrics_test_case_id_idx").on(t.testCaseId),
    index("component_evaluation_metrics_success_idx").on(t.success),
    index("component_evaluation_metrics_timestamp_idx").on(t.timestamp),
    index("component_evaluation_metrics_category_idx").on(t.category),
  ],
);

export const componentEvaluationMetricsRelations = relations(componentEvaluationMetrics, ({ one }) => ({
  testCase: one(componentTestCases, { fields: [componentEvaluationMetrics.testCaseId], references: [componentTestCases.id] }),
}));

// Export inferred type for customComponentJobs table
export type ComponentJob = InferSelectModel<typeof customComponentJobs>;

// Export inferred type for scenes table
export type Scene = InferSelectModel<typeof scenes>;

// Define and export TaskStatus type
export type TaskStatus = "pending" | "building" | "success" | "error";

// --- Shared Videos table ---
// Stores shared videos for public video sharing
export const sharedVideos = createTable(
  "shared_video",
  (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: d.uuid().notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: d.varchar({ length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    title: d.varchar({ length: 255 }),
    description: d.text(),
    videoUrl: d.varchar({ length: 500 }), // R2 public URL
    thumbnailUrl: d.varchar({ length: 500 }),
    isPublic: d.boolean().default(true),
    viewCount: d.integer().default(0),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    expiresAt: d.timestamp({ withTimezone: true }), // Optional expiration
  }),
);

export const sharedVideosRelations = relations(sharedVideos, ({ one }) => ({
  project: one(projects, {
    fields: [sharedVideos.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [sharedVideos.userId],
    references: [users.id],
  }),
}));

// --- Phase 2: Project Memory & Image Analysis Tables for Async Context Storage ---

/**
 * Project Memory Table: Stores accumulated context across user sessions
 * Enables 30+ prompt workflows with persistent user preferences and scene relationships
 */
export const projectMemory = createTable("project_memory", (d) => ({
  id: d.uuid().primaryKey().defaultRandom(),
  projectId: d.uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  memoryType: d.varchar("memory_type", { length: 50 }).notNull(), // 'user_preference', 'scene_relationship', 'conversation_context'
  memoryKey: d.varchar("memory_key", { length: 255 }).notNull(), // e.g., 'duration_preference', 'style_preference', 'scene_reference'
  memoryValue: d.text("memory_value").notNull(), // JSON or text value
  confidence: d.real("confidence").default(0.8), // 0.0-1.0 confidence score
  sourcePrompt: d.text("source_prompt"), // Original user prompt that created this memory
  createdAt: d.timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: d.timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).$onUpdate(() => new Date()),
  expiresAt: d.timestamp("expires_at", { withTimezone: true }), // Optional expiration for temporary context
}), (t) => [
  index("project_memory_project_idx").on(t.projectId),
  index("project_memory_type_key_idx").on(t.memoryType, t.memoryKey),
]);

/**
 * Image Analysis Table: Stores persistent image facts from vision analysis
 * Supports fire-and-forget async image processing with late-arriving facts integration
 */
export const imageAnalysis = createTable("image_analysis", (d) => ({
  id: d.uuid().primaryKey().defaultRandom(),
  projectId: d.uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  traceId: d.varchar("trace_id", { length: 100 }).notNull(), // From startAsyncImageAnalysis()
  imageUrls: d.jsonb("image_urls").notNull(), // Array of uploaded image URLs
  palette: d.jsonb("palette").notNull(), // Extracted color palette  
  typography: d.text("typography").notNull(), // Typography analysis
  mood: d.text("mood").notNull(), // Style mood analysis
  layoutJson: d.jsonb("layout_json"), // Structured layout analysis
  processingTimeMs: d.integer("processing_time_ms").notNull(),
  createdAt: d.timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  usedInScenes: d.jsonb("used_in_scenes"), // Track which scenes used this analysis
}), (t) => [
  index("image_analysis_project_idx").on(t.projectId),
  index("image_analysis_trace_idx").on(t.traceId),
  index("image_analysis_created_idx").on(t.createdAt),
]);

// Relations for project memory
export const projectMemoryRelations = relations(projectMemory, ({ one }) => ({
  project: one(projects, {
    fields: [projectMemory.projectId],
    references: [projects.id],
  }),
}));

// Relations for image analysis
export const imageAnalysisRelations = relations(imageAnalysis, ({ one }) => ({
  project: one(projects, {
    fields: [imageAnalysis.projectId],
    references: [projects.id],
  }),
}));

// Memory type enum for better type safety
export const MEMORY_TYPES = {
  USER_PREFERENCE: 'user_preference',
  SCENE_RELATIONSHIP: 'scene_relationship', 
  CONVERSATION_CONTEXT: 'conversation_context',
} as const;

export type MemoryType = typeof MEMORY_TYPES[keyof typeof MEMORY_TYPES];

// Type exports for TypeScript
export type ProjectMemory = typeof projectMemory.$inferSelect;
export type InsertProjectMemory = typeof projectMemory.$inferInsert;

export type ImageAnalysis = typeof imageAnalysis.$inferSelect;
export type InsertImageAnalysis = typeof imageAnalysis.$inferInsert;

// --- Exports table ---
// Stores video export records for tracking and analytics
export const exports = createTable("exports", (d) => ({
  id: d.uuid("id").primaryKey().defaultRandom(),
  userId: d.varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: d.uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  renderId: d.text("render_id").notNull().unique(),
  status: d.text("status", { 
    enum: ["pending", "rendering", "completed", "failed"] 
  }).notNull().default("pending"),
  progress: d.integer("progress").default(0),
  format: d.text("format", { 
    enum: ["mp4", "webm", "gif"] 
  }).notNull().default("mp4"),
  quality: d.text("quality", { 
    enum: ["low", "medium", "high"] 
  }).notNull().default("high"),
  outputUrl: d.text("output_url"),
  fileSize: d.integer("file_size"), // in bytes
  duration: d.integer("duration"), // in frames
  error: d.text("error"),
  metadata: d.jsonb("metadata"), // For storing additional info like resolution, fps, etc.
  downloadCount: d.integer("download_count").default(0),
  lastDownloadedAt: d.timestamp("last_downloaded_at"),
  createdAt: d.timestamp("created_at").defaultNow().notNull(),
  completedAt: d.timestamp("completed_at"),
}), (t) => [
  index("exports_user_idx").on(t.userId),
  index("exports_project_idx").on(t.projectId),
  index("exports_render_idx").on(t.renderId),
  index("exports_created_idx").on(t.createdAt),
]);

export const exportsRelations = relations(exports, ({ one }) => ({
  user: one(users, {
    fields: [exports.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [exports.projectId],
    references: [projects.id],
  }),
}));

// Export analytics table for tracking detailed metrics
export const exportAnalytics = createTable("export_analytics", (d) => ({
  id: d.uuid("id").primaryKey().defaultRandom(),
  exportId: d.uuid("export_id").notNull().references(() => exports.id, { onDelete: "cascade" }),
  event: d.text("event", {
    enum: ["started", "progress", "completed", "failed", "downloaded", "viewed"]
  }).notNull(),
  eventData: d.jsonb("event_data"), // Additional event-specific data
  userAgent: d.text("user_agent"),
  ipAddress: d.text("ip_address"),
  createdAt: d.timestamp("created_at").defaultNow().notNull(),
}), (t) => [
  index("export_analytics_export_idx").on(t.exportId),
  index("export_analytics_event_idx").on(t.event),
  index("export_analytics_created_idx").on(t.createdAt),
]);

export const exportAnalyticsRelations = relations(exportAnalytics, ({ one }) => ({
  export: one(exports, {
    fields: [exportAnalytics.exportId],
    references: [exports.id],
  }),
}));

// --- Credit System Tables ---

// User credit balances
export const userCredits = createTable("user_credits", (d) => ({
  userId: d.varchar("user_id", { length: 255 })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dailyCredits: d.integer("daily_credits").default(150).notNull(),
  purchasedCredits: d.integer("purchased_credits").default(0).notNull(),
  lifetimeCredits: d.integer("lifetime_credits").default(0).notNull(), // Total ever purchased
  dailyResetAt: d.timestamp("daily_reset_at", { withTimezone: true }).notNull(),
  createdAt: d.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: d.timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}), (t) => [
  index("user_credits_daily_reset_idx").on(t.dailyResetAt),
]);

export const userCreditsRelations = relations(userCredits, ({ one, many }) => ({
  user: one(users, {
    fields: [userCredits.userId],
    references: [users.id],
  }),
  transactions: many(creditTransactions),
}));

// Credit transaction history
export const creditTransactions = createTable("credit_transaction", (d) => ({
  id: d.uuid("id").primaryKey().defaultRandom(),
  userId: d.varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: d.text("type", {
    enum: ["daily_grant", "purchase", "usage", "refund", "bonus", "adjustment"]
  }).notNull(),
  amount: d.integer("amount").notNull(), // Positive for additions, negative for usage
  balance: d.integer("balance").notNull(), // Balance after transaction
  description: d.text("description").notNull(),
  metadata: d.jsonb("metadata"), // Additional data (e.g., what it was used for)
  stripePaymentIntentId: d.text("stripe_payment_intent_id"), // For purchases
  createdAt: d.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}), (t) => [
  index("credit_transactions_user_idx").on(t.userId),
  index("credit_transactions_type_idx").on(t.type),
  index("credit_transactions_created_idx").on(t.createdAt),
  index("credit_transactions_stripe_idx").on(t.stripePaymentIntentId),
]);

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
}));

// Credit packages for purchase
export const creditPackages = createTable("credit_package", (d) => ({
  id: d.uuid("id").primaryKey().defaultRandom(),
  name: d.varchar("name", { length: 100 }).notNull(),
  credits: d.integer("credits").notNull(),
  price: d.integer("price").notNull(), // In cents
  stripePriceId: d.text("stripe_price_id").unique(), // Once we create in Stripe
  bonusPercentage: d.integer("bonus_percentage").default(0).notNull(),
  popular: d.boolean("popular").default(false).notNull(),
  active: d.boolean("active").default(true).notNull(),
  sortOrder: d.integer("sort_order").default(0).notNull(),
  createdAt: d.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}), (t) => [
  index("credit_packages_active_idx").on(t.active),
  index("credit_packages_sort_idx").on(t.sortOrder),
]);

// --- Simple Usage Limits & Tracking Tables ---

// Simple configurable limits (free tier only, pro tier uses credits)
export const usageLimits = createTable("usage_limit", (d) => ({
  id: d.uuid("id").primaryKey().defaultRandom(),
  limitKey: d.varchar("limit_key", { length: 100 }).notNull().unique(),
  freeTierLimit: d.integer("free_tier_limit").default(0).notNull(),
  description: d.text("description"),
  resetPeriod: d.varchar("reset_period", { length: 20 }).default("daily").notNull(), // 'daily', 'per_project', 'never'
  isActive: d.boolean("is_active").default(true).notNull(),
  createdAt: d.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: d.timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}), (t) => [
  index("usage_limits_active_idx").on(t.isActive),
  index("usage_limits_reset_period_idx").on(t.resetPeriod),
]);

// Daily usage tracking per user
export const userUsage = createTable("user_usage", (d) => ({
  id: d.uuid("id").primaryKey().defaultRandom(),
  userId: d.varchar("user_id", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: d.date("date").notNull(),
  usageType: d.varchar("usage_type", { length: 50 }).notNull(), // 'prompts', 'projects', 'exports'
  count: d.integer("count").default(0).notNull(),
  projectId: d.uuid("project_id").references(() => projects.id, { onDelete: "set null" }), // For per-project limits
  metadata: d.jsonb("metadata"), // Additional usage details
  createdAt: d.timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: d.timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}), (t) => [
  index("user_usage_user_date_idx").on(t.userId, t.date),
  index("user_usage_type_idx").on(t.usageType),
  index("user_usage_project_idx").on(t.projectId),
  // Ensure unique usage per user per date per type
  uniqueIndex("user_usage_unique_idx").on(t.userId, t.date, t.usageType),
]);

// Relations for usage tables
export const usageLimitsRelations = relations(usageLimits, ({ many }) => ({
  // No direct relations needed for configuration table
}));

export const userUsageRelations = relations(userUsage, ({ one }) => ({
  user: one(users, {
    fields: [userUsage.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [userUsage.projectId],
    references: [projects.id],
  }),
}));
