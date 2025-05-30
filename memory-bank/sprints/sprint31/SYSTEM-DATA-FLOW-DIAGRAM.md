# System Data Flow Diagram - Complete Flow Visualization

**Date**: 2025-01-25  
**Purpose**: Visual representation of complete system data flow

## 🔄 **COMPLETE SYSTEM FLOW DIAGRAM**

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 USER INTERACTION                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               ChatPanelG.tsx                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │ User Types: "make the title blue"                                              │ │
│  │                                                                                 │ │
│  │ 1. addOptimisticUserMessage(trimmedMessage)      ← Immediate UI Update        │ │
│  │ 2. addOptimisticAssistantMessage("Analyzing...")  ← Loading Indicator          │ │
│  │ 3. generateSceneWithChatMutation.mutateAsync({   ← Send to API                │ │
│  │      projectId,                                                                 │ │
│  │      userMessage: trimmedMessage,  ✅ EXACT USER INPUT                        │ │
│  │      sceneId: selectedScene?.id    ✅ CONTEXT ONLY                           │ │
│  │    })                                                                           │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              generation.ts (tRPC Router)                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │ generateScene Mutation:                                                         │ │
│  │                                                                                 │ │
│  │ 1. 💾 Save User Message to Database (SINGLE WRITE)                            │ │
│  │    await db.insert(messages).values({                                          │ │
│  │      projectId,                                                                 │ │
│  │      content: userMessage,  ✅ EXACT USER INPUT                              │ │
│  │      role: "user",                                                              │ │
│  │      createdAt: new Date()                                                      │ │
│  │    });                                                                          │ │
│  │                                                                                 │ │
│  │ 2. 🧠 Send to Brain Orchestrator                                               │ │
│  │    const result = await brainOrchestrator.processUserInput({                   │ │
│  │      prompt: userMessage,                                                       │ │
│  │      projectId,                                                                 │ │
│  │      userId,                                                                    │ │
│  │      userContext: sceneId ? { sceneId } : {},                                  │ │
│  │      storyboardSoFar: [...],  ✅ REAL SCENE IDS & DATA                       │ │
│  │      chatHistory: [...]                                                         │ │
│  │    });                                                                          │ │
│  │                                                                                 │ │
│  │ 3. 💾 Save Assistant Response to Database (SINGLE WRITE)                      │ │
│  │    if (result.chatResponse) {                                                   │ │
│  │      await db.insert(messages).values({                                        │ │
│  │        projectId,                                                               │ │
│  │        content: result.chatResponse,                                            │ │
│  │        role: "assistant",                                                       │ │
│  │        createdAt: new Date()                                                    │ │
│  │      });                                                                        │ │
│  │    }                                                                            │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Brain Orchestrator (orchestrator.ts)                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │ processUserInput():                                                             │ │
│  │                                                                                 │ │
│  │ 1. 🤖 Intent Analysis LLM Call:                                                │ │
│  │    - Model: "gpt-4.1-mini"                                                     │ │
│  │    - Input: User message + storyboard + chat history                           │ │
│  │    - Output: { toolName: "editScene", targetSceneId: "abc123..." }            │ │
│  │                                                                                 │ │
│  │ 2. 🔧 Tool Selection:                                                          │ │
│  │    const tool = toolRegistry.get(toolSelection.toolName);                      │ │
│  │                                                                                 │ │
│  │ 3. ⚡ Tool Execution:                                                          │ │
│  │    const result = await tool.run(toolInput);                                   │ │
│  │                                                                                 │ │
│  │ 4. 💾 Database Operations:                                                     │ │
│  │    return await this.processToolResult(result, toolName, input);               │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               MCP Tools Layer                                        │
│                                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐      │
│  │   addScene.ts  │  │  editScene.ts  │  │ deleteScene.ts │  │ askSpecify.ts  │      │
│  │                │  │                │  │                │  │                │      │
│  │ 🆕 Create new  │  │ ✏️ Edit exist. │  │ 🗑️ Delete     │  │ ❓ Ask for     │      │
│  │    scene       │  │    scene       │  │    scene       │  │    clarity     │      │
│  │                │  │                │  │                │  │                │      │
│  │ Calls:         │  │ Calls:         │  │ Returns:       │  │ Calls:         │      │
│  │ sceneBuilder   │  │ directCode     │  │ deletion info  │  │ LLM for        │      │
│  │ Service        │  │ Editor         │  │                │  │ clarification  │      │
│  └────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Code Generation Services Layer                             │
│                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │                      sceneBuilder.service.ts                                   │ │
│  │                         (Two-Step Pipeline)                                    │ │
│  │                                                                                 │ │
│  │  Step 1: layoutGenerator.service.ts                                            │ │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │ │
│  │  │ 📋 JSON Layout Generation                                                  │ │ │
│  │  │ - Model: "gpt-4.1-mini"                                                    │ │ │
│  │  │ - Input: User prompt                                                       │ │ │
│  │  │ - Output: { sceneType, background, elements[], animations{} }             │ │ │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │ │
│  │                                    │                                           │ │
│  │                                    ▼                                           │ │
│  │  Step 2: codeGenerator.service.ts                                              │ │
│  │  ┌───────────────────────────────────────────────────────────────────────────┐ │ │
│  │  │ 🎬 React/Remotion Code Generation                                          │ │ │
│  │  │ - Model: "gpt-4.1-mini"                                                    │ │ │
│  │  │ - Input: JSON layout + user prompt + function name                        │ │ │
│  │  │ - Output: Complete React component code                                    │ │ │
│  │  └───────────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Database Operations                                      │
│                         (Back in orchestrator.processToolResult)                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Scene Creation (addScene result):                                               │ │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ await db.insert(scenes).values({                                            │ │ │
│  │ │   projectId: input.projectId,                                               │ │ │
│  │ │   name: sceneData.sceneName,                                                │ │ │
│  │ │   order: nextOrder,                                                         │ │ │
│  │ │   tsxCode: sceneData.sceneCode,                                             │ │ │
│  │ │   duration: sceneData.duration,                                             │ │ │
│  │ │   layoutJson: sceneData.layoutJson,                                         │ │ │
│  │ │   props: {}                                                                 │ │ │
│  │ │ });                                                                         │ │ │
│  │ └─────────────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                                 │ │
│  │ Scene Editing (editScene result):                                               │ │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ await db.update(scenes)                                                     │ │ │
│  │ │   .set({                                                                    │ │ │
│  │ │     name: sceneData.sceneName,                                              │ │ │
│  │ │     tsxCode: sceneData.sceneCode,                                           │ │ │
│  │ │     duration: sceneData.duration,                                           │ │ │
│  │ │     updatedAt: new Date()                                                   │ │ │
│  │ │   })                                                                        │ │ │
│  │ │   .where(eq(scenes.id, sceneId));                                           │ │ │
│  │ └─────────────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                                 │ │
│  │ Scene Deletion (deleteScene result):                                            │ │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ await db.delete(scenes)                                                     │ │ │
│  │ │   .where(eq(scenes.id, sceneIdToDelete));                                   │ │ │
│  │ └─────────────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               Response to Frontend                                    │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Return to ChatPanelG.tsx:                                                      │ │
│  │ {                                                                               │ │
│  │   success: true,                                                                │ │
│  │   operation: "editScene",                                                       │ │
│  │   scene: {                                                                      │ │
│  │     id: "abc123...",                                                            │ │
│  │     name: "Updated Scene Name",                                                 │ │
│  │     tsxCode: "export default function...",                                     │ │
│  │     duration: 180                                                              │ │
│  │   },                                                                            │ │
│  │   chatResponse: "I've updated the title to blue! ✅"                          │ │
│  │ }                                                                               │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Frontend State Updates                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│  │ ChatPanelG.tsx:                                                                 │ │
│  │ 1. updateOptimisticMessage(assistantId, { success })                           │ │
│  │ 2. onSceneGenerated(scene.id, scene.tsxCode)  ← Update video state            │ │
│  │                                                                                 │ │
│  │ Video State (stores/videoState.ts):                                            │ │
│  │ 1. addScene() or updateScene() ← Direct state update                          │ │
│  │                                                                                 │ │
│  │ PreviewPanelG.tsx:                                                             │ │
│  │ 1. Auto-recompiles when scenes change                                          │ │
│  │ 2. Uses scenes from video state                                                │ │
│  │ 3. Compiles TSX → Remotion player                                             │ │
│  │                                                                                 │ │
│  │ Database Sync:                                                                  │ │
│  │ - refetchMessages() pulls new messages from DB                                 │ │
│  │ - clearOptimisticMessages() when DB messages arrive                           │ │
│  └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 🎯 **KEY DATA FLOW PRINCIPLES**

