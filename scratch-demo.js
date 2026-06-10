const { connect } = require("./dist/cjs/index.js");

(async () => {
  const adminAuth = "Basic " + Buffer.from("manoj:manoj").toString("base64");
  const dashboardUrl = "http://localhost:8971";

  console.log("Initializing local keys via Dashboard API...");

  // Helper function to send API requests to the dashboard
  async function postApi(path, body) {
    const res = await fetch(`${dashboardUrl}${path}`, {
      method: "POST",
      headers: {
        "Authorization": adminAuth,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed (${res.status}): ${text}`);
    }
    return res;
  }

  // 1. Write Local Keys via API
  await postApi("/api/keys", { type: "string", key: "local_str_welcome", value: "Welcome to SSDiskDB Dashboard!" });
  await postApi("/api/keys", { type: "string", key: "local_str_status", value: { status: "Active", uptime: "99.9%" } });
  await postApi("/api/keys", { type: "string", key: "local_num_counter", value: 100 });

  await postApi("/api/keys", { type: "hash", name: "local_hash_user", key: "name", value: "Manoj Gowda" });
  await postApi("/api/keys", { type: "hash", name: "local_hash_user", key: "role", value: "Lead Administrator" });
  await postApi("/api/keys", { type: "hash", name: "local_hash_user", key: "level", value: "Gold" });

  await postApi("/api/keys", { type: "zset", name: "local_zset_leaderboard", key: "player_alex", score: 95.5 });
  await postApi("/api/keys", { type: "zset", name: "local_zset_leaderboard", key: "player_bob", score: 88.0 });
  await postApi("/api/keys", { type: "zset", name: "local_zset_leaderboard", key: "player_charlie", score: 72.1 });
  
  console.log("Local keys initialized.");

  // 2. Register allowed remote server
  const apiKey = "ssdb_demo_api_key_999";
  console.log(`Registering remote server 'prod-web-server-1' with key '${apiKey}'...`);
  await postApi("/api/servers", { address: "prod-web-server-1", apiKey: apiKey });

  console.log("Allowed server registered successfully. Connecting remote client...");

  // 3. Connect as remote client over HTTP (this does not lock LevelDB!)
  const remoteUri = `ssdiskdb://${apiKey}@localhost:8971/prod-web-server-1`;
  const remoteClient = await connect(remoteUri);

  // 4. Perform Remote CRUD operations
  console.log("Writing remote client keys...");
  await remoteClient.set("session_user_token", "user_session_abc123xyz");
  await remoteClient.set("session_meta", { auth: true, expires: "2026-06-11" });
  await remoteClient.set("visits_counter", 1);
  await remoteClient.incr("visits_counter", 15); // should become 16

  await remoteClient.hset("cart_items", "item_laptop", 1);
  await remoteClient.hset("cart_items", "item_mouse", 2);

  await remoteClient.zset("highscores", "score_alpha", 500);
  await remoteClient.zset("highscores", "score_beta", 320);

  // 5. Verify reads
  console.log("Verifying remote client reads:");
  console.log(" - session_user_token:", await remoteClient.get("session_user_token"));
  console.log(" - visits_counter:", await remoteClient.get("visits_counter"));
  console.log(" - cart_items (item_laptop):", await remoteClient.hget("cart_items", "item_laptop"));
  console.log(" - highscores (score_alpha):", await remoteClient.zget("highscores", "score_alpha"));

  await remoteClient.close();
  console.log("All Local and Remote operations completed successfully!");
})();
