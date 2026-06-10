# SSDiskDB

[![NPM Version](https://img.shields.io/npm/v/ssdiskdb.svg)](https://www.npmjs.com/package/ssdiskdb)
[![License](https://img.shields.io/npm/l/ssdiskdb.svg)](https://github.com/ManojGowda89/ssdiskdb/blob/main/LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-ManojGowda89%2Fssdiskdb-blue?logo=github)](https://github.com/ManojGowda89/ssdiskdb)
[![LevelDB](https://img.shields.io/badge/Database-Google%20LevelDB-blue?logo=google)](https://github.com/google/leveldb)
[![Inspired by SSDB](https://img.shields.io/badge/Inspired%20by-SSDB-brightgreen?logo=database)](https://github.com/ideawu/ssdb)

**SSDiskDB** is a high-performance, embedded, disk-backed NoSQL database and key-value store for Node.js, designed as a cost-effective alternative to Redis. It is built directly on top of [Google's LevelDB](https://github.com/google/leveldb).

It is **not** a wrapper or client for the SSDB database server; rather, it is a standalone, lightweight database library that brings Redis-like APIs (Strings, Hashes, Sorted Sets) directly to LevelDB. It is inspired by the design principles of SSDB and its production adoption by industry pioneers like Zerodha.

This database library is published on NPM at [npmjs.com/package/ssdiskdb](https://www.npmjs.com/package/ssdiskdb) and hosted on GitHub at [github.com/ManojGowda89/ssdiskdb](https://github.com/ManojGowda89/ssdiskdb).

---

## Motivation & Inspiration (Inspired by SSDB & Zerodha)

The creation of **SSDiskDB** is inspired by **SSDB** and tech-industry pioneers like **Zerodha** (India's largest stock broker), who document their use of disk-backed databases in their [Zerodha Tech Stack](https://zerodha.tech/stack/).

In massive production environments, storing billions of keys in memory-only databases like Redis becomes prohibitively expensive due to RAM costs. SSDB solved this by utilizing Google's [LevelDB](https://github.com/google/leveldb) as its storage engine under the hood, writing data to disk while maintaining a highly optimized memory cache for hot data, achieving near-Redis performance at a fraction of the cost.

**SSDiskDB** is built on these same principles: it leverages **LevelDB** directly inside Node.js to provide an embedded, Redis-like disk-backed database, without needing to run or manage an external SSDB server process.

### How Redis, SSDB, and SSDiskDB Compare

| Feature | Redis | SSDB | SSDiskDB |
| :--- | :--- | :--- | :--- |
| **Type** | Standalone TCP Server | Standalone TCP Server | Embedded Library / Server |
| **Storage Medium** | Primarily RAM (In-Memory) | Disk-backed (using LevelDB) | Disk-backed (using LevelDB) |
| **Data Capacity** | Constrained by available RAM | Constrained by disk capacity | Constrained by disk capacity (up to terabytes/petabytes) |
| **Operational Cost** | High (RAM is expensive at scale) | Low (Disk storage is cheap) | Extremely Low (No external server required in Local Mode) |
| **Implementation** | C | C++ | TypeScript / Node.js (via LevelDB) |
| **Data Structures** | Strings, Hashes, Lists, Sets, Sorted Sets, etc. | Strings, Hashes, Sorted Sets, Lists | Strings, Hashes, Sorted Sets |
| **Protocol** | Redis Protocol (RESP) | SSDB Protocol (Simple network protocol) | HTTP / JSON-RPC (Remote mode) or Native JS API (Local mode) |

### Key Use Cases for SSDiskDB

1. **Large-Scale Caching**: When cache sizes exceed hundreds of gigabytes or terabytes, SSDiskDB serves as an excellent disk-backed caching layer, saving massive amounts of RAM.
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

## Quick Start

```js
const { connect } = require("ssdiskdb");

(async () => {
  // Connects to local embedded LevelDB by default!
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

(async () => {
  // Connects to local embedded LevelDB by default!
  const db = await connect();

  await db.set("name", "Manoj");
  console.log(await db.get("name"));

  await db.close();
})();
```

---

## Connection Options

SSDiskDB is a local, embedded caching and database engine powered by **LevelDB**. It can operate as a purely local cache inside your application, or as a central cache server shared across multiple remote client servers (VPC environment) using secure API Keys.

### 1. Local Mode Connection (Quick Start)
Stores data in the default folder `./ssdb-local-db`:
```js
const { connect } = require("ssdiskdb");
const db = await connect();
```

To configure custom path, encryption (AES-256-CBC), or start the dashboard server:
```js
const db = await connect({
  storagePath: "./my-custom-data-dir",
  encryptionKey: "my-secure-key",
  startDashboard: true,
  dashboardPort: 8971
});
```

### 2. Remote Mode Connection (VPC Cross-Server)
When deployed inside a VPC, multiple client servers can use a central SSDiskDB cache server. To connect, a client server needs a secure API Key registered on the central server:
```js
const db = await connect({
  remoteUrl: "http://<central-server-ip>:8971",
  apiKey: "ssdb_c4dee067d4a23dd35da3270ddd5b2cc5",
  serverId: "server-a" // Identifier for your client server
});
```

*Connection parameters mapping:*
- **remoteUrl**: The URL/IP and port of the central SSDiskDB cache server (e.g. `http://10.0.0.2:8971`).
- **apiKey**: The whitelisted server's API Key. Find this in the dashboard under the **Allowed Servers** tab (in the **API Key** column) or by running the CLI command `npx ssdiskdb server list`.
- **serverId**: The whitelisted server identifier. This **must exactly match** the whitelisted value in the dashboard's **Server IP / Hostname** column (e.g., `server-a` or `10.0.0.5`).

### 3. Connection URIs (Single String Config & Client-Side Encryption)
For simplified configuration, you can connect using a single URI containing the credentials, host, and server ID.

**Standard (Plaintext) URI:**
```js
const db = await connect("ssdiskdb://ssdb_c4dee067d4a23dd35da3270ddd5b2cc5@<central-server-ip>:8971/server-a");
```

**Encrypted URI (with Client-Side AES-256-CBC Encryption):**
Secure data transparently *before* it leaves your client server. Only the client has the encryption key; the central server only sees and stores ciphertext, providing full data privacy.
```js
const db = await connect("ssdiskdb+encry://ssdb_c4dee067d4a23dd35da3270ddd5b2cc5@<central-server-ip>:8971/server-a?key=your-secret-aes-key");
```

> [!IMPORTANT]
> **Startup Handshake**: During `connect()`, a remote client performs an immediate validation handshake with the central server. If the API Key is invalid, the server is blocked/restricted, or the endpoint is unreachable, `connect()` fails early throwing a descriptive error.
> 
> **Data Isolation**: The central server automatically isolates database operations. Client-set keys are prefixed behind the scenes (e.g. `s:client:server-a:mykey`). Operations like `flush()` or `getAllKeys()` are sandboxed to only affect the client's own namespace.

> [!NOTE]
> **Storage Structure (Directory vs. Single File)**: Unlike SQLite (which stores all data in a single file like `db.sqlite`), **LevelDB is directory-based**. 
> When you specify a path (e.g., `./my-custom-data-dir` or the default `./ssdb-local-db`), SSDiskDB will automatically create that directory and manage internal lock, log, and SST files inside it. 
> **You do not need to create any file or directory beforehand**. The library initializes everything on first startup. We recommend using a descriptive directory path to keep your data organized.

---

## Web Insights Dashboard & CLI (NPM Executable)

SSDiskDB comes equipped with a built-in web console similar to Redis Insights. It operates on port `8971` by default and allows you to view database statistics, search keys, add/edit cache entries, delete records, clear the database, and manage allowed client connections.

### Dual-Mode Dashboard UI (Local & Remote Proxying)
The dashboard features a premium glassmorphic dual-mode login console:
- **Local Database Mode**: Login with your admin or sub-account credentials to manage the local embedded LevelDB engine.
- **Remote Connection Mode**: Login using a connection URI (`ssdiskdb://...` or `ssdiskdb+encry://...`). When connected in Remote Mode, the dashboard serves as a secure reverse-proxy console. All keys, metrics, and CRUD operations are dynamically forwarded to the central server, while restricting access to local-only admin configurations (like allowed servers or sub-accounts).

### 1. Launch via CLI (npx)

You can launch the database and dashboard, or connect as a remote client directly from your terminal using `npx`:

```bash
# Starts the local cache engine and opens the web dashboard on port 8971
npx ssdiskdb start

# Start on a custom port and database directory
npx ssdiskdb start --port 9000 --path ./my-custom-db

# Connect as a remote client to a central SSDiskDB server using parameters
npx ssdiskdb start --remote http://<central-server-ip>:8971 --apiKey <your-api-key> --serverId <your-server-id>

# Connect as a remote client using a connection URI (positional)
npx ssdiskdb start ssdiskdb://ssdb_c4dee067d4a23dd35da3270ddd5b2cc5@<central-server-ip>:8971/server-a

# Connect as a remote client using a connection URI (option)
npx ssdiskdb start --uri ssdiskdb://ssdb_c4dee067d4a23dd35da3270ddd5b2cc5@<central-server-ip>:8971/server-a
```

### 2. Configure Admin Credentials

By default, the dashboard is protected by Basic Authentication with username `manoj` and password `manoj`. You can change these credentials via the CLI:

```bash
npx ssdiskdb credentials --username myuser --password mysecurepass --path ./my-custom-db
```

### 3. Server Access Control & API Key Management (VPC Security)

To allow client servers to connect remotely, you must register them.

#### A. Manage via CLI:
```bash
# Allow a client server address and auto-generate its API Key
npx ssdiskdb server add 10.0.0.5 --path ./my-custom-db

# Allow a client server address with a pre-defined custom API Key
npx ssdiskdb server add 10.0.0.5 my_custom_key --path ./my-custom-db

# List all allowed servers and their API Keys
npx ssdiskdb server list --path ./my-custom-db

# Remove allowed server access
npx ssdiskdb server remove 10.0.0.5 --path ./my-custom-db
```

#### B. Manage via Web Dashboard:
In the web dashboard under the **Allowed Servers** tab, you can manage remote access in real-time:
- **Add Connections**: Input client IP/domain/ID to whitelist, and optionally enter a pre-defined **API Key**. If left blank, a secure API key is automatically generated.
- **See & Copy Keys**: Click **Copy Key** to copy the active server's API key.
- **Copy Connection URIs**: Click **Copy URI** to instantly copy a complete `ssdiskdb://` connection URI containing the dynamic server host, API Key, and server ID to configure your clients.
- **Restrict/Block Access**: Click the **Block** button to temporarily restrict client access. When blocked, the client immediately receives `403 Forbidden` on all heartbeats and cache operations. Click **Allow Access** to restore connection.
- **Reissue Key**: Click **Reissue Key** to regenerate a fresh API key. The old key is instantly invalidated, preventing unauthorized access.

### 4. Programmatic Launch

You can also start the web dashboard directly from your Node.js code:

```js
// Option 1: Start automatically during connection
const db = await connect({
  storagePath: "./my-custom-db",
  startDashboard: true,
  dashboardPort: 8971
});

// Option 2: Start manually on an active connection
const db = await connect("./my-custom-db");
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

- **Google LevelDB**: [github.com/google/leveldb](https://github.com/google/leveldb)
- **Official SSDB Database (Inspiration)**: [github.com/ideawu/ssdb](https://github.com/ideawu/ssdb)
- **SSDiskDB Repository**: [github.com/ManojGowda89/ssdiskdb](https://github.com/ManojGowda89/ssdiskdb)
- **SSDiskDB NPM Package**: [npmjs.com/package/ssdiskdb](https://www.npmjs.com/package/ssdiskdb)
- **Zerodha Tech Stack**: [zerodha.tech/stack](https://zerodha.tech/stack/)

---

## License

MIT

---

**SEO Keywords**: LevelDB, Node.js LevelDB, Redis Alternative, Disk-backed Cache, Node.js Redis Alternative, Embedded NoSQL Database, SSDiskDB, SSDB Inspired, LevelDB Cache, Encrypted LevelDB, LevelDB HTTP Server, Zerodha Tech Stack, LevelDB Node.js.