### **✅ Single Sources of Truth:**

1. **User Input**: Captured exactly as typed, no modification
2. **Database**: All persistent data (messages, scenes) 
3. **Brain LLM**: All decisions (tool selection, scene targeting)
4. **MCP Tools**: Single responsibility per operation type
5. **Video State**: UI state for scenes and composition

### **✅ Clean Handoffs:**

1. **UI → API**: Clean tRPC mutation with exact user input
2. **API → Brain**: Context-rich input with real scene data  
3. **Brain → Tools**: Prepared input with all necessary context
4. **Tools → Services**: Focused requests for specific operations
5. **Services → LLMs**: Clean prompts with proper structure
6. **Results → Database**: Centralized write operations
7. **Database → UI**: Optimistic updates + eventual consistency

### **✅ No Duplication:**

- **No competing voice systems** (only useVoiceToText)
- **No duplicate message creation** (single DB writes)
- **No auto-tagging** (Brain LLM handles analysis)
- **No redundant mutations** (unified generateScene)
- **No duplicate state** (single video state store)

## 🔍 **MONITORING POINTS**

### **Message Consistency:**
- Optimistic messages clear when DB messages arrive
- No duplicate messages in chat history
- Message IDs don't collide

### **Scene State Consistency:**  
- Scene selection matches brain decisions
- Scene data syncs between video state and database
- Scene IDs consistent across components

### **Operation Flow:**
- All operations go through Brain LLM
- No direct tool calls from frontend
- Clean error propagation

This architecture ensures **single source of truth** throughout the entire system. 