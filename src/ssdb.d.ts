declare module "ssdb" {
  export interface Conn {
    set(key: string, value: any, callback?: (err: any, data: any) => void): void;
    get(key: string, callback?: (err: any, data: any) => void): void;
    del(key: string, callback?: (err: any, data: any) => void): void;
    exists(key: string, callback?: (err: any, data: any) => void): void;
    incr(key: string, num?: number, callback?: (err: any, data: any) => void): void;

    hset(name: string, key: string, value: any, callback?: (err: any, data: any) => void): void;
    hget(name: string, key: string, callback?: (err: any, data: any) => void): void;
    hdel(name: string, key: string, callback?: (err: any, data: any) => void): void;

    zset(name: string, key: string, score: number, callback?: (err: any, data: any) => void): void;
    zget(name: string, key: string, callback?: (err: any, data: any) => void): void;
    zdel(name: string, key: string, callback?: (err: any, data: any) => void): void;

    close(): void;
  }

  export interface Pool {
    acquire(): Conn;
    destroy(): void;
    close?: () => void;
  }

  export interface PoolOptions {
    host?: string;
    port?: number;
    size?: number;
    promisify?: boolean;
    timeout?: number;
  }

  export function createPool(options?: PoolOptions): Pool;

  const ssdb: {
    createPool(options?: PoolOptions): Pool;
  };

  export default ssdb;
}
