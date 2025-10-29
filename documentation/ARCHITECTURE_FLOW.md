# Chef E-Commerce Agent Flow

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER STARTS CHAT                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              WebContainer Initialization                         │
│                                                                  │
│  1. Fetch: /template-snapshot-885ee88c.bin (177KB)              │
│  2. Decompress with LZ4                                         │
│  3. Mount filesystem at /home/project/                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Snapshot Contents (74 files):                            │  │
│  │  • convex/products.ts, cart.ts, orders.ts, roles.ts      │  │
│  │  • src/pages/HomePage.tsx, CartPage.tsx, etc.            │  │
│  │  • src/components/Navbar.tsx, ProductCard.tsx            │  │
│  │  • package.json, package-lock.json                       │  │
│  │  • All config files (vite, tsconfig, tailwind)           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  prewarmWorkdir()                                │
│                                                                  │
│  Scans /home/project/ and loads into FilesStore:                │
│                                                                  │
│  Priority 0 (PREWARM_PATHS - 15 files):                         │
│   ✅ package.json                                               │
│   ✅ convex/schema.ts, products.ts, cart.ts, orders.ts, roles.ts│
│   ✅ src/App.tsx                                                │
│   ✅ src/pages/HomePage.tsx, CartPage.tsx, OrdersPage.tsx,      │
│      AdminDashboard.tsx                                         │
│   ✅ src/components/Navbar.tsx, ProductCard.tsx                 │
│   ✅ src/index.css                                              │
│                                                                  │
│  Other files loaded on-demand                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                            │
│  "Build an e-commerce store with products and cart"             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            ChatContextManager.prepareContext()                   │
│                                                                  │
│  1. Builds relevantFiles message:                               │
│                                                                  │
│     ┌─────────────────────────────────────────────────┐        │
│     │ Priority 0: PREWARM_PATHS (if file exists)      │        │
│     │  - /home/project/convex/products.ts             │        │
│     │  - /home/project/convex/cart.ts                 │        │
│     │  - /home/project/src/pages/HomePage.tsx         │        │
│     │  - ... (up to 15 files)                         │        │
│     ├─────────────────────────────────────────────────┤        │
│     │ Priority 1+: Recently viewed/edited files       │        │
│     │  - Files from previous messages (LRU sorted)    │        │
│     ├─────────────────────────────────────────────────┤        │
│     │ Current: Open file in editor (if any)           │        │
│     └─────────────────────────────────────────────────┘        │
│                                                                  │
│  2. Formats as <boltArtifact> with file contents                │
│  3. Adds to message history                                     │
│  4. Max 16 files total to avoid token limits                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LLM Request Building                            │
│                                                                  │
│  System Prompts (injected by server):                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. convexGuidelines() (~15k tokens, cached)              │  │
│  │    - How to use Convex DB, queries, mutations            │  │
│  │    - Auth guidelines, file storage, HTTP handlers        │  │
│  │                                                           │  │
│  │ 2. solutionConstraints() - OUR ADDITIONS ✨              │  │
│  │    <ecommerce_only>                                      │  │
│  │      # E-COMMERCE ONLY - CRITICAL INSTRUCTIONS           │  │
│  │                                                           │  │
│  │      Pre-existing Files (DO NOT RECREATE):               │  │
│  │      - convex/products.ts (ALREADY EXISTS)               │  │
│  │      - convex/cart.ts (ALREADY EXISTS)                   │  │
│  │      - src/pages/HomePage.tsx (ALREADY EXISTS)           │  │
│  │      - ... [full list of 20+ files]                      │  │
│  │                                                           │  │
│  │      When User Requests Changes:                         │  │
│  │      1. ALWAYS use 'view' tool first                     │  │
│  │      2. Use 'edit' tool for small changes                │  │
│  │      3. Only create new files for new features           │  │
│  │    </ecommerce_only>                                     │  │
│  │                                                           │  │
│  │ 3. outputInstructions() - Tool usage guidelines          │  │
│  │ 4. formattingInstructions() - Response format            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  User Messages:                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ [Relevant Files - 15 files with content]                 │  │
│  │ "Build an e-commerce store..."                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LLM REASONING                                │
│                                                                  │
│  Agent reads:                                                    │
│  ✅ System prompt: "These files ALREADY EXIST"                  │
│  ✅ Relevant files: Sees actual product/cart code               │
│  ✅ User message: "Build e-commerce store"                      │
│                                                                  │
│  Agent decides:                                                  │
│  ❌ "I should NOT create products.ts - it exists!"              │
│  ✅ "I should use view tool to show what exists"                │
│  ✅ "I can suggest customizations to existing code"             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT RESPONSE                                │
│                                                                  │
│  "Great! This environment already has a complete e-commerce     │
│   store with all the core features. Let me show you what's      │
│   implemented..."                                               │
│                                                                  │
│  Tool Calls:                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. view({path: "/home/project/convex/products.ts"})      │  │
│  │    → Shows CRUD operations for products                  │  │
│  │                                                           │  │
│  │ 2. view({path: "/home/project/src/pages/HomePage.tsx"})  │  │
│  │    → Shows product listing UI                            │  │
│  │                                                           │  │
│  │ 3. view({path: "/home/project/convex/cart.ts"})          │  │
│  │    → Shows cart functionality                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Then explains existing features and offers customization       │
└─────────────────────────────────────────────────────────────────┘

