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

export type Dependencies = {
  ids: string[];
  query: QueryBuilder<{id: string}> | null;
};
