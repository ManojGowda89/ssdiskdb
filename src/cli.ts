#!/usr/bin/env node
import { connect } from "./index";
import crypto from "crypto";

function printHelp() {
  console.log(`
SSDiskDB CLI - Manage your embedded cache and dashboard server

Usage:
  ssdiskdb <command> [options]

Commands:
  start           Starts the local cache and web dashboard console
  credentials     Updates the admin username and password stored in the database
  server          Manages allowed servers list (VPC access control)

Options for 'start':
  --port <port>   Port to run the dashboard on (default: 8971)
  --path <path>   Path to the LevelDB database folder (default: ./ssdb-local-db)

Options for 'credentials':
  --username <un> New admin username (required)
  --password <pw> New admin password (required)
  --path <path>   Path to the LevelDB database folder (default: ./ssdb-local-db)

Options for 'server':
  add <address>    Add an IP or Domain to allowed list
  remove <address> Remove an IP or Domain from allowed list
  list             List all allowed servers and status
  --path <path>    Path to the LevelDB database folder (default: ./ssdb-local-db)

Examples:
  npx ssdiskdb start --port 8971
  npx ssdiskdb credentials --username admin --password secret
  npx ssdiskdb server add 10.0.0.5
  npx ssdiskdb server list
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    process.exit(0);
  }

  // Helper to parse flag arguments
  const getFlagValue = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return undefined;
  };

  const dbPath = getFlagValue("--path") || "./ssdb-local-db";

  if (command === "start") {
    const portStr = getFlagValue("--port") || "8971";
    const port = parseInt(portStr, 10);
    if (isNaN(port)) {
      console.error("Error: Invalid port specified");
      process.exit(1);
    }

    console.log(`Initializing SSDiskDB in local mode...`);
    console.log(`Database directory: ${dbPath}`);

    try {
      const client = await connect({
        storagePath: dbPath,
        startDashboard: true,
        dashboardPort: port
      });

      console.log(`SSDiskDB Local Engine started successfully.`);
      console.log(`Dashboard is running at: http://localhost:${port}`);
      console.log(`Default credentials: manoj / manoj (Use credentials command to change)`);
      console.log(`Press Ctrl+C to terminate...`);

      // Keep process alive
      process.on("SIGINT", async () => {
        console.log("\nStopping server...");
        await client.close();
        process.exit(0);
      });
    } catch (err: any) {
      console.error("Failed to start server:", err.message);
      process.exit(1);
    }
  } else if (command === "credentials") {
    const username = getFlagValue("--username");
    const password = getFlagValue("--password");

    if (!username || !password) {
      console.error("Error: Both --username and --password are required.");
      printHelp();
      process.exit(1);
    }

    try {
      console.log(`Opening database at ${dbPath}...`);
      const client = await connect({
        storagePath: dbPath
      });

      if (typeof (client as any).setCredentials === "function") {
        const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
        await (client as any).setCredentials(username, passwordHash);
        console.log(`Credentials updated successfully!`);
        console.log(`Username set to: ${username}`);
      } else {
        console.error("Error: Client configuration does not support setting credentials.");
      }

      await client.close();
      process.exit(0);
    } catch (err: any) {
      console.error("Failed to update credentials:", err.message);
      process.exit(1);
    }
  } else if (command === "server") {
    const subCommand = args[1];
    if (!subCommand || !["add", "remove", "list"].includes(subCommand)) {
      console.error("Error: Subcommand 'add', 'remove', or 'list' is required.");
      printHelp();
      process.exit(1);
    }

    try {
      console.log(`Opening database at ${dbPath}...`);
      const client = await connect({
        storagePath: dbPath
      });
      const db = (client as any).db;

      if (subCommand === "add") {
        const address = args[2];
        if (!address) {
          console.error("Error: Address (IP or Domain) is required.");
          process.exit(1);
        }
        const apiKey = "ssdb_" + crypto.randomBytes(16).toString("hex");
        await db.put("config:server:" + address, JSON.stringify({ registeredAt: Date.now(), apiKey, status: "allowed" }));
        console.log(`Successfully allowed server: ${address}`);
        console.log(`Generated API Key: ${apiKey}`);
      } else if (subCommand === "remove") {
        const address = args[2];
        if (!address) {
          console.error("Error: Address (IP or Domain) is required.");
          process.exit(1);
        }
        await db.del("config:server:" + address);
        console.log(`Successfully removed server: ${address}`);
      } else if (subCommand === "list") {
        console.log(`\nAllowed Remote Servers:`);
        console.log(`------------------------`);
        let count = 0;
        for await (const [key, val] of db.iterator({ gte: "config:server:", lte: "config:server:\xff" })) {
          const addr = key.substring("config:server:".length);
          let apiKey = "(None)";
          try {
            const data = JSON.parse(val);
            if (data.apiKey) {
              apiKey = data.apiKey;
            }
          } catch (e) {}
          console.log(`- ${addr}  (API Key: ${apiKey})`);
          count++;
        }
        if (count === 0) {
          console.log(`(No remote servers allowed yet. Access is currently deny-all.)`);
        }
        console.log("");
      }

      await client.close();
      process.exit(0);
    } catch (err: any) {
      console.error("Failed to manage servers:", err.message);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
