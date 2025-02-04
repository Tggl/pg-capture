import {IntrospectionResult, RootSchema, Schema, SchemaOutput} from './types';

const schemaOutput = (schema: Schema, table: string): IntrospectionResult => {
  if (schema.type === 'column') {
    return {
      tables: [{table, columns: [schema.column]}],
      output: {
        type: 'column',
        table,
        column: schema.column,
      },
    };
  }

  if (schema.type === 'object') {
    const entries = Object.entries(schema.properties).map(([key, schema]) => ({
      key,
      output: schemaOutput(schema, table),
    }));

    return {
      tables: entries.flatMap(({output}) => output.tables),
      output: {
        type: 'object',
        properties: Object.fromEntries(
          entries.map(({output, key}) => [key, output.output] as const),
        ),
      },
    };
  }

  if (schema.type === 'many-to-one') {
    const output = schemaOutput(schema.schema, schema.referencesTable);

    return {
      tables: [
        ...output.tables,
        {table, columns: [schema.column]},
        {table: schema.referencesTable, columns: [schema.referencesColumn]},
      ],
      output: output.output,
    };
  }

  if (schema.type === 'one-to-many') {
    const items = schemaOutput(schema.schema, schema.referencingTable);

    return {
      tables: [
        ...items.tables,
        {table, columns: [schema.column]},
        {table: schema.referencingTable, columns: [schema.referencingColumn]},
      ],
      output: {
        type: 'array',
        items:
          items.output.type === 'array' ? items.output.items : items.output,
      },
    };
  }

  throw new Error('Unknown schema type');
};

export const introspection = (schema: RootSchema): IntrospectionResult => {
  const tables: Record<string, Set<string>> = {
    [schema.table]: new Set([schema.primaryKey]),
  };

  const output = schemaOutput(schema.schema, schema.table);

  for (const {table, columns} of output.tables) {
    if (!tables[table]) {
      tables[table] = new Set();
    }

    for (const column of columns) {
      tables[table].add(column);
    }
  }

  return {
    tables: Object.entries(tables).map(([table, columns]) => ({
      table,
      columns: [...columns],
    })),
    output: output.output,
  };
};
