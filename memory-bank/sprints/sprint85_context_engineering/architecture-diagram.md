# Context Engineering Architecture Diagrams

## Current System - Tool-Based Architecture

```
┌─────────────────┐
│   User Input    │
│ "Create text    │
│ with particles" │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Brain       │
│  Orchestrator   │◄──── "Which ONE tool should I use?"
└────────┬────────┘
         │
         ▼
    ┌────┴────┐
    │ Choose  │
    │  ONE    │
    └────┬────┘
         │
    ┌────┴────────────────────┬─────────────────┬──────────────┐
    ▼                         ▼                 ▼              ▼
┌─────────┐           ┌──────────────┐  ┌──────────────┐  ┌─────────┐
│Typography│           │Image Recreator│  │Particle Scene│  │   ...   │
│  Tool    │           │     Tool      │  │    Tool      │  │  Tool   │
└────┬────┘           └──────┬────────┘  └──────┬───────┘  └────┬────┘
     │                       │                   │               │
     └───────────────────────┴───────────────────┴───────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  CODE_GENERATOR     │
                          │ (Same prompt for    │
                          │  all tools!)        │
                          └─────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  Generated Code     │
                          │ (Limited to one     │
                          │  capability)        │
                          └─────────────────────┘
```

## Proposed System - Context-Based Architecture

```
┌─────────────────┐
│   User Input    │
│ "Create text    │
│ with particles  │
│  for TikTok"    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Brain       │
│  Orchestrator   │◄──── "Which contexts should I combine?"
└────────┬────────┘
         │
         ▼
    ┌────┴────┐
    │ Select  │
    │MULTIPLE │
    └────┬────┘
         │
    ┌────┼────────────────────┬─────────────────┐
    ▼    ▼                    ▼                 ▼
┌──────────┐           ┌──────────────┐  ┌──────────────┐
│Typography│           │  Particles   │  │   TikTok     │
│ Context  │           │   Context    │  │   Context    │
└────┬─────┘           └──────┬───────┘  └──────┬───────┘
     │                        │                  │
     └────────────────────────┴──────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  Context Manager    │
                   │  (Merges contexts)  │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Universal Generator │
                   │  + Base Prompt      │
                   │  + Typography Rules │
                   │  + Particle Logic  │
                   │  + TikTok Format   │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  Generated Code     │
                   │ (All capabilities   │
                   │  combined!)         │
                   └─────────────────────┘
```

## Context File Structure

```
/src/contexts/
│
├── 📁 base/
│   ├── 📄 generation.context.md     ← Core generation rules
│   └── 📄 editing.context.md        ← Core editing rules
│
├── 📁 specialized/
│   ├── 📄 typography.context.md     ← Text animations
│   ├── 📄 particles.context.md      ← Particle effects
│   ├── 📄 image-recreation.md       ← Image analysis
│   ├── 📄 data-viz.context.md       ← Charts/graphs
│   └── 📄 transitions.context.md    ← Scene transitions
│
├── 📁 platform/
│   ├── 📄 tiktok.context.md         ← 9:16, quick cuts
│   ├── 📄 youtube.context.md        ← 16:9, longer form
│   └── 📄 instagram.context.md      ← 1:1 or 9:16
│
└── 📄 index.ts                      ← Context Manager
```

## Context Combination Examples

### Example 1: Simple Typography
```
User: "Create animated heading"
         │
         ▼
Contexts: [typography]
         │
         ▼
Result: Basic text animation
```

### Example 2: Complex Multi-Context
```
User: "Create data dashboard with animated charts and particles for TikTok"
         │
         ▼
Contexts: [data-viz, particles, transitions, tiktok]
         │
         ├── data-viz: Chart components, data binding
         ├── particles: Background effects, emphasis
         ├── transitions: Smooth scene changes
         └── tiktok: Vertical format, mobile-first
         │
         ▼
Result: Vertical animated dashboard with particle effects
```

## Context Priority & Merging

```
┌─────────────────────────────────────────────┐
│            Context Priority Order            │
├─────────────────────────────────────────────┤
│ 1. Platform Context (Highest Priority)      │
│    - Overrides format, dimensions, style    │
├─────────────────────────────────────────────┤
│ 2. Specialized Context                      │
│    - Adds specific capabilities             │
├─────────────────────────────────────────────┤
│ 3. Base Context (Lowest Priority)           │
│    - Default rules and patterns             │
└─────────────────────────────────────────────┘

Merge Process:
BASE → SPECIALIZED → PLATFORM = FINAL CONTEXT
```

## Performance Comparison

```
┌─────────────────┬──────────────────┬──────────────────┐
│     Metric      │  Current System  │ Proposed System  │
├─────────────────┼──────────────────┼──────────────────┤
│ Code Files      │       7+         │        2         │
│ Prompts         │      40+         │   Context Files  │
│ Combinations    │       7          │    Unlimited     │
│ New Feature     │   New Tool +     │  Add .md file    │
│                 │    Deploy        │   (No deploy)    │
│ Flexibility     │      Low         │      High        │
│ Maintenance     │     Hard         │      Easy        │
└─────────────────┴──────────────────┴──────────────────┘
```

## Migration Timeline

```
Week 1: Foundation
│ ├── Context Manager
│ ├── 3 Context Files
│ └── POC Testing
│
Week 2: Integration
│ ├── Brain Updates
│ ├── More Contexts
│ └── A/B Testing (10%)
│
Week 3: Migration
│ ├── All Contexts
│ ├── Full Integration
│ └── 50% Traffic
│
Week 4: Completion
  ├── 100% Traffic
  ├── Old System Deprecated
  └── Documentation
```