// src/server/agents/__tests__/message-bus.service.test.ts
import { type MessageBus, messageBus } from "../message-bus";
import { BaseAgent, type AgentMessage } from "../base-agent";
import { db } from "~/server/db";
import { agentMessages } from "~/server/db/schema";
import { type taskManager } from "~/server/services/a2a/taskManager.service";
import type { SSEEvent } from "~/server/services/a2a/sseManager.service";
import crypto from "crypto";
import { Subject } from "rxjs";
import { SSEEventType } from "~/server/services/a2a/sseManager.service";

// Mock BaseAgent for MessageBus tests
class MockBusAgent extends BaseAgent {
  public receivedMessage: AgentMessage | null = null;
  public processMessageMock = jest.fn<Promise<AgentMessage | null>, [AgentMessage]>();

  constructor(name: string) {
    // Mock a minimal taskManager for BaseAgent constructor
    const mockTaskManager = {
      updateTaskState: jest.fn(),
      addTaskArtifact: jest.fn(),
      getTaskById: jest.fn(),
      // Add other methods if BaseAgent's constructor/methods directly use them
    } as unknown as typeof taskManager; // Cast to avoid full mock type for simplicity
    super(name, mockTaskManager, `Mock agent ${name}`);
    this.processMessageMock.mockResolvedValue(null); // Default to no response
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage | null> {
    this.receivedMessage = message;
    return this.processMessageMock(message);
  }
}

// Mock db calls - Declare using let outside and assign inside the mock factory
// let mockDbInsertReturning: jest.Mock;
// let mockDbValues: jest.Mock;
// let mockDbInsert: jest.Mock;

// let mockDbWhere: jest.Mock;
// let mockDbSet: jest.Mock;
// let mockDbUpdate: jest.Mock;

jest.mock("~/server/db", () => {
  // Move declarations and initializations inside the factory
  const mockDbInsertReturning = jest.fn();
  const mockDbValues = jest.fn().mockReturnValue({ returning: mockDbInsertReturning });
  const mockDbInsert = jest.fn().mockReturnValue({ values: mockDbValues });

  const mockDbWhere = jest.fn();
  const mockDbSet = jest.fn().mockReturnValue({ where: mockDbWhere });
  const mockDbUpdate = jest.fn().mockReturnValue({ set: mockDbSet });

  return {
    db: {
      insert: mockDbInsert,
      update: mockDbUpdate,
      query: {
        // customComponentJobs: { findFirst: jest.fn() }, // Add if needed
      },
    },
    agentMessages: {}, // Keep simplified table mock for schema checks
  };
});

const mockCreateTaskStream = jest.fn(() => new Subject<SSEEvent>());
jest.mock("~/server/services/a2a/taskManager.service", () => ({
  taskManager: {
    createTaskStream: mockCreateTaskStream,
  },
}));

describe("MessageBus Service", () => {
  let busInstance: MessageBus;
  let agentA: MockBusAgent;
  let agentB: MockBusAgent;

  // Declare testMessage in a higher scope
  const testMessage: AgentMessage = {
    id: crypto.randomUUID(),
    type: "TEST_MESSAGE",
    payload: { data: "test_payload" },
    sender: "AgentA",
    recipient: "AgentB",
    correlationId: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    busInstance = messageBus; // Use the actual singleton instance
    // Manually clear the internal state of the singleton for test isolation
    (busInstance as any).agents.clear();
    (busInstance as any).agentSubscribers.clear();

    agentA = new MockBusAgent("AgentA");
    agentB = new MockBusAgent("AgentB");

    busInstance.registerAgent(agentA);
    busInstance.registerAgent(agentB);
  });

  it("should register agents", () => {
    expect(busInstance.getAgent("AgentA")).toBe(agentA);
    expect(busInstance.getAgent("AgentB")).toBe(agentB);
  });

  describe("publish", () => {
    it("should log the message to the database with status 'pending'", async () => {
      await busInstance.publish(testMessage);
      // Access mocks through the db object
      expect(db.insert).toHaveBeenCalledWith(agentMessages);
      // Access values mock through the result of db.insert
      const valuesMock = (db.insert(agentMessages) as any).values as jest.Mock;
      expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({
        id: testMessage.id,
        sender: "AgentA",
        recipient: "AgentB",
        type: "TEST_MESSAGE",
        status: "pending",
      }));
    });

    it("should route the message to the correct recipient agent", async () => {
      await busInstance.publish(testMessage);
      expect(agentB.processMessageMock).toHaveBeenCalledWith(testMessage);
      expect(agentA.processMessageMock).not.toHaveBeenCalled();
    });

    it("should mark the message as 'processed' after successful processing", async () => {
      agentB.processMessageMock.mockResolvedValueOnce(null);
      await busInstance.publish(testMessage);
      // Access mocks through the db object
      expect(db.update).toHaveBeenCalledWith(agentMessages);
      // Access set and where mocks through the result of db.update
      const setMock = (db.update(agentMessages) as any).set as jest.Mock;
      expect(setMock).toHaveBeenCalledWith({ status: "processed", processedAt: expect.any(Date) });
      const whereMock = (setMock(expect.anything())).where as jest.Mock;
      expect(whereMock).toHaveBeenCalledWith(expect.objectContaining({ id: testMessage.id }));
    });

    it("should publish a response message if the recipient agent returns one", async () => {
      const responsePayload = { result: "agentB_processed" };
      const responseFromB: AgentMessage = {
        id: "response-id-from-b",
        type: "TEST_RESPONSE",
        payload: responsePayload,
        sender: "AgentB",
        recipient: "AgentA",
      };
      agentB.processMessageMock.mockResolvedValueOnce(responseFromB);

      const publishSpy = jest.spyOn(busInstance, 'publish');

      await busInstance.publish(testMessage);

      expect(publishSpy).toHaveBeenCalledTimes(2);
      expect(publishSpy).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          type: "TEST_RESPONSE",
          payload: responsePayload,
          sender: "AgentB",
          recipient: "AgentA",
          correlationId: testMessage.id,
          id: expect.not.stringMatching(testMessage.id)
        })
      );
      publishSpy.mockRestore();
    });

    it("should mark message as 'failed' if recipient agent is not found", async () => {
      const messageToNonExistentAgent = { ...testMessage, recipient: "NonExistentAgent" };
      await busInstance.publish(messageToNonExistentAgent);
      // Access mocks through the db object
      expect(db.update).toHaveBeenCalledWith(agentMessages);
      const setMock = (db.update(agentMessages) as any).set as jest.Mock;
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
        status: "failed",
        payload: expect.objectContaining({ error: "Recipient not found: NonExistentAgent" })
      }));
      expect(busInstance.getDeadLetterQueue()).toContainEqual(expect.objectContaining({ id: messageToNonExistentAgent.id }));
    });

    it("should mark message as 'failed' if agent processing throws an error", async () => {
      const processingError = new Error("Agent B failed");
      agentB.processMessageMock.mockRejectedValueOnce(processingError);
      await busInstance.publish(testMessage);
      // Access mocks through the db object
      expect(db.update).toHaveBeenCalledWith(agentMessages);
      const setMock = (db.update(agentMessages) as any).set as jest.Mock;
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
        status: "failed",
        payload: expect.objectContaining({ error: processingError.toString() })
      }));
      expect(busInstance.getDeadLetterQueue()).toContainEqual(expect.objectContaining({ id: testMessage.id }));
    });

    it("should notify direct agent subscribers", async () => {
      const subscriberMock = jest.fn().mockResolvedValue(undefined);
      busInstance.subscribeToAgentMessages("AgentB", subscriberMock);
      await busInstance.publish(testMessage);
      expect(subscriberMock).toHaveBeenCalledWith(testMessage);
    });
  });

  describe("Dead Letter Queue", () => {
    it("should retry messages in the DLQ", async () => {
      const messageToMissing = { ...testMessage, recipient: "MissingAgent" };
      await busInstance.publish(messageToMissing);
      expect(busInstance.getDeadLetterQueue()).toHaveLength(1);

      const newAgent = new MockBusAgent("MissingAgent");
      busInstance.registerAgent(newAgent);

      // Mock the update call during retry
      const setMock = ((db.update(agentMessages) as any).set as jest.Mock);
      setMock.mockImplementationOnce(() => ({ where: jest.fn() })); // Mock the chained where

      await busInstance.retryDeadLetterQueue();

      expect(newAgent.processMessageMock).toHaveBeenCalledWith(messageToMissing);
      // Check the database update call during retry
      expect(db.update).toHaveBeenCalledWith(agentMessages);
      expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
      expect((setMock(expect.anything())).where).toHaveBeenCalledWith(expect.objectContaining({ id: messageToMissing.id }));

      expect(busInstance.getDeadLetterQueue()).toHaveLength(0);
    });
  });

  describe("SSE Stream Management", () => {
    it("getTaskStream should call taskManager.createTaskStream", () => {
      const taskId = "sse-task-1";
      busInstance.getTaskStream(taskId);
      expect(mockCreateTaskStream).toHaveBeenCalledWith(taskId);
    });

    it("emitToTaskStream should get stream from taskManager and emit event", () => {
      const taskId = "sse-task-2";
      const mockStreamSubject = new Subject<SSEEvent>();
      const nextSpy = jest.spyOn(mockStreamSubject, 'next');
      mockCreateTaskStream.mockReturnValueOnce(mockStreamSubject);

      // Create a TaskStatusUpdateEvent conforming to the SSEEvent type
      const testEvent: SSEEvent = {
        type: SSEEventType.TaskStatusUpdate, // Use the correct event type enum
        timestamp: new Date().toISOString(), // Provide a timestamp
        data: { // Provide the data object in the expected structure
          task_id: taskId,
          state: "working", // Use the TaskState enum value
        }
      };
      busInstance.emitToTaskStream(taskId, testEvent);

      expect(mockCreateTaskStream).toHaveBeenCalledWith(taskId);
      expect(nextSpy).toHaveBeenCalledWith(testEvent);
    });
  });

  describe("cleanup", () => {
    it("should clear agentSubscribers", () => {
      const subscriberMock = jest.fn().mockResolvedValue(undefined);
      busInstance.subscribeToAgentMessages("AgentA", subscriberMock);
      busInstance.cleanup();
      const consoleSpy = jest.spyOn(console, 'log');
      busInstance.cleanup();
      expect(consoleSpy).toHaveBeenCalledWith("MessageBus: Cleaned up direct agent message subscribers.");
      consoleSpy.mockRestore();
    });
  });
}); 