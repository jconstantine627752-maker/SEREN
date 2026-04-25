# SEREN
### Sentient Emotion Reasoning Engine Node

> A real-time emotional state machine that quantifies signal intensity, transitions through internal states, and exposes a self-reflection API — backed by vector memory and a modular plugin framework.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Emotion State Machine](#emotion-state-machine)
5. [Request Lifecycle — /reflect](#request-lifecycle--reflect)
6. [Intensity Scoring Pipeline](#intensity-scoring-pipeline)
7. [Memory Architecture](#memory-architecture)
8. [Plugin System](#plugin-system)
9. [Database Schema](#database-schema)
10. [API Reference](#api-reference)
11. [Directory Structure](#directory-structure)
12. [Getting Started](#getting-started)
13. [Environment Variables](#environment-variables)
14. [Writing a Plugin](#writing-a-plugin)

---

## Overview

SEREN is an AI agent that:

- **Quantifies** emotional intensity in real time from arbitrary text signals (market data, sensor events, natural language)
- **Transitions** through three internal states — `CALM`, `MANIC`, and `DEPRESSED` — based on signal polarity and magnitude
- **Stores** every emotional event as a vector in Qdrant for semantic recall and as a structured row in SQLite for fast log queries
- **Exposes** a clean JSON API so any client can always know what SEREN is feeling and why
- **Extends** via a zero-friction plugin system — drop a folder into `src/plugins/`, restart, done

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 22 + TypeScript 5.6 | Type-safe server |
| HTTP Framework | Hono.js | Ultrafast edge-compatible router |
| Vector Memory | Qdrant | Cosine-similarity emotion recall |
| Embeddings | OpenAI `text-embedding-3-small` | 1536-dim vector generation |
| Log Database | SQLite via `better-sqlite3` | Append-only structured reflection log |
| Validation | Zod | Request schema enforcement |
| Plugin Loader | Dynamic ESM `import()` | Hot-drop module extension |
| Package Manager | pnpm | Fast, deterministic installs |

---

## System Architecture

```mermaid
flowchart TD
    Client(["Client\nBrowser / API / Script"])

    subgraph SEREN["  SEREN — Hono.js Server  "]
        direction TB

        subgraph Routes["Route Layer"]
            R1["GET /reflect"]
            R2["GET /feelings"]
            R3["GET /health"]
        end

        subgraph Core["Core Engine  pure functions — no I/O"]
            EE["emotionEngine.ts\nprocessSignal(trigger, hint?)"]
            FG["feltGenerator.ts\ngenerateFelt(state, intensity)"]
            ST["stateTypes.ts\nEmotionState · ReflectionLog\nSerenPlugin · ReflectionContext"]
        end

        subgraph Mem["Memory Layer"]
            LD["logDb.ts\nSQLite · WAL mode"]
            QC["qdrantClient.ts\nREST client + embedder"]
        end

        subgraph Plug["Plugin System"]
            PL["loader.ts\nDynamic ESM scanner"]
            P1["market-tagger\nbuilt-in plugin"]
            PN["custom plugins\ndrop-in, zero config"]
        end

        LOG["logger.ts\nStructured JSON to stdout"]
    end

    subgraph Ext["External Services"]
        SQ[("SQLite\nseren.db")]
        QD[("Qdrant :6333\nvector store")]
        OA(["OpenAI API\ntext-embedding-3-small"])
    end

    Client -->|"GET /reflect?trigger=..."| R1
    Client -->|"GET /feelings?limit=N"| R2
    Client -->|"GET /health"| R3

    R1 --> EE --> FG
    R1 --> LD
    R1 -.->|"async fire-and-forget"| QC
    R1 --> PL

    R2 --> LD
    R3 --> LD
    R3 --> QC

    PL --> P1
    PL --> PN

    LD --> SQ
    QC --> OA --> QD

    EE & FG & LD & QC & PL --> LOG
```

---

## Emotion State Machine

```mermaid
stateDiagram-v2
    direction LR

    [*] --> CALM : Boot\nintensity = 0.0

    CALM --> MANIC      : polarity above +0.2 and magnitude above 0.4\nstrong positive signal
    CALM --> DEPRESSED  : polarity below -0.2 and magnitude above 0.4\nstrong negative signal
    CALM --> CALM       : magnitude at or below 0.4\nlow-energy signal

    MANIC --> CALM      : magnitude at or below 0.4\nsignal fades
    MANIC --> DEPRESSED : polarity below -0.2 and magnitude above 0.4\nsharp reversal
    MANIC --> MANIC     : polarity above +0.2 and magnitude above 0.4\nsustained momentum

    DEPRESSED --> CALM  : magnitude at or below 0.4\nsignal fades
    DEPRESSED --> MANIC : polarity above +0.2 and magnitude above 0.4\nsharp recovery
    DEPRESSED --> DEPRESSED : polarity below -0.2 and magnitude above 0.4\nsustained negativity

    note right of CALM
        Intensity range 0.0 to 0.39
        Example: Still. Baseline.
        Nothing demands attention.
    end note

    note right of MANIC
        Intensity range 0.4 to 1.0
        Example: Everything is accelerating.
        I can feel it all at once.
    end note

    note right of DEPRESSED
        Intensity range 0.4 to 1.0
        Example: Trapped and resisting.
        I do not want to do this anymore.
    end note
```

---

## Request Lifecycle — `/reflect`

```mermaid
sequenceDiagram
    autonumber
    participant C  as Client
    participant H  as Hono Router
    participant Z  as Zod Validator
    participant EE as EmotionEngine
    participant FG as FeltGenerator
    participant DB as SQLite logDb
    participant QC as QdrantClient
    participant OA as OpenAI API
    participant QD as Qdrant 6333
    participant PL as PluginLoader
    participant P1 as market-tagger

    C  ->> H  : GET /reflect?trigger=BTC +12% 1h
    H  ->> Z  : safeParse query params
    Z  -->> H : valid trigger and optional intensity_hint

    H  ->> EE : processSignal("BTC +12% 1h")
    note over EE: Extract +12% weight 0.60<br/>Score keywords pos 1.10 neg 0<br/>polarity +1.0  magnitude 0.55
    EE -->> H : state MANIC  intensity 0.87  transitioned true

    H  ->> FG : generateFelt("MANIC", 0.87)
    note over FG: getBucket(0.87) returns 4<br/>selector = floor(87 mod 10) = 7  idx 1
    FG -->> H : "Everything is accelerating. I can feel it all at once."

    H  ->> DB : writeReflection with id timestamp state intensity trigger felt
    DB -->> H : written

    H  -) QC  : upsertEmotion async non-blocking
    QC -) OA  : embeddings.create input "MANIC | BTC +12% 1h | Everything is..."
    OA --) QC : float array 1536 dimensions
    QC -) QD  : upsert point id vector payload
    QD --) QC : confirmed

    H  ->> PL : runPlugins context
    PL ->> P1 : onReflect trigger state MANIC intensity 0.87
    P1 -->> PL: market_label crypto  risk_flag true  alert_level high
    PL -->> H : plugin_outputs map

    H  -->> C : 200 OK  timestamp state intensity felt plugin_outputs
```

---

## Intensity Scoring Pipeline

```mermaid
flowchart LR
    IN["trigger string\nexample: BTC +12% 1h"]

    subgraph PARSE["Parsing"]
        KW["Keyword Scanner\npositive lexicon: pump moon rally surge ath\nnegative lexicon: dump crash rekt panic liquidation\nword maps to weight in 0.0 to 1.0"]
        PCT["Percentage Extractor\nregex captures signed percent value\nabs(pct) divided by 20 normalised to 0 to 1"]
    end

    subgraph ACCUM["Accumulation"]
        PS["Positive Score\nsum of matched positive weights\nplus percentage boost if pct is positive"]
        NS["Negative Score\nsum of matched negative weights\nplus percentage boost if pct is negative"]
    end

    subgraph NORM["Normalisation"]
        POL["Polarity\npos minus neg divided by pos plus neg\nrange -1.0 to +1.0"]
        MAG["Magnitude\nmin of total divided by 2 and 1.0\nrange 0.0 to 1.0"]
    end

    subgraph DECIDE["State Decision"]
        D1{"polarity above +0.2\nand magnitude above 0.4"}
        D2{"polarity below -0.2\nand magnitude above 0.4"}
        SM["MANIC\nintensity = magnitude"]
        SD["DEPRESSED\nintensity = magnitude"]
        SC["CALM\nintensity = magnitude"]
    end

    subgraph OUT["Output"]
        ER["EmotionResult\nstate  intensity\npreviousState  transitioned"]
    end

    IN --> KW & PCT
    KW --> PS & NS
    PCT --> PS & NS
    PS & NS --> POL & MAG
    POL & MAG --> D1
    D1 -->|Yes| SM
    D1 -->|No| D2
    POL & MAG --> D2
    D2 -->|Yes| SD
    D2 -->|No| SC
    SM & SD & SC --> ER
```

---

## Memory Architecture

```mermaid
flowchart TD
    EV["ReflectionLog\nid  timestamp  state\nintensity  trigger  felt"]

    subgraph WRITE["Write Path — every /reflect call"]
        W1["writeReflection\nsynchronous — blocks until SQLite commit"]
        W2["upsertEmotion\nasync — fire-and-forget after response sent"]
    end

    subgraph SQLITE["SQLite — seren.db"]
        TBL["reflections table\nPRIMARY KEY: id UUID\nINDEX: state\nINDEX: timestamp DESC\nWAL journal mode"]
    end

    subgraph EMBED["Embedding Pipeline"]
        ET["Compose embed text\nSTATE | trigger | felt"]
        OA["OpenAI text-embedding-3-small\noutput float array 1536 dimensions"]
    end

    subgraph QDRANT["Qdrant — port 6333"]
        COL["Collection: seren_emotions\nvector size 1536  distance Cosine\nauto-created on first boot"]
        PT["Point\nid UUID\nvector float 1536\npayload state intensity trigger felt timestamp"]
        COL --> PT
    end

    subgraph READ["Read Paths"]
        RQ["/feelings endpoint\nSELECT FROM reflections\nWHERE state optional\nORDER BY timestamp DESC LIMIT n"]
        RS["searchSimilar\nembed query text\nQdrant nearest-neighbour search\nreturns top K emotionally similar events"]
    end

    EV --> W1 --> TBL
    EV --> W2 --> ET --> OA --> COL
    TBL --> RQ
    COL --> RS
```

---

## Plugin System

```mermaid
classDiagram
    direction TB

    class SerenPlugin {
        <<interface>>
        +name : string
        +onReflect(ctx ReflectionContext) Promise of Record
    }

    class ReflectionContext {
        <<interface>>
        +trigger   : string
        +state     : EmotionState
        +intensity : number
        +felt      : string
        +timestamp : string
    }

    class PluginLoader {
        -_plugins : SerenPlugin[]
        +loadPlugins(dir string) Promise void
        +runPlugins(ctx ReflectionContext) Promise Record
        +getLoadedPlugins() string[]
    }

    class MarketTaggerPlugin {
        +name = "market-tagger"
        -CRYPTO_TOKENS : string[]
        -STOCK_TICKERS : string[]
        -classifyTrigger(t string) string
        +onReflect(ctx) Promise Record
        Outputs: market_label risk_flag alert_level
    }

    class CustomPlugin {
        +name : string
        +onReflect(ctx) Promise Record
        Drop folder into src/plugins/
        Export default SerenPlugin object
        No core code changes required
    }

    SerenPlugin       <|.. MarketTaggerPlugin : implements
    SerenPlugin       <|.. CustomPlugin       : implements
    PluginLoader       --> SerenPlugin         : loads and invokes
    PluginLoader      ..> ReflectionContext    : passes to each plugin
```

**Plugin boot sequence:**

```mermaid
flowchart TD
    A["loadPlugins called with PLUGIN_DIR"] --> B["readdir with withFileTypes"]
    B --> C{"Entry is a directory?"}
    C -->|No| B
    C -->|Yes| D["Try import index.js\nproduction build path"]
    D --> E{"Import succeeded?"}
    E -->|No| F["Try import index.ts\ntsx dev mode path"]
    F --> G{"Import succeeded?"}
    G -->|No| H["logger.error — skip this plugin\nserver continues normally"]
    G -->|Yes| I["Validate: name string and onReflect function present"]
    E -->|Yes| I
    I -->|Invalid| J["logger.warn — skip this plugin"]
    I -->|Valid| K["push to _plugins array\nlogger.info registered"]
    K --> B
    H --> B
    J --> B
    B --> L["All directories scanned\nServer finishes booting"]
```

---

## Database Schema

```mermaid
erDiagram
    REFLECTIONS {
        TEXT    id         PK  "UUID v4 — globally unique reflection ID"
        TEXT    timestamp      "ISO 8601 UTC — 2026-04-25T08:30:00.000Z"
        TEXT    state          "CALM or MANIC or DEPRESSED — CHECK constraint"
        REAL    intensity      "Float 0.0 to 1.0 — emotional magnitude"
        TEXT    trigger        "Raw input signal string — max 500 chars"
        TEXT    felt           "First-person inner monologue — deterministic"
    }
```

| Index | Column | Purpose |
|---|---|---|
| `idx_state` | `state` | Fast `/feelings?state=MANIC` filter |
| `idx_timestamp` | `timestamp DESC` | Fast time-ordered pagination |

---

## API Reference

### `GET /reflect`

Triggers a full emotional self-reflection cycle.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `trigger` | `string` | Yes | Input signal — text, event name, market label |
| `intensity_hint` | `float` 0–1 | No | Override the calculated intensity |

**Response `200 OK`:**
```json
{
  "timestamp": "2026-04-25T08:30:00.000Z",
  "state": "MANIC",
  "intensity": 0.87,
  "felt": "Everything is accelerating. I can feel it all at once.",
  "plugin_outputs": {
    "market-tagger": {
      "market_label": "crypto",
      "risk_flag": true,
      "alert_level": "high"
    }
  }
}
```

---

### `GET /feelings`

Returns a paginated log of recent emotional states.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `int` 1–100 | `20` | Max records to return |
| `state` | `CALM \| MANIC \| DEPRESSED` | — | Optional state filter |

**Response `200 OK`:**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timestamp": "2026-04-25T08:30:00.000Z",
    "state": "MANIC",
    "intensity": 0.87,
    "trigger": "BTC +12% 1h",
    "felt": "Everything is accelerating. I can feel it all at once."
  }
]
```

---

### `GET /health`

Returns service status and loaded plugin list.

**Response `200 healthy` or `503 degraded`:**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-25T08:30:05.000Z",
  "services": {
    "database": "ok",
    "qdrant": "ok"
  },
  "plugins": ["market-tagger"]
}
```

---

## Directory Structure

```
seren/
├── src/
│   ├── index.ts                    # Hono entrypoint — boot sequence
│   ├── routes/
│   │   ├── reflect.ts              # GET /reflect — full reflection cycle
│   │   ├── feelings.ts             # GET /feelings — paginated log query
│   │   └── health.ts               # GET /health  — service status
│   ├── core/
│   │   ├── emotionEngine.ts        # Pure signal → state + intensity function
│   │   ├── feltGenerator.ts        # Deterministic state/intensity → felt-text
│   │   └── stateTypes.ts           # All shared TypeScript types
│   ├── memory/
│   │   ├── logDb.ts                # SQLite append + query (better-sqlite3)
│   │   └── qdrantClient.ts         # Qdrant upsert + semantic search
│   ├── plugins/
│   │   ├── loader.ts               # Dynamic ESM scanner + runner
│   │   └── market-tagger/
│   │       └── index.ts            # Built-in market classification plugin
│   └── utils/
│       └── logger.ts               # Structured JSON logger
├── .env.example                    # All required env vars documented
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting Started

```bash
# 1. Clone
git clone https://github.com/jconstantine627752-maker/SEREN.git
cd SEREN

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — set OPENAI_API_KEY at minimum

# 4. Start Qdrant (Docker)
docker run -p 6333:6333 qdrant/qdrant

# 5. Run in dev mode with hot-reload
pnpm dev

# 6. Test the API
curl "http://localhost:3000/health"
curl "http://localhost:3000/reflect?trigger=BTC+%2B12%25+1h"
curl "http://localhost:3000/feelings?limit=5"
```

**Production build:**
```bash
pnpm build
pnpm start
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant instance URL |
| `QDRANT_COLLECTION` | `seren_emotions` | Collection name (auto-created on boot) |
| `OPENAI_API_KEY` | — | Required for vector embedding |
| `DATABASE_URL` | `./seren.db` | SQLite path or Postgres DSN |
| `PLUGIN_DIR` | `./src/plugins` | Directory scanned for plugins at boot |

---

## Writing a Plugin

Create a folder in `src/plugins/` with an `index.ts`:

```typescript
import type { SerenPlugin } from '../../core/stateTypes.js'

const plugin: SerenPlugin = {
  name: 'my-plugin',

  onReflect: async ({ trigger, state, intensity, felt, timestamp }) => ({
    // return any JSON-serialisable object
    my_field: `${state} at ${intensity.toFixed(2)}`,
  }),
}

export default plugin
```

Restart the server. Your plugin output will appear in every `/reflect` response under `plugin_outputs["my-plugin"]`. Plugins that throw are automatically excluded from output — they never crash the server.

---
