import {IdsSet} from './types';

export class InMemorySet implements IdsSet {
  private _batchSize: number;
  private _data = new Set<unknown>();

  constructor({batchSize = 1000}: {batchSize?: number} = {}) {
    this._batchSize = batchSize;
  }

  add(ids: unknown[]) {
    for (const id of ids) {
      this._data.add(id);
    }
  }

  delete(ids: unknown[]) {
    for (const id of ids) {
      this._data.delete(id);
    }
  }

  *getAll() {
    const values = [...this._data.values()];

    for (let i = 0; i < values.length; i += this._batchSize) {
      yield values.slice(i, i + this._batchSize);
    }
  }
}
