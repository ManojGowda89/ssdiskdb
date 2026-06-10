import crypto from "crypto";
import { Level } from "level";
import { startDashboardServer, DashboardServer } from "./dashboard";

export interface SSDiskDBClient {
  set(key: string, value: any): Promise<any>;
  get(key: string): Promise<any>;
  del(key: string): Promise<any>;
  exists(key: string): Promise<boolean>;
  incr(key: string, num?: number): Promise<number>;

  hset(name: string, key: string, value: any): Promise<any>;
  hget(name: string, key: string): Promise<any>;
  hdel(name: string, key: string): Promise<any>;

  zset(name: string, key: string, score: number): Promise<any>;
  zget(name: string, key: string): Promise<any>;
  zdel(name: string, key: string): Promise<any>;

  close(): Promise<void>;

  // Dashboard & CLI configurations
  startDashboard(port?: number): Promise<void>;
  getAllKeys(): Promise<{ key: string; value: any }[]>;
  flush(): Promise<void>;
  setCredentials(username: string, passwordHash: string): Promise<void>;
  getCredentials(): Promise<{ username: string; passwordHash: string }>;
}

export interface ConnectOptions {
  storagePath?: string;
  encryptionKey?: string;
  startDashboard?: boolean;
  dashboardPort?: number;
  remoteUrl?: string;
  username?: string;
  password?: string;
  serverId?: string;
  apiKey?: string;
}

function serialize(value: any): string {
  if (value === undefined) {
    return "null";
  }
  return JSON.stringify(value);
}

function deserialize(value: any): any {
  if (value === undefined || value === null) {
    return undefined;
  }
  const strValue = typeof value === "string" ? value : value.toString();
  try {
    return JSON.parse(strValue);
  } catch (e) {
    return strValue;
  }
}

