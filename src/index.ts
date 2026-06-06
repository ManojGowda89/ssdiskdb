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
    let serialized = serialize(value);
    if (this.encryptionKey) {
      serialized = encrypt(serialized, this.encryptionKey);
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
    let serialized = serialize(value);
    if (this.encryptionKey) {
      serialized = encrypt(serialized, this.encryptionKey);
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
    const defaultHash = crypto.createHash("sha256").update("admin").digest("hex");
    let username = "admin";
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

export async function connect(
  pathOrOptions?: string | ConnectOptions,
  options?: ConnectOptions
): Promise<SSDiskDBClient> {
  let storagePath = "./ssdb-local-db";
  let encryptionKey: string | undefined;
  let startDashboard = false;
  let dashboardPort = 8971;

  if (typeof pathOrOptions === "string") {
    storagePath = pathOrOptions;
    if (options) {
      if (options.encryptionKey) encryptionKey = options.encryptionKey;
      if (options.startDashboard) startDashboard = options.startDashboard;
      if (options.dashboardPort) dashboardPort = options.dashboardPort;
    }
  } else if (pathOrOptions && typeof pathOrOptions === "object") {
    if (pathOrOptions.storagePath) storagePath = pathOrOptions.storagePath;
    if (pathOrOptions.encryptionKey) encryptionKey = pathOrOptions.encryptionKey;
    if (pathOrOptions.startDashboard) startDashboard = pathOrOptions.startDashboard;
    if (pathOrOptions.dashboardPort) dashboardPort = pathOrOptions.dashboardPort;
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