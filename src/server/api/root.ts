// src/server/api/root.ts
import { projectRouter } from "~/server/api/routers/project";
import { chatRouter } from "~/server/api/routers/chat";
import { chatStreamRouter } from "~/server/api/routers/chatStream";
import { renderRouter } from "~/server/api/routers/render";
import { customComponentRouter } from "./routers/customComponent";
import { customComponentFixRouter } from "./routers/customComponentFix";
import { timelineRouter } from "~/server/api/routers/timeline";
import { videoRouter } from "~/server/api/routers/video";
import { animationRouter } from "~/server/api/routers/animation";
import { evaluationRouter } from "~/server/api/routers/evaluation";
import { debugRouter } from "~/server/api/routers/debug";
import { generationRouter } from "~/server/api/routers/generation";
import { voiceRouter } from "~/server/api/routers/voice";
import { feedbackRouter } from "~/server/api/routers/feedback";
import { emailSubscriberRouter } from "~/server/api/routers/emailSubscriber";
import { scenesRouter } from "~/server/api/routers/scenes";
import { shareRouter } from "~/server/api/routers/share";
import { adminRouter } from "~/server/api/routers/admin";
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
  chatStream: chatStreamRouter,
  render: renderRouter,
  customComponent: customComponentRouter,
  customComponentFix: customComponentFixRouter,
  timeline: timelineRouter,
  video: videoRouter,
  animation: animationRouter,
  evaluation: evaluationRouter,
  debug: debugRouter,
  generation: generationRouter,
  voice: voiceRouter,
  feedback: feedbackRouter,
  emailSubscriber: emailSubscriberRouter,
  scenes: scenesRouter,
  share: shareRouter,
  admin: adminRouter,
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
