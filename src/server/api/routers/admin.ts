import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users, projects, scenes, feedback, messages } from "~/server/db/schema";
import { sql, and, gte, desc, count, eq, like, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Input schema for timeframe filtering
const timeframeSchema = z.enum(['all', '30d', '24h']).default('all');

// User update schema - now includes isAdmin
const userUpdateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  image: z.string().url().optional().nullable(),
  isAdmin: z.boolean().optional(),
});

// Admin-only procedure that checks if user is admin
const adminOnlyProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Check if user is admin
  const user = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, ctx.session.user.id))
    .limit(1);

  if (!user[0]?.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next();
});

export const adminRouter = createTRPCRouter({
  // Check if current user is admin
  checkAdminAccess: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);

      return {
        isAdmin: user[0]?.isAdmin || false,
      };
    }),

  // Toggle user admin status - admin only
  toggleUserAdmin: adminOnlyProcedure
    .input(z.object({ 
      userId: z.string(),
      isAdmin: z.boolean() 
    }))
    .mutation(async ({ input }) => {
      const updatedUser = await db
        .update(users)
        .set({ isAdmin: input.isAdmin })
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          isAdmin: users.isAdmin,
        });

      if (!updatedUser[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return updatedUser[0];
    }),

  // Get total users count with timeframe filtering - admin only
  getTotalUsers: adminOnlyProcedure
    .input(z.object({ timeframe: timeframeSchema }))
    .query(async ({ input }) => {
      let whereCondition;

      if (input.timeframe === '24h') {
        // Use createdAt for user creation time tracking
        whereCondition = gte(users.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000));
      } else if (input.timeframe === '30d') {
        whereCondition = gte(users.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      }

      const result = await db
        .select({ count: count() })
        .from(users)
        .where(whereCondition);

      return {
        total: result[0]?.count || 0,
        timeframe: input.timeframe
      };
    }),

  // Get unique projects created in timeframe - admin only
  getProjectsCreated: adminOnlyProcedure
    .input(z.object({ timeframe: timeframeSchema }))
    .query(async ({ input }) => {
      let whereCondition;

      if (input.timeframe === '24h') {
        whereCondition = gte(projects.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000));
      } else if (input.timeframe === '30d') {
        whereCondition = gte(projects.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      }

      const result = await db
        .select({ count: count() })
        .from(projects)
        .where(whereCondition);

      return {
        total: result[0]?.count || 0,
        timeframe: input.timeframe
      };
    }),

  // Get scenes created in timeframe - admin only
  getScenesCreated: adminOnlyProcedure
    .input(z.object({ timeframe: timeframeSchema }))
    .query(async ({ input }) => {
      let whereCondition;

      if (input.timeframe === '24h') {
        whereCondition = gte(scenes.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000));
      } else if (input.timeframe === '30d') {
        whereCondition = gte(scenes.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      }

      const result = await db
        .select({ count: count() })
        .from(scenes)
        .where(whereCondition);

      return {
        total: result[0]?.count || 0,
        timeframe: input.timeframe
      };
    }),

  // Get recent feedback entries - admin only
  getRecentFeedback: adminOnlyProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const feedbackEntries = await db
        .select({
          id: feedback.id,
          content: feedback.content,
          name: feedback.name,
          email: feedback.email,
          createdAt: feedback.createdAt,
          status: feedback.status,
          prioritizedFeatures: feedback.prioritizedFeatures,
        })
        .from(feedback)
        .orderBy(desc(feedback.createdAt))
        .limit(input.limit);

      return feedbackEntries;
    }),

  // Get comprehensive dashboard metrics - admin only
  getDashboardMetrics: adminOnlyProcedure
    .query(async () => {
      // Get all timeframes for each metric in parallel
      const [
        totalUsersAll,
        totalUsers30d,
        totalUsers7d,
        totalUsers24h,
        projectsAll,
        projects30d,
        projects7d,
        projects24h,
        scenesAll,
        scenes30d,
        scenes7d,
        scenes24h,
        recentFeedback
      ] = await Promise.all([
        // Users - using createdAt for user registration tracking
        db.select({ count: count() }).from(users),
        db.select({ count: count() }).from(users)
          .where(and(
            gte(users.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
            sql`${users.createdAt} IS NOT NULL`
          )),
        db.select({ count: count() }).from(users)
          .where(and(
            gte(users.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
            sql`${users.createdAt} IS NOT NULL`
          )),
        db.select({ count: count() }).from(users)
          .where(and(
            gte(users.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
            sql`${users.createdAt} IS NOT NULL`
          )),

        // Projects
        db.select({ count: count() }).from(projects),
        db.select({ count: count() }).from(projects)
          .where(gte(projects.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))),
        db.select({ count: count() }).from(projects)
          .where(gte(projects.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))),
        db.select({ count: count() }).from(projects)
          .where(gte(projects.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),

        // Scenes
        db.select({ count: count() }).from(scenes),
        db.select({ count: count() }).from(scenes)
          .where(gte(scenes.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))),
        db.select({ count: count() }).from(scenes)
          .where(gte(scenes.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))),
        db.select({ count: count() }).from(scenes)
          .where(gte(scenes.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),

        // Recent feedback
        db.select({
          id: feedback.id,
          content: feedback.content,
          name: feedback.name,
          email: feedback.email,
          createdAt: feedback.createdAt,
          status: feedback.status,
        }).from(feedback)
          .orderBy(desc(feedback.createdAt))
          .limit(5)
      ]);

      return {
        users: {
          all: totalUsersAll[0]?.count || 0,
          last30Days: totalUsers30d[0]?.count || 0,
          last7Days: totalUsers7d[0]?.count || 0,
          last24Hours: totalUsers24h[0]?.count || 0,
        },
        projects: {
          all: projectsAll[0]?.count || 0,
          last30Days: projects30d[0]?.count || 0,
          last7Days: projects7d[0]?.count || 0,
          last24Hours: projects24h[0]?.count || 0,
        },
        scenes: {
          all: scenesAll[0]?.count || 0,
          last30Days: scenes30d[0]?.count || 0,
          last7Days: scenes7d[0]?.count || 0,
          last24Hours: scenes24h[0]?.count || 0,
        },
        recentFeedback
      };
    }),

  // USER MANAGEMENT ENDPOINTS - admin only

  // Get all users with pagination and search - admin only
  getUsers: adminOnlyProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit;

      let whereCondition;
      if (input.search) {
        whereCondition = or(
          like(users.name, `%${input.search}%`),
          like(users.email, `%${input.search}%`)
        );
      }

      const [usersList, totalCount] = await Promise.all([
        db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            emailVerified: users.emailVerified,
            image: users.image,
            isAdmin: users.isAdmin, // Include admin status
            createdAt: users.createdAt, // Include creation timestamp
          })
          .from(users)
          .where(whereCondition)
          .orderBy(desc(users.createdAt)) // Order by creation time instead
          .limit(input.limit)
          .offset(offset),

        db
          .select({ count: count() })
          .from(users)
          .where(whereCondition)
      ]);

      // Get prompt counts for each user
      const userIds = usersList.map(user => user.id);
      const promptCounts = userIds.length > 0 ? await db
        .select({
          userId: projects.userId,
          count: count(messages.id)
        })
        .from(messages)
        .innerJoin(projects, eq(messages.projectId, projects.id))
        .where(and(
          inArray(projects.userId, userIds),
          eq(messages.role, 'user')
        ))
        .groupBy(projects.userId) : [];

      // Create a map of userId to prompt count for easy lookup
      const promptCountMap = new Map();
      promptCounts.forEach(pc => {
        promptCountMap.set(pc.userId, pc.count);
      });

      // Add prompt counts to users
      const usersWithPrompts = usersList.map(user => ({
        ...user,
        totalPrompts: promptCountMap.get(user.id) || 0
      }));

      return {
        users: usersWithPrompts,
        total: totalCount[0]?.count || 0,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil((totalCount[0]?.count || 0) / input.limit)
      };
    }),

  // Get single user by ID - admin only
  getUser: adminOnlyProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const user = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          emailVerified: users.emailVerified,
          image: users.image,
          isAdmin: users.isAdmin, // Include admin status
          createdAt: users.createdAt, // Include creation timestamp
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get user's project count, latest activity, and prompt count
      const [projectCount, latestProject, promptCount] = await Promise.all([
        db
          .select({ count: count() })
          .from(projects)
          .where(eq(projects.userId, input.userId)),

        db
          .select({
            id: projects.id,
            title: projects.title,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
          })
          .from(projects)
          .where(eq(projects.userId, input.userId))
          .orderBy(desc(projects.updatedAt))
          .limit(1),

        // Count total user messages/prompts by joining through projects
        db
          .select({ count: count() })
          .from(messages)
          .innerJoin(projects, eq(messages.projectId, projects.id))
          .where(and(
            eq(projects.userId, input.userId),
            eq(messages.role, 'user') // Only count user messages, not assistant responses
          ))
      ]);

      return {
        ...user[0],
        projectCount: projectCount[0]?.count || 0,
        latestProject: latestProject[0] || null,
        promptCount: promptCount[0]?.count || 0,
      };
    }),

  // Update user data - admin only
  updateUser: adminOnlyProcedure
    .input(z.object({
      userId: z.string(),
      data: userUpdateSchema,
    }))
    .mutation(async ({ input }) => {
      const updateData: any = {};

      if (input.data.name !== undefined) updateData.name = input.data.name;
      if (input.data.email !== undefined) updateData.email = input.data.email;
      if (input.data.image !== undefined) updateData.image = input.data.image;
      if (input.data.isAdmin !== undefined) updateData.isAdmin = input.data.isAdmin;

      if (Object.keys(updateData).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No data provided for update",
        });
      }

      const updatedUser = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          emailVerified: users.emailVerified,
          image: users.image,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt, // Include creation timestamp
        });

      if (!updatedUser[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found or update failed",
        });
      }

      return updatedUser[0];
    }),

  // Delete user - admin only
  deleteUser: adminOnlyProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      // Prevent deletion of admin users for safety
      const userToDelete = await db
        .select({ isAdmin: users.isAdmin, email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userToDelete[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (userToDelete[0].isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete admin users",
        });
      }

      // Delete user and all associated data
      // Note: This will cascade delete related data due to foreign key constraints
      const deletedUser = await db
        .delete(users)
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          email: users.email,
        });

      if (!deletedUser[0]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete user",
        });
      }

      return { 
        success: true, 
        deletedUser: deletedUser[0] 
      };
    }),

  // Get user activity summary - admin only
  getUserActivity: adminOnlyProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const [userProjects, userScenes, userFeedback] = await Promise.all([
        db
          .select({
            id: projects.id,
            title: projects.title,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
          })
          .from(projects)
          .where(eq(projects.userId, input.userId))
          .orderBy(desc(projects.updatedAt))
          .limit(10),

        db
          .select({
            id: scenes.id,
            name: scenes.name,
            createdAt: scenes.createdAt,
            projectId: scenes.projectId,
          })
          .from(scenes)
          .innerJoin(projects, eq(scenes.projectId, projects.id))
          .where(eq(projects.userId, input.userId))
          .orderBy(desc(scenes.createdAt))
          .limit(10),

        db
          .select({
            id: feedback.id,
            content: feedback.content,
            createdAt: feedback.createdAt,
            status: feedback.status,
          })
          .from(feedback)
          .where(eq(feedback.userId, input.userId))
          .orderBy(desc(feedback.createdAt))
          .limit(5)
      ]);

      return {
        projects: userProjects,
        scenes: userScenes,
        feedback: userFeedback,
      };
    }),

  // ANALYTICS ENDPOINTS - admin only

  // Get time-series analytics data
  getAnalyticsData: adminOnlyProcedure
    .input(z.object({ 
      timeframe: z.enum(['24h', '7d', '30d']),
      metric: z.enum(['users', 'projects', 'scenes', 'prompts'])
    }))
    .query(async ({ input }) => {
      const { timeframe, metric } = input;

      // Calculate intervals and date ranges
      let intervalHours: number;
      let totalPeriodHours: number;

      switch (timeframe) {
        case '24h':
          intervalHours = 1; // 1-hour intervals
          totalPeriodHours = 24;
          break;
        case '7d':
          intervalHours = 24; // 24-hour (daily) intervals
          totalPeriodHours = 7 * 24;
          break;
        case '30d':
          intervalHours = 24; // 24-hour (daily) intervals
          totalPeriodHours = 30 * 24;
          break;
      }

      const startDate = new Date(Date.now() - totalPeriodHours * 60 * 60 * 1000);

      // Generate time slots
      const timeSlots = [];
      for (let i = 0; i < Math.ceil(totalPeriodHours / intervalHours); i++) {
        const slotStart = new Date(startDate.getTime() + i * intervalHours * 60 * 60 * 1000);
        const slotEnd = new Date(slotStart.getTime() + intervalHours * 60 * 60 * 1000);
        timeSlots.push({
          start: slotStart,
          end: slotEnd,
          label: timeframe === '24h' 
            ? slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : slotStart.toLocaleDateString([], { month: 'short', day: 'numeric' })
        });
      }

      // Get data based on metric type
      let data: { timestamp: Date; count: number }[] = [];

      switch (metric) {
        case 'users':
          // Get new users by createdAt timestamp
          const userCounts = await db
            .select({
              timestamp: users.createdAt,
            })
            .from(users)
            .where(and(
              gte(users.createdAt, startDate),
              sql`${users.createdAt} IS NOT NULL`
            ))
            .orderBy(users.createdAt);

          data = userCounts.map(row => ({
            timestamp: row.timestamp!,
            count: 1
          }));
          break;

        case 'projects':
          const projectCounts = await db
            .select({
              timestamp: projects.createdAt,
            })
            .from(projects)
            .where(gte(projects.createdAt, startDate))
            .orderBy(projects.createdAt);

          data = projectCounts.map(row => ({
            timestamp: row.timestamp,
            count: 1
          }));
          break;

        case 'scenes':
          const sceneCounts = await db
            .select({
              timestamp: scenes.createdAt,
            })
            .from(scenes)
            .where(gte(scenes.createdAt, startDate))
            .orderBy(scenes.createdAt);

          data = sceneCounts.map(row => ({
            timestamp: row.timestamp,
            count: 1
          }));
          break;

        case 'prompts':
          // Get user messages (prompts) by joining through projects
          const promptCounts = await db
            .select({
              timestamp: messages.createdAt,
            })
            .from(messages)
            .innerJoin(projects, eq(messages.projectId, projects.id))
            .where(and(
              gte(messages.createdAt, startDate),
              eq(messages.role, 'user') // Only count user messages
            ))
            .orderBy(messages.createdAt);

          data = promptCounts.map(row => ({
            timestamp: row.timestamp,
            count: 1
          }));
          break;
      }

      // Aggregate data into time slots
      const chartData = timeSlots.map(slot => {
        const slotData = data.filter(item => 
          item.timestamp >= slot.start && item.timestamp < slot.end
        );

        return {
          label: slot.label,
          timestamp: slot.start.toISOString(),
          count: slotData.length,
          cumulative: 0, // Will be calculated below
        };
      });

      // Calculate cumulative values
      let cumulative = 0;
      chartData.forEach(point => {
        cumulative += point.count;
        point.cumulative = cumulative;
      });

      return {
        timeframe,
        metric,
        data: chartData,
        totalCount: cumulative,
        periodStart: startDate.toISOString(),
        periodEnd: new Date().toISOString(),
      };
    }),

  // Get overview analytics for all metrics
  getAnalyticsOverview: adminOnlyProcedure
    .input(z.object({ timeframe: z.enum(['24h', '7d', '30d']) }))
    .query(async ({ input }) => {
      const { timeframe } = input;

      let periodHours: number;
      switch (timeframe) {
        case '24h': periodHours = 24; break;
        case '7d': periodHours = 7 * 24; break;
        case '30d': periodHours = 30 * 24; break;
      }

      const startDate = new Date(Date.now() - periodHours * 60 * 60 * 1000);

      // Get all metrics in parallel
      const [newUsers, newProjects, newScenes, newPrompts] = await Promise.all([
        // New users
        db
          .select({ count: count() })
          .from(users)
          .where(and(
            gte(users.createdAt, startDate),
            sql`${users.createdAt} IS NOT NULL`
          )),

        // New projects
        db
          .select({ count: count() })
          .from(projects)
          .where(gte(projects.createdAt, startDate)),

        // New scenes
        db
          .select({ count: count() })
          .from(scenes)
          .where(gte(scenes.createdAt, startDate)),

        // New prompts (user messages)
        db
          .select({ count: count() })
          .from(messages)
          .innerJoin(projects, eq(messages.projectId, projects.id))
          .where(and(
            gte(messages.createdAt, startDate),
            eq(messages.role, 'user')
          ))
      ]);

      return {
        timeframe,
        metrics: {
          users: newUsers[0]?.count || 0,
          projects: newProjects[0]?.count || 0,
          scenes: newScenes[0]?.count || 0,
          prompts: newPrompts[0]?.count || 0,
        },
        periodStart: startDate.toISOString(),
        periodEnd: new Date().toISOString(),
      };
    }),

  // EVALUATION ENDPOINTS - admin only

  // Run evaluation suite
  runEvaluation: adminOnlyProcedure
    .input(z.object({
      suiteId: z.string(),
      modelPacks: z.array(z.string()),
      maxPrompts: z.number().optional(),
      showOutputs: z.boolean().optional(),
      comparison: z.boolean().optional(),
      verbose: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      // Import the evaluation runner
      const { EvaluationRunner } = await import("~/lib/evals/runner");
      
      const runner = new EvaluationRunner();
      
      try {
        const result = await runner.runSuite({
          suiteId: input.suiteId,
          modelPacks: input.modelPacks,
          maxPrompts: input.maxPrompts,
          showOutputs: input.showOutputs,
          comparison: input.comparison,
          verbose: input.verbose,
        });

        return result;
      } catch (error) {
        console.error('Evaluation failed:', error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  // Create custom evaluation suite
  createCustomSuite: adminOnlyProcedure
    .input(z.object({
      name: z.string(),
      description: z.string(),
      prompts: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['text', 'image', 'code', 'scene']),
        input: z.object({
          text: z.string().optional(),
          image: z.string().optional(),
          context: z.record(z.any()).optional(),
        }),
        expectedOutput: z.object({
          type: z.enum(['exact', 'contains', 'pattern', 'quality_score']),
          value: z.union([z.string(), z.number()]),
        }).optional(),
        expectedBehavior: z.object({
          toolCalled: z.string().optional(),
          editType: z.enum(['surgical', 'creative', 'structural']).optional(),
          shouldMention: z.array(z.string()).optional(),
          shouldModify: z.array(z.string()).optional(),
          shouldAnalyzeImage: z.boolean().optional(),
          shouldUseContext: z.boolean().optional(),
          shouldConfirm: z.boolean().optional(),
          shouldAsk: z.array(z.string()).optional(),
          needsClarification: z.boolean().optional(),
          expectedDuration: z.number().optional(),
          complexity: z.enum(['low', 'medium', 'high', 'very-high']),
        }).optional(),
      })),
      modelPacks: z.array(z.string()),
      services: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      // For now, just return the created suite structure
      // In the future, this could be stored in a database
      const customSuite = {
        id: `custom-${Date.now()}`,
        name: input.name,
        description: input.description,
        prompts: input.prompts,
        modelPacks: input.modelPacks,
        services: input.services,
      };

      return customSuite;
    }),

  // Get available evaluation suites
  getEvaluationSuites: adminOnlyProcedure
    .query(async () => {
      // Import suites dynamically
      const { allEvalSuites } = await import("~/lib/evals/suites/basic-prompts");
      
      return allEvalSuites.map(suite => ({
        id: suite.id,
        name: suite.name,
        description: suite.description,
        promptCount: suite.prompts.length,
        services: suite.services,
        modelPacks: suite.modelPacks,
      }));
    }),

  // Get available model packs
  getModelPacks: adminOnlyProcedure
    .query(async () => {
      const { MODEL_PACKS } = await import("~/config/models.config");
      
      return Object.entries(MODEL_PACKS).map(([id, pack]) => ({
        id,
        name: pack.name,
        description: pack.description,
        models: {
          brain: `${pack.models.brain.provider}/${pack.models.brain.model}`,
          codeGenerator: `${pack.models.codeGenerator.provider}/${pack.models.codeGenerator.model}`,
          visionAnalysis: `${pack.models.visionAnalysis.provider}/${pack.models.visionAnalysis.model}`,
        },
      }));
    }),

  // Create custom prompt - admin only
  createCustomPrompt: adminOnlyProcedure
    .input(z.object({
      name: z.string(),
      type: z.enum(['text', 'code', 'image', 'scene']),
      text: z.string(),
      expectedOutput: z.object({
        type: z.string(),
        value: z.string().optional(),
      }).optional(),
      context: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      // TODO: Store in database for persistence
      const customPrompt = {
        id: `prompt-${Date.now()}`,
        name: input.name,
        type: input.type,
        input: {
          text: input.text,
          context: input.context,
        },
        expectedOutput: input.expectedOutput,
        createdAt: new Date().toISOString(),
      };

      console.log('Creating custom prompt:', customPrompt);
      return { 
        success: true, 
        promptId: customPrompt.id,
        prompt: customPrompt
      };
    }),

  // Create custom model pack - admin only
  createCustomModelPack: adminOnlyProcedure
    .input(z.object({
      name: z.string(),
      description: z.string(),
      brainModel: z.string(),
      codeModel: z.string(),
      visionModel: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Parse provider/model format
      const parseModel = (modelString: string) => {
        const [provider, model] = modelString.split('/');
        return { provider: provider!, model: model! };
      };

      const customPack = {
        id: `custom-${Date.now()}`,
        name: input.name,
        description: input.description,
        models: {
          brain: parseModel(input.brainModel),
          codeGenerator: parseModel(input.codeModel),
          visionAnalysis: parseModel(input.visionModel),
        },
        createdAt: new Date().toISOString(),
      };

      // TODO: Store in database for persistence
      console.log('Creating custom model pack:', customPack);
      return { success: true, packId: customPack.id, pack: customPack };
    }),

  // Analyze uploaded image - admin only
  analyzeUploadedImage: adminOnlyProcedure
    .input(z.object({
      imageData: z.string(), // base64 image data
      prompt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        // TODO: Integrate with actual image analysis service from ~/lib/services/analyzeImage.ts
        const analysisResult = {
          success: true,
          analysis: {
            description: "A user interface mockup showing a modern web application with clean design elements, including navigation, content areas, and interactive components.",
            colors: ["#3B82F6", "#1F2937", "#F9FAFB", "#EF4444"],
            elements: ["Navigation bar", "Content cards", "Buttons", "Text elements"],
            mood: "Professional and modern",
            suggestions: [
              "This design could be implemented using React components",
              "The color scheme suggests a professional application",
              "Layout appears to be responsive-friendly"
            ],
            palette: {
              primary: "#3B82F6",
              secondary: "#1F2937", 
              accent: "#EF4444",
              background: "#F9FAFB"
            },
            typography: {
              headers: "Bold, sans-serif typography",
              body: "Clean, readable text"
            }
          },
          timestamp: new Date().toISOString(),
        };

        return analysisResult;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Generate scene from image - admin only
  generateSceneFromImage: adminOnlyProcedure
    .input(z.object({
      imageData: z.string(),
      analysisData: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        // TODO: Integrate with actual scene generation service
        const sceneCode = `const { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } = window.Remotion;

export default function GeneratedScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  
  const scale = interpolate(frame, [0, fps], [0.8, 1], {
    extrapolateLeft: "clamp", 
    extrapolateRight: "clamp"
  });
  
  return (
    <AbsoluteFill style={{ 
      backgroundColor: "#3B82F6",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      backgroundImage: "linear-gradient(135deg, #3B82F6 0%, #1F2937 100%)"
    }}>
      <div style={{
        opacity,
        transform: \`scale(\${scale})\`,
        textAlign: "center",
        color: "white",
        padding: "2rem"
      }}>
        <h1 style={{
          fontSize: "4rem",
          fontWeight: "700",
          margin: "0 0 1rem 0",
          textShadow: "0 4px 8px rgba(0,0,0,0.3)"
        }}>
          Generated from Image
        </h1>
        <p style={{
          fontSize: "1.5rem",
          opacity: 0.9,
          maxWidth: "600px"
        }}>
          Professional UI Design with Modern Elements
        </p>
        <div style={{
          marginTop: "2rem",
          padding: "1rem 2rem",
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: "10px",
          backdropFilter: "blur(10px)"
        }}>
          <span style={{ fontSize: "1.2rem" }}>
            Auto-generated from uploaded reference
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}`;

        return {
          success: true,
          sceneCode,
          sceneId: `scene-${Date.now()}`,
          sceneName: "Generated Scene",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Scene generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),
});