function encrypt(text: string, encryptionKey: string): string {
  const hashedKey = crypto.createHash("sha256").update(encryptionKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", hashedKey, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string, encryptionKey: string): string {
  const hexRegex = /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;
  if (!hexRegex.test(encryptedText)) {
    return encryptedText;
  }
  try {
    const parts = encryptedText.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const ciphertext = parts[1];
    const hashedKey = crypto.createHash("sha256").update(encryptionKey).digest();
    const decipher = crypto.createDecipheriv("aes-256-cbc", hashedKey, iv);
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    throw new Error(`Decryption failed: ${(err as Error).message}`);
  }
}

class LocalSSDBClient implements SSDiskDBClient {
  private db: Level<string, string>;
  private encryptionKey?: string;
  private dashboardServer?: DashboardServer;

  constructor(db: Level<string, string>, encryptionKey?: string) {
    this.db = db;
    this.encryptionKey = encryptionKey;
  }

  private getFullKey(prefix: string, name: string, key?: string): string {
    if (key === undefined) {
      return `${prefix}:${name}`;
    }
    return `${prefix}:${name}:${key}`;
  }

  async set(key: string, value: any): Promise<any> {
    let serialized: string;
    if (typeof value === "string" && /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(value)) {
      serialized = value;
    } else {
      serialized = serialize(value);
      if (this.encryptionKey) {
        serialized = encrypt(serialized, this.encryptionKey);
      }
    }
    await this.db.put(this.getFullKey("s", key), serialized);
    return 1;
  }

  async get(key: string): Promise<any> {
    let res = await this.db.get(this.getFullKey("s", key));
    if (res !== undefined && res !== null) {
      if (this.encryptionKey) {
        res = decrypt(res, this.encryptionKey);
      }
      res = deserialize(res);
    }
    return res;
  }

  async del(key: string): Promise<any> {
    await this.db.del(this.getFullKey("s", key));
    return 1;
  }

  async exists(key: string): Promise<boolean> {
    const val = await this.db.get(this.getFullKey("s", key));
    return val !== undefined;
  }

  async incr(key: string, num: number = 1): Promise<number> {
    const fullKey = this.getFullKey("s", key);
    let val = 0;
    let raw = await this.db.get(fullKey);
    if (raw !== undefined) {
      if (this.encryptionKey) {
        raw = decrypt(raw, this.encryptionKey);
      }
      const parsed = deserialize(raw);
      val = Number(parsed) || 0;
    }
    const newVal = val + num;
    let serialized = serialize(newVal);
    if (this.encryptionKey) {
      serialized = encrypt(serialized, this.encryptionKey);
    }
    await this.db.put(fullKey, serialized);
    return newVal;
  }

  async hset(name: string, key: string, value: any): Promise<any> {
    let serialized: string;
    if (typeof value === "string" && /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(value)) {
      serialized = value;
    } else {
      serialized = serialize(value);
      if (this.encryptionKey) {
        serialized = encrypt(serialized, this.encryptionKey);
      }
    }
    await this.db.put(this.getFullKey("h", name, key), serialized);
    return 1;
  }

  async hget(name: string, key: string): Promise<any> {
    let res = await this.db.get(this.getFullKey("h", name, key));
    if (res !== undefined && res !== null) {
      if (this.encryptionKey) {
        res = decrypt(res, this.encryptionKey);
      }
      res = deserialize(res);
    }
    return res;
  }

  async hdel(name: string, key: string): Promise<any> {
    await this.db.del(this.getFullKey("h", name, key));
    return 1;
  }

  async zset(name: string, key: string, score: number): Promise<any> {
    await this.db.put(this.getFullKey("z", name, key), serialize(score));
    return 1;
  }

  async zget(name: string, key: string): Promise<any> {
    const res = await this.db.get(this.getFullKey("z", name, key));
    return res !== undefined ? deserialize(res) : undefined;
  }

  async zdel(name: string, key: string): Promise<any> {
    await this.db.del(this.getFullKey("z", name, key));
    return 1;
  }

  async getAllKeys(): Promise<{ key: string; value: any }[]> {
    const list: { key: string; value: any }[] = [];
    for await (const [key, value] of this.db.iterator()) {
      if (!key.startsWith("config:")) {
        let parsedVal = value;
        if (this.encryptionKey) {
          try {
            parsedVal = decrypt(parsedVal, this.encryptionKey);
          } catch (e) {}
        }
        parsedVal = deserialize(parsedVal);
        list.push({ key, value: parsedVal });
      }
    }
    return list;
  }

  async flush(): Promise<void> {
    const batch = this.db.batch();
    for await (const key of this.db.keys()) {
      if (!key.startsWith("config:")) {
        batch.del(key);
      }
    }
    await batch.write();
  }

  async setCredentials(username: string, passwordHash: string): Promise<void> {
    await this.db.put("config:username", username);
    await this.db.put("config:password", passwordHash);
  }

  async getCredentials(): Promise<{ username: string; passwordHash: string }> {
    const defaultHash = crypto.createHash("sha256").update("manoj").digest("hex");
    let username = "manoj";
    let passwordHash = defaultHash;
    try {
      const u = await this.db.get("config:username");
      if (u) username = u;
    } catch (e) {}
    try {
      const p = await this.db.get("config:password");
      if (p) passwordHash = p;
    } catch (e) {}
    return { username, passwordHash };
  }

  async startDashboard(port: number = 8971): Promise<void> {
    if (this.dashboardServer) {
      return;
    }
    this.dashboardServer = await startDashboardServer(this, port, () => this.getCredentials());
  }

  async close(): Promise<void> {
    if (this.dashboardServer) {
      await this.dashboardServer.close();
      this.dashboardServer = undefined;
    }
    await this.db.close();
  }
}

class RemoteSSDiskDBClient implements SSDiskDBClient {
  public remoteUrl: string;
  public apiKey: string;
  public serverId: string;
  private encryptionKey?: string;
  private heartbeatInterval?: NodeJS.Timeout;
  private dashboardServer?: DashboardServer;

  constructor(remoteUrl: string, apiKey: string, serverId: string, encryptionKey?: string) {
    this.remoteUrl = remoteUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.serverId = serverId;
    this.encryptionKey = encryptionKey;
  }

  async handshake(): Promise<void> {
    try {
      const res = await fetch(`${this.remoteUrl}/api/handshake`, {
        method: "GET",
        headers: {
          "X-API-Key": this.apiKey,
          "X-Server-Id": this.serverId
        }
      });
      if (res.status === 403) {
        throw new Error(`Forbidden: Invalid API Key or Server ID ("${this.serverId}")`);
      }
      if (!res.ok) {
        throw new Error(`Handshake failed: Server returned ${res.status}`);
      }
      this.startHeartbeat();
    } catch (err: any) {
      if (err.message.includes("Forbidden") || err.message.includes("Handshake")) {
        throw err;
      }
      throw new Error(`Connection check failed: Central server is unreachable at ${this.remoteUrl} (${err.message})`);
    }
  }

  private startHeartbeat() {
    this.sendHeartbeat().catch(err => {
      console.error(`[SSDiskDB Client] Initial heartbeat failed: ${err.message}`);
    });
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat().catch(err => {
        console.error(`[SSDiskDB Client] Periodic heartbeat failed: ${err.message}`);
      });
    }, 10000);
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      const res = await fetch(`${this.remoteUrl}/api/heartbeat`, {
        method: "POST",
        headers: {
          "X-API-Key": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ serverId: this.serverId })
      });
      if (res.status === 403) {
        console.warn(`[SSDiskDB Client] WARNING: This client server ("${this.serverId}") is not authorized/registered on the central cache server.`);
      } else if (!res.ok) {
        const text = await res.text();
        console.warn(`[SSDiskDB Client] Heartbeat server error: ${text}`);
      }
    } catch (err: any) {
      console.warn(`[SSDiskDB Client] Heartbeat network error: ${err.message}`);
    }
  }

  private async request(action: string, args: any[]): Promise<any> {
    const res = await fetch(`${this.remoteUrl}/api/rpc`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "X-Server-Id": this.serverId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, args })
    });

    if (res.status === 403) {
      throw new Error(`Connection Forbidden: This client server ("${this.serverId}") is not authorized/registered on the central cache server.`);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RPC server error: ${text}`);
    }

    const json = await res.json();
    return json.result;
  }

  async set(key: string, value: any): Promise<any> {
    if (this.encryptionKey) {
      let serialized = serialize(value);
      serialized = encrypt(serialized, this.encryptionKey);
      return this.request("set", [key, serialized]);
    }
    return this.request("set", [key, value]);
  }

  async get(key: string): Promise<any> {
    let res = await this.request("get", [key]);
    if (this.encryptionKey && res !== undefined && res !== null) {
      res = decrypt(res, this.encryptionKey);
      res = deserialize(res);
    }
    return res;
  }

  async del(key: string): Promise<any> {
    return this.request("del", [key]);
  }

  async exists(key: string): Promise<boolean> {
    return this.request("exists", [key]);
  }

  async incr(key: string, num: number = 1): Promise<number> {
    if (this.encryptionKey) {
      const val = await this.get(key);
      const newVal = (Number(val) || 0) + num;
      await this.set(key, newVal);
      return newVal;
    }
    return this.request("incr", [key, num]);
  }

  async hset(name: string, key: string, value: any): Promise<any> {
    if (this.encryptionKey) {
      let serialized = serialize(value);
      serialized = encrypt(serialized, this.encryptionKey);
      return this.request("hset", [name, key, serialized]);
    }
    return this.request("hset", [name, key, value]);
  }

  async hget(name: string, key: string): Promise<any> {
    let res = await this.request("hget", [name, key]);
    if (this.encryptionKey && res !== undefined && res !== null) {
      res = decrypt(res, this.encryptionKey);
      res = deserialize(res);
    }
    return res;
  }

  async hdel(name: string, key: string): Promise<any> {
    return this.request("hdel", [name, key]);
  }

  async zset(name: string, key: string, score: number): Promise<any> {
    return this.request("zset", [name, key, score]);
  }

  async zget(name: string, key: string): Promise<any> {
    return this.request("zget", [name, key]);
  }

  async zdel(name: string, key: string): Promise<any> {
    return this.request("zdel", [name, key]);
  }

  async close(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    if (this.dashboardServer) {
      await this.dashboardServer.close();
      this.dashboardServer = undefined;
    }
  }

  async startDashboard(port: number = 8971): Promise<void> {
    if (this.dashboardServer) {
      return;
    }
    this.dashboardServer = await startDashboardServer(this, port, async () => {
      return { username: "admin", passwordHash: "" };
    });
  }

  async getAllKeys(): Promise<{ key: string; value: any }[]> {
    const list = await this.request("getAllKeys", []);
    return list.map((item: any) => {
      let parsedVal = item.value;
      if (this.encryptionKey && typeof parsedVal === "string") {
        try {
          parsedVal = decrypt(parsedVal, this.encryptionKey);
          parsedVal = deserialize(parsedVal);
        } catch (e) {}
      }
      return { key: item.key, value: parsedVal };
    });
  }

  async flush(): Promise<void> {
    return this.request("flush", []);
  }

  async setCredentials(username: string, passwordHash: string): Promise<void> {
    throw new Error("Method not supported on remote client connection");
  }

  async getCredentials(): Promise<{ username: string; passwordHash: string }> {
    throw new Error("Method not supported on remote client connection");
  }
}

export function parseConnectionString(uri: string): ConnectOptions {
  try {
    const match = uri.match(/^ssdiskdb(\+encry)?:\/\/([^@]+)@([^/]+)\/([^?#]+)(?:\?key=([^#]+))?$/);
    if (!match) {
      throw new Error("Invalid connection URI format");
    }
    const isEncrypted = !!match[1];
    const apiKey = match[2];
    const host = match[3];
    const serverId = match[4];
    const encryptionKey = match[5];
    
    if (isEncrypted && !encryptionKey) {
      throw new Error("Encryption key is required for ssdiskdb+encry:// protocol");
    }

    return {
      remoteUrl: `http://${host}`,
      apiKey,
      serverId,
      encryptionKey: encryptionKey || undefined
    };
  } catch (e: any) {
    throw new Error(`Failed to parse connection URI: ${e.message}`);
  }
}

