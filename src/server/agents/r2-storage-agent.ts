// src/server/agents/r2-storage-agent.ts
import { BaseAgent, type AgentMessage } from "./base-agent";
import { taskManager as globalTaskManagerInstance } from "~/server/services/a2a/taskManager.service"; // Renamed to avoid conflict if taskManager is passed to constructor
import type { TaskManager } from "~/server/services/a2a/taskManager.service"; // Import TaskManager type
import type { Message, Artifact, TaskState, AgentSkill, ComponentJobStatus } from "~/types/a2a";
import { createTextMessage, createFileArtifact, mapA2AToInternalState } from "~/types/a2a";
// Placeholder for r2.service functions - assume they will be available
// import { verifyR2Component, uploadToR2 } from "~/server/services/r2.service"; 
async function verifyR2Component(url: string): Promise<boolean> { console.log("verifyR2Component called with", url); return true; }
async function uploadToR2(sourceUrl: string, targetKey: string): Promise<string> { console.log("uploadToR2 called with", sourceUrl, targetKey); return `https://r2.example.com/${targetKey}`; }

import { db } from "~/server/db";
import { customComponentJobs } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export class R2StorageAgent extends BaseAgent {
  constructor(taskManager: TaskManager) { // Added taskManager parameter
    super(
      "R2StorageAgent", 
      taskManager, // Passed taskManager to super()
      "Handles storing and verification of component bundles in R2.",
      true // Enable OpenAI integration
    );
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage | null> {
    const { type, payload, id: correlationId } = message;
    const taskId = payload.taskId || payload.componentJobId;
    const componentJobId = taskId; 

    if (!taskId) {
      console.error("R2StorageAgent Error: Missing taskId in message payload", payload);
      await this.logAgentMessage(message);
      return null;
    }

    try {
      switch (type) {
        case "STORE_COMPONENT_REQUEST":
          const builtArtifact = payload.artifacts?.[0] as Artifact | undefined;
          
          if (!builtArtifact?.url) {
            const errorMsg = "Missing component artifact or artifact URL in STORE_COMPONENT_REQUEST.";
            console.error(`R2StorageAgent Error: ${errorMsg}`, payload);
            await this.updateTaskState(taskId, 'failed', this.createSimpleTextMessage(errorMsg), undefined, 'failed');
            await this.logAgentMessage(message, true);
            
            const errorResponse = this.createA2AMessage(
              "COMPONENT_PROCESS_ERROR", 
              taskId, 
              "CoordinatorAgent", 
              this.createSimpleTextMessage(errorMsg), 
              undefined, 
              correlationId
            );
            await this.bus.publish(errorResponse);
            return null;
          }

          await this.logAgentMessage(message, true);
          // Use a valid ComponentJobStatus for internal tracking, e.g., 'building' or a new one like 'storing'
          await this.updateTaskState(taskId, 'working', this.createSimpleTextMessage("Storing component bundle in R2..."), undefined, 'building' as ComponentJobStatus);

          const outputUrl = builtArtifact.url;
          const isValidInR2 = await verifyR2Component(outputUrl);

          if (isValidInR2) {
            const storeSuccessMsg = "Component stored and verified in R2 successfully.";
            // The r2Verified field should be added to the schema if it's intended to be used.
            // For now, we only update outputUrl and status.
            await db.update(customComponentJobs)
              .set({ outputUrl: outputUrl, updatedAt: new Date() })
              .where(eq(customComponentJobs.id, componentJobId));
            
            await this.updateTaskState(taskId, 'completed', this.createSimpleTextMessage(storeSuccessMsg), undefined, 'complete' as ComponentJobStatus);
            await this.addTaskArtifact(taskId, builtArtifact); 
            
            const successResponse = this.createA2AMessage(
              "COMPONENT_STORED_SUCCESS", 
              taskId,
              "CoordinatorAgent", 
              this.createSimpleTextMessage(storeSuccessMsg),
              [builtArtifact],
              correlationId
            );
            await this.bus.publish(successResponse);
            return null;
          } else {
            const r2ErrorMsg = "Component failed R2 verification or storage.";
            await this.updateTaskState(taskId, 'failed', this.createSimpleTextMessage(r2ErrorMsg), undefined, 'r2_failed' as ComponentJobStatus);
            
            const r2ErrorResponse = this.createA2AMessage(
              "R2_STORAGE_ERROR", 
              taskId, 
              "CoordinatorAgent", 
              this.createSimpleTextMessage(r2ErrorMsg),
              undefined,
              correlationId
            );
            await this.bus.publish(r2ErrorResponse);
            return null;
          }

        default:
          console.warn(`R2StorageAgent received unhandled message type: ${type}, payload: ${JSON.stringify(payload)}`);
          await this.logAgentMessage(message);
          return null;
      }
    } catch (error: any) {
      console.error(`Error processing message in R2StorageAgent (type: ${type}): ${error.message}`, { payload, error });
      await this.updateTaskState(taskId, 'failed', this.createSimpleTextMessage(`R2StorageAgent internal error: ${error.message}`), undefined, 'failed');
      await this.logAgentMessage(message, false);
      
      const errorResponse = this.createA2AMessage(
        "COMPONENT_PROCESS_ERROR", 
        taskId, 
        "CoordinatorAgent", 
        this.createSimpleTextMessage(`R2StorageAgent error: ${error.message}`), 
        undefined, 
        correlationId
      );
      await this.bus.publish(errorResponse);
      return null;
    }
  }

  getAgentCard() {
    const card = super.getAgentCard();
    const r2Skills: AgentSkill[] = [
      {
        id: "store-and-verify-component",
        name: "Store and Verify Component",
        description: "Uploads compiled component bundles to R2 storage and verifies their accessibility.",
        inputModes: ["file"], 
        outputModes: ["text"], 
      }
    ];
    card.skills = r2Skills;
    return card;
  }
} 