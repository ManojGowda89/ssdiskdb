const test = require("node:test");
const assert = require("node:assert");
const { connect } = require("./dist/cjs/index.js");


test("SSDiskDB Local Mode Integration Tests", async (t) => {
  let localDb;
  const storagePath = "./test-local-db";

  t.before(async () => {
    // Ensure clean start
    const fs = require("fs");
    fs.rmSync(storagePath, { recursive: true, force: true });
    localDb = await connect({ storagePath });
  });

  t.after(async () => {
    if (localDb) {
      await localDb.close();
    }
    // Clean up
    const fs = require("fs");
    fs.rmSync(storagePath, { recursive: true, force: true });
  });

  await t.test("String operations in local mode", async () => {
    await localDb.set("key1", "val1");
    assert.strictEqual(await localDb.get("key1"), "val1");
    assert.strictEqual(await localDb.exists("key1"), true);
    assert.strictEqual(await localDb.exists("nonexistent"), false);

    // JSON objects
    const obj = { x: 10, y: [true, null] };
    await localDb.set("key2", obj);
    assert.deepStrictEqual(await localDb.get("key2"), obj);

    // Incr
    assert.strictEqual(await localDb.incr("counter", 10), 10);
    assert.strictEqual(await localDb.incr("counter", 5), 15);

    // Del
    await localDb.del("key1");
    assert.strictEqual(await localDb.get("key1"), undefined);
  });

  await t.test("Hash operations in local mode", async () => {
    await localDb.hset("hash1", "field1", "val1");
    assert.strictEqual(await localDb.hget("hash1", "field1"), "val1");
    await localDb.hset("hash1", "field2", { nested: true });
    assert.deepStrictEqual(await localDb.hget("hash1", "field2"), { nested: true });

    await localDb.hdel("hash1", "field1");
    assert.strictEqual(await localDb.hget("hash1", "field1"), undefined);
  });

  await t.test("Sorted Set operations in local mode", async () => {
    await localDb.zset("zset1", "m1", 99.5);
    assert.strictEqual(await localDb.zget("zset1", "m1"), 99.5);
    await localDb.zdel("zset1", "m1");
    assert.strictEqual(await localDb.zget("zset1", "m1"), undefined);
  });

  await t.test("Encryption in local mode", async () => {
    const secretLocalDb = await connect("./test-local-secure-db", { encryptionKey: "local-secret" });
    await secretLocalDb.set("confidential", { password: "123" });

    // Correct decryption
    assert.deepStrictEqual(await secretLocalDb.get("confidential"), { password: "123" });

    // Close to release the database directory lock
    await secretLocalDb.close();

    // Open without encryption key and read raw string format
    const rawLocalDb = await connect("./test-local-secure-db");
    const raw = await rawLocalDb.get("confidential");
    assert.strictEqual(typeof raw, "string");
    assert.ok(/^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(raw));

    await rawLocalDb.close();

    const fs = require("fs");
    fs.rmSync("./test-local-secure-db", { recursive: true, force: true });
  });

  await t.test("Data persistence in local mode", async () => {
    await localDb.set("persistKey", "should be saved");
    await localDb.close();

    // Reconnect to same path
    localDb = await connect({ storagePath });
    assert.strictEqual(await localDb.get("persistKey"), "should be saved");
  });

  await t.test("Web Dashboard HTTP Server API", async () => {
    const dashboardPort = 9005;
    const testDbPath = "./test-dashboard-db";
    const fs = require("fs");
    fs.rmSync(testDbPath, { recursive: true, force: true });

    // Connect and start dashboard
    const client = await connect({
      storagePath: testDbPath,
      startDashboard: true,
      dashboardPort
    });

    const getAuthHeader = (un, pw) => ({
      "Authorization": "Basic " + Buffer.from(`${un}:${pw}`).toString("base64")
    });

    // 1. Unauthenticated request
    const res1 = await fetch(`http://localhost:${dashboardPort}/`);
    assert.strictEqual(res1.status, 401);

    // 2. Authenticated request (HTML)
    const res2 = await fetch(`http://localhost:${dashboardPort}/`, {
      headers: getAuthHeader("manoj", "manoj")
    });
    assert.strictEqual(res2.status, 200);
    const html = await res2.text();
    assert.ok(html.includes("SSDiskDB Insights"));

    // 3. Authenticated keys API (empty)
    const res3 = await fetch(`http://localhost:${dashboardPort}/api/keys`, {
      headers: getAuthHeader("manoj", "manoj")
    });
    assert.strictEqual(res3.status, 200);
    const keys = await res3.json();
    assert.deepStrictEqual(keys, []);

    // 4. Save key through API
    const res4 = await fetch(`http://localhost:${dashboardPort}/api/keys`, {
      method: "POST",
      headers: {
        ...getAuthHeader("manoj", "manoj"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "string",
        key: "dashboard_test_key",
        value: { message: "hello dashboard" }
      })
    });
    assert.strictEqual(res4.status, 200);

    // Verify key in client
    const value = await client.get("dashboard_test_key");
    assert.deepStrictEqual(value, { message: "hello dashboard" });

    // 5. Get keys listing through API
    const res5 = await fetch(`http://localhost:${dashboardPort}/api/keys`, {
      headers: getAuthHeader("manoj", "manoj")
    });
    assert.strictEqual(res5.status, 200);
    const keys2 = await res5.json();
    assert.strictEqual(keys2.length, 1);
    assert.strictEqual(keys2[0].rawKey, "s:dashboard_test_key");
    assert.deepStrictEqual(keys2[0].value, { message: "hello dashboard" });

    // 6. Delete key through API
    const res6 = await fetch(`http://localhost:${dashboardPort}/api/keys`, {
      method: "DELETE",
      headers: {
        ...getAuthHeader("manoj", "manoj"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: "s:dashboard_test_key"
      })
    });
    assert.strictEqual(res6.status, 200);

    // Verify key deleted
    assert.strictEqual(await client.get("dashboard_test_key"), undefined);

    // Close client
    await client.close();

    // Verify server closed (fetch throws connection refused)
    await assert.rejects(async () => {
      await fetch(`http://localhost:${dashboardPort}/`);
    });

    // Cleanup
    fs.rmSync(testDbPath, { recursive: true, force: true });
  });

  await t.test("VPC Cross-Server Connections & Allowed Verification", async () => {
    const dashboardPort = 9006;
    const testDbPath = "./test-cross-server-db";
    const fs = require("fs");
    fs.rmSync(testDbPath, { recursive: true, force: true });

    // Connect and start dashboard server (central cache)
    const centralServer = await connect({
      storagePath: testDbPath,
      startDashboard: true,
      dashboardPort
    });

    // 1. Connection remote client should fail immediately on handshake if not registered/invalid key
    await assert.rejects(async () => {
      await connect({
        remoteUrl: `http://localhost:${dashboardPort}`,
        apiKey: "invalid_key",
        serverId: "server-a"
      });
    }, /Forbidden/);

    // 2. Register "server-a" and "server-b" in the central server
    const db = centralServer.db;
    const apiKeyA = "ssdb_key_a";
    const apiKeyB = "ssdb_key_b";
    await db.put("config:server:server-a", JSON.stringify({ registeredAt: Date.now(), apiKey: apiKeyA }));
    await db.put("config:server:server-b", JSON.stringify({ registeredAt: Date.now(), apiKey: apiKeyB }));

    // 3. Connection with valid apiKey should succeed now
    const clientA = await connect({
      remoteUrl: `http://localhost:${dashboardPort}`,
      apiKey: apiKeyA,
      serverId: "server-a"
    });

    // Now try set request, should succeed
    const resSet = await clientA.set("key1", "val1");
    assert.strictEqual(resSet, 1);

    // Verify key was saved with namespacing in central server
    const rawVal = await centralServer.db.get("s:client:server-a:key1");
    assert.ok(rawVal);
    assert.strictEqual(JSON.parse(rawVal), "val1");

    // Connect server-b client and set the same key to a different value
    const clientB = await connect({
      remoteUrl: `http://localhost:${dashboardPort}`,
      apiKey: apiKeyB,
      serverId: "server-b"
    });
    await clientB.set("key1", "val2");

    // Verify namespaced key isolation
    assert.strictEqual(await clientA.get("key1"), "val1");
    assert.strictEqual(await clientB.get("key1"), "val2");

    // Verify lists show both servers separately via HTTP API
    const resKeys = await fetch(`http://localhost:${dashboardPort}/api/keys`, {
      headers: {
        "Authorization": "Basic " + Buffer.from("manoj:manoj").toString("base64")
      }
    });
    const parsedKeys = await resKeys.json();
    
    // Should have 2 keys in list
    assert.strictEqual(parsedKeys.length, 2);
    
    const keyA = parsedKeys.find(k => k.server === "server-a");
    const keyB = parsedKeys.find(k => k.server === "server-b");
    assert.ok(keyA);
    assert.ok(keyB);
    assert.strictEqual(keyA.value, "val1");
    assert.strictEqual(keyB.value, "val2");

    // Close clients
    await clientA.close();
    await clientB.close();
    await centralServer.close();

    // Cleanup
    fs.rmSync(testDbPath, { recursive: true, force: true });
  });
});

