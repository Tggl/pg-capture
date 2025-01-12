import type {QueryConfig} from 'pg';
import {randomBytes} from 'crypto';

export class QueryBuilder<T = unknown> {
  private _select: string[] = [];
  private _from: string | null = null;
  private _leftJoin: string[] = [];
  private _where: string[] = [];
  private _groupBy: string[] = [];
  private _union: string[] = [];
  private _bindings: Record<string, unknown> = {};
  private _subQueries: Record<string, QueryBuilder> = {};

  from(from: string): this {
    this._from = from;
    return this;
  }

  select(...select: string[]): this {
    this._select.push(...select);
    return this;
  }

  groupBy(...groupBy: string[]): this {
    this._groupBy.push(...groupBy);
    return this;
  }

  leftJoin(table: string, column1: string, column2: string): this {
    this._leftJoin.push(`LEFT JOIN ${table} ON ${column1} = ${column2}`);
    return this;
  }

  whereIn(column: string, values: unknown[]): this {
    const filteredValues = [...new Set(values)]
      .filter(value => typeof value === 'string')
      .map(value => {
        const id = randomBytes(16).toString('base64');

        this._bindings[id] = value;

        return id;
      });

    if (filteredValues.length === 1) {
      this._where.push(`${column} = ${filteredValues[0]}`);
      return this;
    }

    this._where.push(`${column} IN (${filteredValues.join(', ')})`);
    return this;
  }

  subQuery(query: QueryBuilder): string {
    const id = randomBytes(16).toString('base64');

    this._subQueries[id] = query;
    return id;
  }

  union(...queries: QueryBuilder<T>[]): this {
    this._union.push(...queries.map(query => this.subQuery(query)));
    return this;
  }

  protected compile() {
    const bindings: Record<string, unknown> = {...this._bindings};
    let sql =
      'SELECT ' +
      this._select.join(', ') +
      ' FROM ' +
      this._from +
      ' ' +
      this._leftJoin.join(' ');

    if (this._where.length > 0) {
      sql += ' WHERE ' + this._where.join(' AND ');
    }

    if (this._groupBy.length > 0) {
      sql += ' GROUP BY ' + this._groupBy.join(', ');
    }

    for (const id of this._union) {
      sql += ' UNION ' + id;
    }

    for (const [id, subQuery] of Object.entries(this._subQueries)) {
      const compiled = subQuery.compile();
      Object.assign(bindings, compiled.bindings);
      sql = sql.replaceAll(id, compiled.sql);
    }

    return {
      sql,
      bindings,
    };
  }

  toString(): string {
    const {sql, bindings} = this.compile();
    let result = sql;

    for (const [identifier, value] of Object.entries(bindings)) {
      result = result.replaceAll(
        identifier,
        typeof value === 'number' ? String(value) : `'${value}'`,
      );
    }

    return result;
  }

  toQuery(): QueryConfig {
    const {sql, bindings} = this.compile();

    const result: QueryConfig = {
      text: sql,
      values: [],
    };

    let index = 1;

    for (const [identifier, value] of Object.entries(bindings)) {
      result.text = result.text.replaceAll(identifier, `$${index++}`);
      result.values?.push(value);
    }

    return result;
  }
}
