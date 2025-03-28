import {QueryBuilder} from './QueryBuilder';

export type ColumnSchema = {
  type: 'column';
  column: string;
};

export type ObjectSchema = {
  type: 'object';
  properties: Record<string, Schema>;
};

export type ManyToOneSchema = {
  type: 'many-to-one';
  column: string;
  referencesTable: string;
  referencesColumn: string;
  hasFKConstraint: boolean;
  schema: Schema;
};

export type OneToManySchema = {
  type: 'one-to-many';
  column: string;
  referencingTable: string;
  referencingColumn: string;
  schema: Schema;
};

export type Schema =
  | ColumnSchema
  | ObjectSchema
  | ManyToOneSchema
  | OneToManySchema;

export type RootSchema = {
  table: string;
  primaryKey: string;
  schema: Schema;
};

export type WALEvent =
  | {
      table: string;
      action: 'INSERT';
      data: Record<string, unknown>;
      dataOld: undefined;
    }
  | {
      table: string;
      action: 'UPDATE';
      data: Record<string, unknown>;
      dataOld: Record<string, unknown>;
    }
  | {
      table: string;
      action: 'DELETE';
      data: undefined;
      dataOld: Record<string, unknown>;
    };

export type RootIdsResult = {
  ids: unknown[];
  query: QueryBuilder<{id: unknown}> | null;
};

export type Changes = {
  upsert: {id: unknown; object: unknown}[];
  delete: unknown[];
};

export type Client = {
  query: (query: string, bindings?: unknown[]) => Promise<{rows: unknown[]}>;
};

export interface IdsSet {
  add(ids: unknown[]): void | Promise<void>;
  delete(ids: unknown[]): void | Promise<void>;
  getAll(): AsyncGenerator<unknown[]> | Generator<unknown[]>;
}

export type ColumnOutput = {
  type: 'column';
  table: string;
  column: string;
};

export type ObjectOutput = {
  type: 'object';
  properties: Record<string, SchemaOutput>;
};

export type ArrayOutput = {
  type: 'array';
  items: ColumnOutput | ObjectOutput;
};

export type SchemaOutput = ColumnOutput | ObjectOutput | ArrayOutput;

export type IntrospectionResult = {
  tables: {
    table: string;
    columns: string[];
  }[];
  output: SchemaOutput;
};
