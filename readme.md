# SSDiskDB

SSDiskDB is a high-performance, modern, Promise-based client wrapper for [SSDB (Fast NoSQL Database)](https://github.com/ideawu/ssdb). It is designed to act as a modern API layer to interact with SSDB in an easy, clean, and developer-friendly way.

Unlike older legacy callback-based SSDB libraries, SSDiskDB provides an out-of-the-box production-ready interface equipped with advanced developer ergonomics.

## Key Features (Production Ready)

- ⚡ **Modern Promise-Based API**: Say goodbye to callback hell; fully compatible with `async/await`.
- 🔌 **Built-in Connection Pooling**: Handles connections efficiently under heavy load.
- 📦 **Automatic JSON Serialization**: Directly save and load JavaScript objects, arrays, numbers, and booleans without manually calling `JSON.stringify` and `JSON.parse`.
- 🔒 **AES-256-CBC Encryption**: Secure your data transparently. Values are automatically encrypted on storage and decrypted on retrieval.
- 🔄 **Legacy Backward Compatibility**: Bypasses decryption automatically for legacy unencrypted data, making migration painless.
- 📘 **TypeScript Native**: Ship type-safe code with built-in, comprehensive type declarations.
- 📦 **Dual ESM & CommonJS**: Published with dual compilation targets for compatibility across modern and legacy runtimes.

---

## Installation

```bash
npm install ssdiskdb
```

## Prerequisites

Make sure an SSDB server is running.

Example Docker command:

```bash
docker run -d \
  --name ssdb \
  -p 8888:8888 \
  cleardevice/ssdb
```

## Quick Start

```js
const { connect } = require("ssdiskdb");

(async () => {
  const db = await connect();

  await db.set("name", "Manoj");

  const value = await db.get("name");

  console.log(value);

  await db.close();
})();
```

## TypeScript

```ts
import { connect } from "ssdiskdb";

const db = await connect();

await db.set("name", "Manoj");

console.log(await db.get("name"));

await db.close();
```

## Connect with Encryption

To store your values securely, you can pass an `encryptionKey` when connecting. All stored string values and hash values will be encrypted using `aes-256-cbc`.

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

### Backward Compatibility
If an `encryptionKey` is configured, SSDiskDB automatically detects if a value in the database is unencrypted (legacy data) and reads it directly without attempting decryption. This allows you to enable encryption on existing databases without breaking existing keys.

## Automatic JSON Serialization & Typing

SSDiskDB automatically serializes and deserializes non-string values. You do not need to call `JSON.stringify` or `JSON.parse` manually.

- Storing objects/arrays/numbers/booleans automatically converts them to JSON strings.
- Retrieving them automatically parses them back to their original JS types (e.g., retrieving a number returns a JS `number`, an object returns a JS `object`).

## Available Methods

### String Operations

```js
await db.set(key, value); // value can be string, object, array, number, boolean
await db.get(key);        // returns value with original type preserved
await db.del(key);
await db.exists(key);
await db.incr(key);
```

### Hash Operations

```js
await db.hset(hash, key, value); // value can be any JS type
await db.hget(hash, key);        // returns value with original type preserved
await db.hdel(hash, key);
```

### Sorted Set Operations

```js
await db.zset(set, key, score);
await db.zget(set, key);
await db.zdel(set, key);
```

### Close Connection

```js
await db.close();
```

## Example

```js
const { connect } = require("ssdiskdb");

(async () => {
  const db = await connect();

  // No manual JSON.stringify needed anymore!
  await db.set("user:1", {
    name: "Manoj",
    role: "Developer"
  });

  const user = await db.get("user:1");

  console.log(user); // Output: { name: 'Manoj', role: 'Developer' } (already parsed!)

  await db.close();
})();
```

## License

MIT

---

**SEO Keywords**: SSDB, SSDB Client, SSDB Driver, Node.js SSDB, Promise SSDB Client, Redis Alternative, TypeScript SSDB Client, AES-256-CBC Encrypted SSDB, Fast NoSQL Database Wrapper, ideawu ssdb client, Node.js NoSQL Client, SSDiskDB.


