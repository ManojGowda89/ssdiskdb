# SSDiskDB

[![NPM Version](https://img.shields.io/npm/v/ssdiskdb.svg)](https://www.npmjs.com/package/ssdiskdb)
[![License](https://img.shields.io/npm/l/ssdiskdb.svg)](https://github.com/ManojGowda89/ssdiskdb/blob/main/LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-ManojGowda89%2Fssdiskdb-blue?logo=github)](https://github.com/ManojGowda89/ssdiskdb)
[![SSDB Database](https://img.shields.io/badge/Database-ideawu%2Fssdb-brightgreen?logo=database)](https://github.com/ideawu/ssdb)

**SSDiskDB** is a high-performance, modern, Promise-based client wrapper for [SSDB (Fast NoSQL Database)](https://github.com/ideawu/ssdb). It is designed to act as an easy, clean, and developer-friendly API layer to interact with SSDB in production Node.js applications. 

This client library is published on NPM at [npmjs.com/package/ssdiskdb](https://www.npmjs.com/package/ssdiskdb) and hosted on GitHub at [github.com/ManojGowda89/ssdiskdb](https://github.com/ManojGowda89/ssdiskdb).

---

## Why SSDB? (Inspired by Zerodha)

Our adoption of SSDB in production as a primary key-value cache is inspired by tech-industry pioneers like **Zerodha** (India's largest stock broker), who document their use of SSDB in their [Zerodha Tech Stack](https://zerodha.tech/stack/).

In massive production environments, storing billions of keys in memory-only databases like Redis becomes prohibitively expensive due to RAM costs. SSDB solves this by utilizing Google's **LevelDB** as its storage engine. It writes data to disk while maintaining a highly optimized memory cache for hot data, achieving near-Redis performance at a fraction of the cost.

### How Redis and SSDB Differ

| Feature | Redis | SSDB |
| :--- | :--- | :--- |
| **Storage Medium** | Primarily RAM (In-Memory) | Disk-backed (using LevelDB) with memory cache for hot data |
| **Data Capacity** | Constrained by available RAM | Constrained by disk capacity (up to terabytes/petabytes) |
| **Operational Cost** | High (RAM is expensive at scale) | Low (Disk storage is extremely cost-effective) |
| **Warmup Behavior** | None (Immediate, but high boot time on snapshot loads) | Incremental (Cache warms up as keys are queried) |
| **Data Structure Support** | Strings, Hashes, Lists, Sets, Sorted Sets, HyperLogLogs, etc. | Strings, Hashes, Sorted Sets, Lists |
| **Protocol** | Redis Protocol (RESP) | SSDB Protocol (Simple network protocol) |

### Key Use Cases for SSDB

1. **Large-Scale Caching**: When cache sizes exceed hundreds of gigabytes or terabytes, SSDB serves as an excellent disk-backed caching layer, saving massive amounts of RAM.
2. **Session Storage**: Managing active sessions for millions of concurrent users without ballooning hosting costs.
3. **Analytics & Metrics**: Storing high-throughput telemetry, counters, and log statistics.
4. **Queue & Sorted List Buffers**: Operating high-volume sorted sets and hashes that are too large to fit in Redis memory.

---

## Key Features of SSDiskDB

- ⚡ **Modern Promise-Based API**: Fully compatible with `async/await` syntax.
- 🔌 **Built-in Connection Pooling**: Manages network sockets efficiently.
- 📦 **Automatic JSON Serialization**: Directly save and load objects, arrays, numbers, and booleans without manually calling `JSON.stringify` or `JSON.parse`.
- 🔒 **AES-256-CBC Encryption**: Transparently encrypt values on write and decrypt on read using a connection-wide `encryptionKey`.
- 🔄 **Legacy Backward Compatibility**: Auto-detects and reads unencrypted legacy values safely without crashing or failing.
- 📘 **TypeScript Native**: Complete type safety and IDE autocomplete.
- 📦 **Dual ESM & CommonJS**: Ready for both modern and legacy runtime environments.

---

## Installation

```bash
npm install ssdiskdb
```

## Prerequisites

An active SSDB server must be running.

### Example Docker Command

```bash
docker run -d \
  --name ssdb \
  -p 8888:8888 \
  cleardevice/ssdb
```

---

## Quick Start

```js
const { connect } = require("ssdiskdb");

(async () => {
  const db = await connect();

  await db.set("name", "Manoj");
  const value = await db.get("name");
  console.log(value); // Output: Manoj

  await db.close();
})();
```

### TypeScript Usage

```ts
import { connect } from "ssdiskdb";

const db = await connect("127.0.0.1:8888");

await db.set("name", "Manoj");
console.log(await db.get("name"));

await db.close();
```

---

## Connect with Encryption

To encrypt data stored in SSDB, supply an `encryptionKey` option during connection. Values will be automatically encrypted using `aes-256-cbc`.

```js
// Option 1: Pass custom host and options
const db = await connect("127.0.0.1:8888", {
  encryptionKey: "my-secure-key"
});

// Option 2: Pass options object
const db = await connect({
  host: "127.0.0.1:8888",
  encryptionKey: "my-secure-key"
});
```

*Note: Unencrypted legacy data in the database will still be read correctly as SSDiskDB transparently falls back to unencrypted reads for backward compatibility.*

---

## Connect to Embedded Local Database (Database-less Mode)

For simple or offline projects where you do not want to set up and run a separate SSDB server, SSDiskDB provides an embedded local mode powered by **LevelDB**. It handles all storage locally on disk and supports the exact same API operations, including automatic JSON typing and optional encryption!

```js
// Option 1: Quick start (stores in default folder './ssdb-local-db')
const db = await connect("local");

// Option 2: Connect to a custom directory path
const db = await connect("local:./my-custom-data-dir");

// Option 3: Configure via options object
const db = await connect({
  local: true,
  storagePath: "./my-custom-data-dir",
  encryptionKey: "my-secure-key" // Local embedded storage can be encrypted too!
});
```

> [!NOTE]
> **Storage Structure (Directory vs. Single File)**: Unlike SQLite (which stores all data in a single file like `db.sqlite`), **LevelDB is directory-based**. 
> When you specify a path (e.g., `./my-custom-data-dir` or the default `./ssdb-local-db`), SSDiskDB will automatically create that directory and manage internal lock, log, and SST files inside it. 
> **You do not need to create any file or directory beforehand**. The library initializes everything on first startup. We recommend using a descriptive directory path to keep your data organized.

---

## Web Insights Dashboard & CLI (NPM Executable)

SSDiskDB comes equipped with a built-in web console similar to Redis Insights. It operates on port `8971` by default and allows you to view database statistics, search keys, add/edit cache entries, delete records, and clear the database.

### 1. Launch via CLI (npx)

You can launch the dashboard directly from your terminal using `npx`:

```bash
# Starts the local cache engine and opens the web dashboard on port 8971
npx ssdiskdb start

# Start on a custom port and database directory
npx ssdiskdb start --port 9000 --path ./my-custom-db
```

### 2. Configure Admin Credentials

By default, the dashboard is protected by Basic Authentication with username `admin` and password `admin`. You can change these credentials via the CLI:

```bash
npx ssdiskdb credentials --username myuser --password mysecurepass --path ./my-custom-db
```

### 3. Programmatic Launch

You can also start the web dashboard directly from your Node.js code:

```js
// Option 1: Start automatically during connection
const db = await connect({
  local: true,
  storagePath: "./my-custom-db",
  startDashboard: true,
  dashboardPort: 8971
});

// Option 2: Start manually on an active connection
const db = await connect("local");
await db.startDashboard(8971);
```

When you close the database connection with `await db.close()`, the web dashboard server will shut down automatically.

---

## Automatic JSON Serialization & Typing

SSDiskDB automatically serializes and deserializes non-string values:

```js
const db = await connect();

// Storing a complex object (no manual JSON.stringify needed!)
await db.set("user:1", {
  name: "Manoj",
  role: "Developer",
  active: true
});

const user = await db.get("user:1");
console.log(user); // Output: { name: 'Manoj', role: 'Developer', active: true } (already parsed!)
```

---

## Available Methods

### String Operations

```js
await db.set(key, value); // value can be string, object, array, number, boolean
await db.get(key);        // returns value with original type preserved
await db.del(key);        // deletes a key
await db.exists(key);     // returns boolean
await db.incr(key, num);  // increments an integer value
```

### Hash Operations

```js
await db.hset(hash, key, value); // stores value in a hash map
await db.hget(hash, key);        // retrieves value from a hash map
await db.hdel(hash, key);        // deletes a key from a hash map
```

### Sorted Set Operations

```js
await db.zset(set, key, score);  // sets the score of a member in a sorted set
await db.zget(set, key);        // retrieves the score of a member
await db.zdel(set, key);        // deletes a member from a sorted set
```

### Close Connection

```js
await db.close(); // Closes client connection and destroys the pool
```

---

## References

- **Official SSDB Database**: [github.com/ideawu/ssdb](https://github.com/ideawu/ssdb)
- **SSDiskDB Client Library**: [github.com/ManojGowda89/ssdiskdb](https://github.com/ManojGowda89/ssdiskdb)
- **SSDiskDB NPM Package**: [npmjs.com/package/ssdiskdb](https://www.npmjs.com/package/ssdiskdb)
- **Zerodha Tech Stack**: [zerodha.tech/stack](https://zerodha.tech/stack/)

---

## License

MIT

---

**SEO Keywords**: SSDB, SSDB Client, SSDB Driver, Node.js SSDB, Promise SSDB Client, Redis Alternative, TypeScript SSDB Client, AES-256-CBC Encrypted SSDB, Fast NoSQL Database Wrapper, ideawu ssdb client, Node.js NoSQL Client, SSDiskDB, Zerodha Tech Stack SSDB.
