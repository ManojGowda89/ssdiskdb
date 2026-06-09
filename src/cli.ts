#!/usr/bin/env node
import { connect } from "./index";
import crypto from "crypto";
import readline from "readline";

function printHelp() {
  console.log(`
SSDiskDB CLI - Manage your embedded cache and dashboard server

Usage:
  ssdiskdb <command> [options]

Commands:
  start           Starts the local cache and web dashboard console, or connects as a remote client
  credentials     Updates the admin username and password stored in the database
  server          Manages allowed servers list (VPC access control)
  subaccount      Manages sub-accounts (junior / senior developers) for the dashboard

Options for 'start':
  --port <port>     Port to run the dashboard on (default: 8971)
  --path <path>     Path to the LevelDB database folder (default: ./ssdb-local-db)
  --remote <url>    Connect as a remote client to the specified central server URL
  --apiKey <key>    API key for remote client connection
  --serverId <id>   Server ID for remote client connection

Options for 'credentials':
  --username <un>  New admin username (required)
  --password <pw>  New admin password (required)
  --path <path>    Path to the LevelDB database folder (default: ./ssdb-local-db)

Options for 'server':
  add <address> [key]  Add an IP, Domain, or Server ID to allowed list (optionally specify custom API key)
  remove <address>     Remove an IP or Domain from allowed list
  list                 List all allowed servers and status
  --path <path>        Path to the LevelDB database folder (default: ./ssdb-local-db)

Options for 'subaccount':
  create --username <un> --password <pw> [--role <role>]  Create a new sub-account (role: junior or senior)
  remove <username>                                        Remove a sub-account
  list                                                     List all sub-accounts
  --path <path>                                            Path to the LevelDB database folder (default: ./ssdb-local-db)

Examples:
  npx ssdiskdb start --port 8971
  npx ssdiskdb start --remote http://localhost:8971 --apiKey mykey --serverId client-a
  npx ssdiskdb credentials --username admin --password secret
  npx ssdiskdb server add 10.0.0.5 my_custom_key
  npx ssdiskdb server list
  npx ssdiskdb subaccount create --username junior_dev --password pass --role junior
  npx ssdiskdb subaccount list
  `);
}

function promptPassword(query: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
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
    const remoteUrl = getFlagValue("--remote") || getFlagValue("--remoteUrl");
    const apiKey = getFlagValue("--apiKey") || getFlagValue("--api-key");
    const serverId = getFlagValue("--serverId") || getFlagValue("--server-id");

    if (remoteUrl) {
      if (!apiKey || !serverId) {
        console.error("Error: Both --apiKey and --serverId are required for remote client connection.");
        process.exit(1);
      }
      console.log(`Connecting to remote SSDiskDB server at ${remoteUrl}...`);
      try {
        const client = await connect({
          remoteUrl,
          apiKey,
          serverId
        });
        console.log(`Connected successfully in remote client mode.`);
        console.log(`Server ID: ${serverId}`);
        console.log(`Press Ctrl+C to disconnect...`);

        // Keep process alive
        process.on("SIGINT", async () => {
          console.log("\nDisconnecting...");
          await client.close();
          process.exit(0);
        });
      } catch (err: any) {
        console.error("Failed to connect to remote server:", err.message);
        process.exit(1);
      }
    } else {
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
        const apiKey = args[3] || "ssdb_" + crypto.randomBytes(16).toString("hex");
        await db.put("config:server:" + address, JSON.stringify({ registeredAt: Date.now(), apiKey, status: "allowed" }));
        console.log(`Successfully allowed server: ${address}`);
        console.log(`Used API Key: ${apiKey}`);
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
  } else if (command === "subaccount") {
    const subCommand = args[1];
    if (!subCommand || !["create", "remove", "list"].includes(subCommand)) {
      console.error("Error: Subcommand 'create', 'remove', or 'list' is required.");
      printHelp();
      process.exit(1);
    }

    try {
      console.log(`Opening database at ${dbPath}...`);
      const client = await connect({
        storagePath: dbPath
      });
      const db = (client as any).db;

      if (subCommand === "create") {
        const username = getFlagValue("--username");
        const password = getFlagValue("--password");
        const role = getFlagValue("--role") || "junior";

        if (!username || !password) {
          console.error("Error: Both --username and --password are required.");
          process.exit(1);
        }
        if (!["junior", "senior"].includes(role)) {
          console.error("Error: Invalid role. Must be 'junior' or 'senior'.");
          process.exit(1);
        }

        // Ask for admin password
        const adminPass = await promptPassword("Enter Admin Password to verify: ");
        if (!adminPass) {
          console.error("Error: Admin password verification required.");
          process.exit(1);
        }

        // Fetch stored admin credentials
        const storedCreds = await (client as any).getCredentials();
        const adminHash = crypto.createHash("sha256").update(adminPass).digest("hex");

        if (adminHash !== storedCreds.passwordHash) {
          console.error("Error: Invalid Admin Password. Operation aborted.");
          process.exit(1);
        }

        const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
        await db.put("config:subaccount:" + username, JSON.stringify({
          passwordHash,
          role,
          createdAt: Date.now()
        }));
        console.log(`Successfully created sub-account: ${username} (${role})`);

      } else if (subCommand === "remove") {
        const username = args[2];
        if (!username) {
          console.error("Error: Username is required.");
          process.exit(1);
        }

        // Ask for admin password
        const adminPass = await promptPassword("Enter Admin Password to verify: ");
        if (!adminPass) {
          console.error("Error: Admin password verification required.");
          process.exit(1);
        }

        // Fetch stored admin credentials
        const storedCreds = await (client as any).getCredentials();
        const adminHash = crypto.createHash("sha256").update(adminPass).digest("hex");

        if (adminHash !== storedCreds.passwordHash) {
          console.error("Error: Invalid Admin Password. Operation aborted.");
          process.exit(1);
        }

        // Check if subaccount exists
        try {
          await db.get("config:subaccount:" + username);
          await db.del("config:subaccount:" + username);
          console.log(`Successfully removed sub-account: ${username}`);
        } catch (e) {
          console.error(`Error: Sub-account "${username}" not found.`);
        }

      } else if (subCommand === "list") {
        console.log(`\nRegistered Sub-accounts:`);
        console.log(`------------------------`);
        let count = 0;
        for await (const [key, val] of db.iterator({ gte: "config:subaccount:", lte: "config:subaccount:\xff" })) {
          const username = key.substring("config:subaccount:".length);
          let role = "junior";
          try {
            const data = JSON.parse(val);
            if (data.role) role = data.role;
          } catch (e) {}
          console.log(`- ${username}  (Role: ${role})`);
          count++;
        }
        if (count === 0) {
          console.log(`(No sub-accounts registered yet.)`);
        }
        console.log("");
      }

      await client.close();
      process.exit(0);
    } catch (err: any) {
      console.error("Failed to manage sub-accounts:", err.message);
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
