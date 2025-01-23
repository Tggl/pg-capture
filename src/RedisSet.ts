import {IdsSet} from './types';
import type {Redis} from 'ioredis';

export class RedisSet implements IdsSet {
  private _batchSize: number;
  private _client: Pick<Redis, 'sadd' | 'srem' | 'smembers'>;
  private _key: string;

  constructor({
    batchSize = 1000,
    client,
    key,
  }: {
    batchSize?: number;
    client: Pick<Redis, 'sadd' | 'srem' | 'smembers'>;
    key: string;
  }) {
    this._batchSize = batchSize;
    this._client = client;
    this._key = key;
  }

  async add(ids: unknown[]) {
    await this._client.sadd(this._key, ...(ids as string[]));
  }

  async delete(ids: unknown[]) {
    await this._client.srem(this._key, ...(ids as string[]));
  }

  async *getAll() {
    const values = await this._client.smembers(this._key);

    for (let i = 0; i < values.length; i += this._batchSize) {
      yield values.slice(i, i + this._batchSize);
    }
  }
}
