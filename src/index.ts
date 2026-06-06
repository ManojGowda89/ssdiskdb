import ssdb from "ssdb";
import { promisify } from "util";
import crypto from "crypto";

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
}

export interface ConnectOptions {
  host?: string;
  encryptionKey?: string;
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

export async function connect(
  hostOrOptions?: string | ConnectOptions,
  options?: ConnectOptions
): Promise<SSDiskDBClient> {
  let hostName = "127.0.0.1";
  let port = 8888;
  let encryptionKey: string | undefined;

  let hostStr: string | undefined;

  if (typeof hostOrOptions === "string") {
    hostStr = hostOrOptions;
    if (options && options.encryptionKey) {
      encryptionKey = options.encryptionKey;
    }
  } else if (hostOrOptions && typeof hostOrOptions === "object") {
    hostStr = hostOrOptions.host;
    encryptionKey = hostOrOptions.encryptionKey;
  }

  if (hostStr) {
    const parts = hostStr.split(":");
    hostName = parts[0] || "127.0.0.1";
    if (parts[1]) {
      port = parseInt(parts[1], 10);
    }
  }

  const pool = ssdb.createPool({
    host: hostName,
    port: port
  });

  const client = pool.acquire();

  const rawSet = promisify(client.set.bind(client)) as (key: string, value: any) => Promise<any>;
  const rawGet = promisify(client.get.bind(client)) as (key: string) => Promise<any>;
  const rawHset = promisify(client.hset.bind(client)) as (name: string, key: string, value: any) => Promise<any>;
  const rawHget = promisify(client.hget.bind(client)) as (name: string, key: string) => Promise<any>;

  return {
    set: async (key: string, value: any): Promise<any> => {
      let serialized = serialize(value);
      if (encryptionKey) {
        serialized = encrypt(serialized, encryptionKey);
      }
      return rawSet(key, serialized);
    },
    get: async (key: string): Promise<any> => {
      let res = await rawGet(key);
      if (res !== undefined && res !== null) {
        if (encryptionKey) {
          res = decrypt(res, encryptionKey);
        }
        res = deserialize(res);
      }
      return res;
    },
    del: promisify(client.del.bind(client)),
    exists: promisify(client.exists.bind(client)),
    incr: promisify(client.incr.bind(client)),

    hset: async (name: string, key: string, value: any): Promise<any> => {
      let serialized = serialize(value);
      if (encryptionKey) {
        serialized = encrypt(serialized, encryptionKey);
      }
      return rawHset(name, key, serialized);
    },
    hget: async (name: string, key: string): Promise<any> => {
      let res = await rawHget(name, key);
      if (res !== undefined && res !== null) {
        if (encryptionKey) {
          res = decrypt(res, encryptionKey);
        }
        res = deserialize(res);
      }
      return res;
    },
    hdel: promisify(client.hdel.bind(client)),

    zset: promisify(client.zset.bind(client)),
    zget: promisify(client.zget.bind(client)),
    zdel: promisify(client.zdel.bind(client)),

    close: async () => {
      if (client.close) {
        client.close();
      }

      if (pool.destroy) {
        pool.destroy();
      }
    }
  };
}

export default {
  connect
};