export async function connect(
  pathOrOptions?: string | ConnectOptions,
  options?: ConnectOptions
): Promise<SSDiskDBClient> {
  let storagePath = "./ssdb-local-db";
  let encryptionKey: string | undefined;
  let startDashboard = false;
  let dashboardPort = 8971;
  let remoteUrl: string | undefined;
  let apiKey: string | undefined;
  let serverId = "Local";

  if (typeof pathOrOptions === "string") {
    if (pathOrOptions.startsWith("ssdiskdb://") || pathOrOptions.startsWith("ssdiskdb+encry://")) {
      const parsed = parseConnectionString(pathOrOptions);
      remoteUrl = parsed.remoteUrl;
      apiKey = parsed.apiKey;
      serverId = parsed.serverId || "Local";
      encryptionKey = parsed.encryptionKey;
    } else {
      storagePath = pathOrOptions;
    }
    if (options) {
      if (options.encryptionKey !== undefined) encryptionKey = options.encryptionKey;
      if (options.startDashboard !== undefined) startDashboard = options.startDashboard;
      if (options.dashboardPort !== undefined) dashboardPort = options.dashboardPort;
      if (options.remoteUrl !== undefined) remoteUrl = options.remoteUrl;
      if (options.apiKey !== undefined) apiKey = options.apiKey;
      if (options.serverId !== undefined) serverId = options.serverId;
    }
  } else if (pathOrOptions && typeof pathOrOptions === "object") {
    let uriParsed: ConnectOptions | undefined;
    if (pathOrOptions.storagePath && (pathOrOptions.storagePath.startsWith("ssdiskdb://") || pathOrOptions.storagePath.startsWith("ssdiskdb+encry://"))) {
      uriParsed = parseConnectionString(pathOrOptions.storagePath);
    }
    
    if (uriParsed) {
      remoteUrl = uriParsed.remoteUrl;
      apiKey = uriParsed.apiKey;
      serverId = uriParsed.serverId || "Local";
      encryptionKey = uriParsed.encryptionKey;
    } else {
      if (pathOrOptions.storagePath) storagePath = pathOrOptions.storagePath;
    }
    if (pathOrOptions.encryptionKey !== undefined) encryptionKey = pathOrOptions.encryptionKey;
    if (pathOrOptions.startDashboard !== undefined) startDashboard = pathOrOptions.startDashboard;
    if (pathOrOptions.dashboardPort !== undefined) dashboardPort = pathOrOptions.dashboardPort;
    if (pathOrOptions.remoteUrl !== undefined) remoteUrl = pathOrOptions.remoteUrl;
    if (pathOrOptions.apiKey !== undefined) apiKey = pathOrOptions.apiKey;
    if (pathOrOptions.serverId !== undefined) serverId = pathOrOptions.serverId;
  }

  if (remoteUrl) {
    if (!apiKey) {
      throw new Error("apiKey is required for remote connections");
    }
    const client = new RemoteSSDiskDBClient(remoteUrl, apiKey, serverId, encryptionKey);
    await client.handshake();
    if (startDashboard) {
      await client.startDashboard(dashboardPort);
    }
    return client;
  }

  const levelDb = new Level(storagePath);
  await levelDb.open();
  const client = new LocalSSDBClient(levelDb, encryptionKey);
  if (startDashboard) {
    await client.startDashboard(dashboardPort);
  }
  return client;
}

export default {
  connect
};