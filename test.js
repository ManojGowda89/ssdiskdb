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
      headers: getAuthHeader("admin", "admin")
    });
    assert.strictEqual(res2.status, 200);
    const html = await res2.text();
    assert.ok(html.includes("SSDiskDB Insights"));

    // 3. Authenticated keys API (empty)
    const res3 = await fetch(`http://localhost:${dashboardPort}/api/keys`, {
      headers: getAuthHeader("admin", "admin")
    });
    assert.strictEqual(res3.status, 200);
    const keys = await res3.json();
    assert.deepStrictEqual(keys, []);

    // 4. Save key through API
    const res4 = await fetch(`http://localhost:${dashboardPort}/api/keys`, {
      method: "POST",
      headers: {
        ...getAuthHeader("admin", "admin"),
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
      headers: getAuthHeader("admin", "admin")
    });
    assert.strictEqual(res5.status, 200);
    const keys2 = await res5.json();
    assert.strictEqual(keys2.length, 1);
    assert.strictEqual(keys2[0].key, "s:dashboard_test_key");
    assert.deepStrictEqual(keys2[0].value, { message: "hello dashboard" });

    // 6. Delete key through API
    const res6 = await fetch(`http://localhost:${dashboardPort}/api/keys`, {
      method: "DELETE",
      headers: {
        ...getAuthHeader("admin", "admin"),
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
});