## File Modification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│            USER: "Add a subtitle to product cards"               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AGENT DECISION TREE                            │
│                                                                  │
│  Question: Does ProductCard.tsx exist?                          │
│  Answer: ✅ Yes (in PREWARM_PATHS + context)                    │
│                                                                  │
│  Question: Is it in EXCLUDED_FILE_PATHS?                        │
│  Answer: ❌ No (not locked)                                     │
│                                                                  │
│  Question: Is change < 1024 chars?                              │
│  Answer: ✅ Yes (small modification)                            │
│                                                                  │
│  Decision: Use edit tool                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 1: View File First                         │
│                                                                  │
│  Tool: view({                                                   │
│    path: "/home/project/src/components/ProductCard.tsx"         │
│  })                                                             │
│                                                                  │
│  Result: Sees current file structure                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 2: Edit File                               │
│                                                                  │
│  Tool: edit({                                                   │
│    path: "/home/project/src/components/ProductCard.tsx",        │
│    old: "<h3>{product.title}</h3>",                             │
│    new: "<div><h3>{product.title}</h3>                          │
│           <p className='subtitle'>{product.subtitle}</p></div>"  │
│  })                                                             │
│                                                                  │
│  ✅ File modified in WebContainer                               │
│  ✅ Change tracked in FilesStore                                │
│  ✅ User sees change in editor                                  │
└─────────────────────────────────────────────────────────────────┘

## Why It Works Now

### BEFORE (Old Snapshot - No E-Commerce Files)
```
Snapshot: template-snapshot-63fbe575.bin (120KB)
├── Bare minimum template
├── No products.ts, cart.ts, orders.ts
├── No HomePage.tsx, CartPage.tsx
└── Just auth + basic structure

User: "Build e-commerce"
  → Agent: "I don't see any e-commerce code"
  → Creates everything from scratch ❌
```

### AFTER (New Snapshot - With E-Commerce)
```
Snapshot: template-snapshot-885ee88c.bin (177KB)
├── ✅ convex/products.ts, cart.ts, orders.ts, roles.ts
├── ✅ src/pages/HomePage.tsx, CartPage.tsx, OrdersPage.tsx
├── ✅ src/components/Navbar.tsx, ProductCard.tsx
└── ✅ Complete working e-commerce app

PREWARM_PATHS loads 15 key files into context

System Prompt says:
  "These files ALREADY EXIST - DO NOT RECREATE"

User: "Build e-commerce"
  → Agent: "Already exists! Let me show you..."
  → Uses view tool to show existing code ✅
  → Suggests customizations ✅
```

## Key Takeaways

1. **Snapshot is Source of Truth**
   - WebContainer loads from binary snapshot
   - Not from template/ folder directly
   - Must rebuild after template changes

2. **PREWARM_PATHS = Agent's Memory**
   - Files listed here are always in context
   - Agent can see them without calling view tool
   - Keep list under 20 files

3. **System Prompt = Agent's Instructions**
   - `<ecommerce_only>` tells agent what exists
   - Lists all pre-existing files
   - Defines when to view/edit vs create

4. **ChatContextManager = Intelligence**
   - Prioritizes relevant files
   - Tracks file usage history
   - Builds optimal context for LLM

5. **EXCLUDED_FILE_PATHS = Safety**
   - Prevents agent from breaking auth
   - Locks critical configuration
   - Agent simply can't modify these

## File Lifecycle

```
Developer Changes Template
        ↓
  Update template/ folder
        ↓
  Run: node make-bootstrap-snapshot.js
        ↓
  Creates: template-snapshot-XXXXXXXX.bin
        ↓
  Auto-updates: useContainerSetup.ts
        ↓
  User starts new chat
        ↓
  WebContainer loads new snapshot
        ↓
  Agent sees updated files
        ↓
  Success! ✅
```

---

**Remember:** Always rebuild snapshot after template changes!
