const test = require("node:test");
const assert = require("node:assert");
const { connect } = require("./dist/cjs/index.js");

test("SSDiskDB Integration Tests", async (t) => {
  let db;

  t.before(async () => {
    db = await connect("127.0.0.1:8888");
  });

  t.after(async () => {
    if (db) {
      await db.close();
    }
  });

  await t.test("String operations (set, get, exists, incr, del)", async () => {
    // Clean up key if it exists
    await db.del("test_key");

    // exists should be false
    const existsBefore = await db.exists("test_key");
    assert.strictEqual(existsBefore, false);

    // set
    const setRes = await db.set("test_key", "hello_ssdb");
    assert.strictEqual(typeof setRes, "number");

    // exists should be true
    const existsAfter = await db.exists("test_key");
    assert.strictEqual(existsAfter, true);

    // get
    const getRes = await db.get("test_key");
    assert.strictEqual(getRes, "hello_ssdb");

    // incr
    await db.del("test_counter");
    const incrRes1 = await db.incr("test_counter");
    assert.strictEqual(incrRes1, 1);
    const incrRes2 = await db.incr("test_counter", 5);
    assert.strictEqual(incrRes2, 6);

    // del
    const delRes = await db.del("test_key");
    assert.strictEqual(typeof delRes, "number");

    const getAfterDel = await db.get("test_key");
    assert.strictEqual(getAfterDel, undefined);
  });

  await t.test("Hash operations (hset, hget, hdel)", async () => {
    const hashName = "test_hash";
    await db.hdel(hashName, "field1");

    // hset
    const hsetRes = await db.hset(hashName, "field1", "val1");
    assert.strictEqual(typeof hsetRes, "number");

    // hget
    const hgetRes = await db.hget(hashName, "field1");
    assert.strictEqual(hgetRes, "val1");

    // hdel
    const hdelRes = await db.hdel(hashName, "field1");
    assert.strictEqual(typeof hdelRes, "number");

    const hgetAfterDel = await db.hget(hashName, "field1");
    assert.strictEqual(hgetAfterDel, undefined);
  });

  await t.test("Sorted Set operations (zset, zget, zdel)", async () => {
    const zsetName = "test_zset";
    await db.zdel(zsetName, "member1");

    // zset
    const zsetRes = await db.zset(zsetName, "member1", 100);
    assert.strictEqual(typeof zsetRes, "number");

    // zget
    const zgetRes = await db.zget(zsetName, "member1");
    assert.strictEqual(zgetRes, 100);

    // zdel
    const zdelRes = await db.zdel(zsetName, "member1");
    assert.strictEqual(typeof zdelRes, "number");

    const zgetAfterDel = await db.zget(zsetName, "member1");
    assert.strictEqual(zgetAfterDel, undefined);
  });

  await t.test("JSON serialization/deserialization", async () => {
    // 1. Object
    await db.del("test_json_obj");
    const testObj = { name: "Alice", age: 30, hobbies: ["coding", "reading"] };
    await db.set("test_json_obj", testObj);
    const getObj = await db.get("test_json_obj");
    assert.deepStrictEqual(getObj, testObj);

    // 2. Array
    await db.del("test_json_arr");
    const testArr = [1, 2, "three", { four: true }];
    await db.set("test_json_arr", testArr);
    const getArr = await db.get("test_json_arr");
    assert.deepStrictEqual(getArr, testArr);

    // 3. Boolean
    await db.del("test_json_bool");
    await db.set("test_json_bool", true);
    const getBool = await db.get("test_json_bool");
    assert.strictEqual(getBool, true);

    // 4. Number
    await db.del("test_json_num");
    await db.set("test_json_num", 42);
    const getNum = await db.get("test_json_num");
    assert.strictEqual(getNum, 42);

    // 5. Clean up
    await db.del("test_json_obj");
    await db.del("test_json_arr");
    await db.del("test_json_bool");
    await db.del("test_json_num");
  });

  await t.test("Encryption and Decryption", async () => {
    // Connect with encryption key
    const secretDb = await connect("127.0.0.1:8888", { encryptionKey: "super-secret-key" });

    // Store value in encrypted connection
    await secretDb.del("encrypted_key");
    const secretData = { message: "highly confidential", code: 999 };
    await secretDb.set("encrypted_key", secretData);

    // Retrieve via encrypted connection (should be decrypted & deserialized)
    const decryptedData = await secretDb.get("encrypted_key");
    assert.deepStrictEqual(decryptedData, secretData);

    // Retrieve via unencrypted connection (should show the raw encrypted format)
    const rawVal = await db.get("encrypted_key");
    assert.strictEqual(typeof rawVal, "string");
    const hexRegex = /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;
    assert.ok(hexRegex.test(rawVal), "Should store in iv:ciphertext hex format");

    // Try to retrieve with WRONG encryption key
    const wrongDb = await connect("127.0.0.1:8888", { encryptionKey: "wrong-secret-key" });
    await assert.rejects(
      async () => {
        await wrongDb.get("encrypted_key");
      },
      /Decryption failed/
    );

    // Test encryption on hashes as well
    const hashName = "encrypted_hash";
    await secretDb.hdel(hashName, "field1");
    await secretDb.hset(hashName, "field1", { secureValue: "yes" });

    // Fetch via encrypted connection
    const decryptedHashVal = await secretDb.hget(hashName, "field1");
    assert.deepStrictEqual(decryptedHashVal, { secureValue: "yes" });

    // Fetch raw value from unencrypted connection
    const rawHashVal = await db.hget(hashName, "field1");
    assert.ok(hexRegex.test(rawHashVal), "Hash value should be stored encrypted");

    // Clean up
    await secretDb.del("encrypted_key");
    await secretDb.hdel(hashName, "field1");

    await secretDb.close();
    await wrongDb.close();
  });

  await t.test("Backward Compatibility (Legacy / Unencrypted keys)", async () => {
    // Write unencrypted legacy key
    await db.del("legacy_key");
    await db.set("legacy_key", "legacy_plain_text");

    // Read using encrypted connection
    const secretDb = await connect("127.0.0.1:8888", { encryptionKey: "super-secret-key" });
    const legacyVal = await secretDb.get("legacy_key");
    // Should get raw unencrypted string without errors
    assert.strictEqual(legacyVal, "legacy_plain_text");

    // Clean up
    await db.del("legacy_key");
    await secretDb.close();
  });
});
