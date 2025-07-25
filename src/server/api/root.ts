// src/server/api/root.ts
import { projectRouter } from "~/server/api/routers/project";
import { chatRouter } from "~/server/api/routers/chat";
import { renderRouter } from "~/server/api/routers/render";
import { generationUniversalRouter } from "~/server/api/routers/generation.universal";
import { voiceRouter } from "~/server/api/routers/voice";
import { feedbackRouter } from "~/server/api/routers/feedback";
import { emailSubscriberRouter } from "~/server/api/routers/emailSubscriber";
import { scenesRouter } from "~/server/api/routers/scenes";
import { shareRouter } from "~/server/api/routers/share";
import { adminRouter } from "~/server/api/routers/admin";
import { createSceneFromPlanRouter } from "~/server/api/routers/generation/create-scene-from-plan";
import { usageRouter } from "~/server/api/routers/usage";
import { paymentRouter } from "~/server/api/routers/payment";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
// Import server initialization to start background processes
import "~/server/init";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  project: projectRouter,
  chat: chatRouter,
  render: renderRouter,
  generation: generationUniversalRouter,
  voice: voiceRouter,
  feedback: feedbackRouter,
  emailSubscriber: emailSubscriberRouter,
  scenes: scenesRouter,
  share: shareRouter,
  admin: adminRouter,
  createSceneFromPlan: createSceneFromPlanRouter,
  usage: usageRouter,
  payment: paymentRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
