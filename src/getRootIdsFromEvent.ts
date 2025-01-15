import {RootIdsResult, RootSchema, Schema, WALEvent} from './types';
import {TableAliasCache} from './TableAliasCache';
import {QueryBuilder} from './QueryBuilder';

/**
 * Given a schema, returns the list of columns that are used in the schema for that particular table.
 */
const getSchemaColumns = (schema: Schema): string[] => {
  if (
    schema.type === 'column' ||
    schema.type === 'many-to-one' ||
    schema.type === 'one-to-many'
  ) {
    return [schema.column];
  }

  if (schema.type === 'object') {
    return Object.values(schema.properties).flatMap(getSchemaColumns);
  }

  throw new Error('Unknown schema type');
};

const overlaps = (a: string[], b: string[]) => {
  return a.some(value => b.includes(value));
};

export const getRootIdsFromEvent = (
  rootSchema: RootSchema,
  event: WALEvent,
): RootIdsResult => {
  const ids: unknown[] = [];
  const queries: QueryBuilder<{id: unknown}>[] = [];
  const updatedColumns =
    event.action === 'UPDATE'
      ? Object.keys(event.data).filter(
          key =>
            JSON.stringify(event.data[key]) !==
            JSON.stringify(event.dataOld[key]),
        )
      : [];

  // If the event impacts the root table, we know which ids to index directly
  // For INSERT and DELETE, we know we must index the id for sure
  // For UPDATE, we must index the id only if the updated columns are in the schema
  if (
    event.table === rootSchema.table &&
    (event.action === 'INSERT' ||
      event.action === 'DELETE' ||
      (event.action === 'UPDATE' &&
        overlaps(
          [rootSchema.primaryKey, ...getSchemaColumns(rootSchema.schema)],
          updatedColumns,
        )))
  ) {
    ids.push(
      event.data?.[rootSchema.primaryKey],
      event.dataOld?.[rootSchema.primaryKey],
    );
  }

  const tableAliasCache = new TableAliasCache();

  // This function is used to recursively walk down the graph and find the dependencies of the event
  // Once a node impacted by the event is found, the onFind function is called to build the query up to the root node, one layer at a time
  const findDependencies = ({
    schema,
    table,
    onFind,
    depth = 0,
    parent,
  }: {
    schema: Schema;
    table: string;
    onFind: (options: {
      query: QueryBuilder<{id: unknown}>;
      tableAlias: string;
      overrideColumn?: string;
      leafOneToMany?: {column: string; ids: unknown[]};
    }) => void;
    depth?: number;
    parent?: Schema;
  }) => {
    if (schema.type === 'many-to-one') {
      // Before walking down the graph, we need to check if the event impacts the current node
      if (
        schema.referencesTable === event.table &&
        ((event.action === 'INSERT' && !schema.hasFKConstraint) ||
          (event.action === 'DELETE' && !schema.hasFKConstraint) ||
          (event.action === 'UPDATE' &&
            overlaps(updatedColumns, [
              schema.hasFKConstraint ? '' : schema.referencesColumn,
              ...getSchemaColumns(schema.schema),
            ])))
      ) {
        if (depth === 0 && schema.column === rootSchema.primaryKey) {
          ids.push(
            event.data?.[schema.referencesColumn],
            event.dataOld?.[schema.referencesColumn],
          );
        } else {
          const tableAlias = tableAliasCache.getAlias(table);

          onFind({
            query: new QueryBuilder<{id: unknown}>()
              .from(`"${table}" as "${tableAlias}"`)
              .whereIn(`"${tableAlias}"."${schema.column}"`, [
                event.data?.[schema.referencesColumn],
                event.dataOld?.[schema.referencesColumn],
              ]),
            tableAlias,
          });
        }
      }

      // Now we can walk down the graph
      findDependencies({
        schema: schema.schema,
        table: schema.referencesTable,
        onFind: ({query, tableAlias, overrideColumn, leafOneToMany}) => {
          const tAlias = tableAliasCache.getAlias(table);

          if (
            leafOneToMany &&
            leafOneToMany.column === schema.referencesColumn
          ) {
            onFind({
              query: new QueryBuilder<{id: unknown}>()
                .from(`"${table}" as "${tAlias}"`)
                .whereIn(`"${tAlias}"."${schema.column}"`, leafOneToMany.ids),
              tableAlias: tAlias,
            });
            return;
          }

          query.innerJoin(
            `"${table}" as "${tAlias}"`,
            `"${tAlias}"."${schema.column}"`,
            `"${tableAlias}"."${overrideColumn ?? schema.referencesColumn}"`,
          );
          onFind({query, tableAlias: tAlias});
        },
        depth: depth + 1,
        parent: schema,
      });
    }

    if (schema.type === 'one-to-many') {
      // Before walking down the graph, we need to check if the event impacts the current node
      if (
        schema.referencingTable === event.table &&
        (event.action === 'INSERT' ||
          event.action === 'DELETE' ||
          (event.action === 'UPDATE' &&
            overlaps(updatedColumns, [
              schema.referencingColumn,
              ...getSchemaColumns(schema.schema),
            ])))
      ) {
        // This is an optimization to avoid unnecessary queries such as:
        // SELECT id FROM table WHERE id IN (id1, id2)
        if (depth === 0 && schema.column === rootSchema.primaryKey) {
          ids.push(
            event.data?.[schema.referencingColumn],
            event.dataOld?.[schema.referencingColumn],
          );
        } else {
          const tableAlias = tableAliasCache.getAlias(table);

          onFind({
            query: new QueryBuilder<{id: unknown}>()
              .from(`"${table}" as "${tableAlias}"`)
              .whereIn(`"${tableAlias}"."${schema.column}"`, [
                event.data?.[schema.referencingColumn],
                event.dataOld?.[schema.referencingColumn],
              ]),
            tableAlias,
            leafOneToMany: {
              column: schema.column,
              ids: [
                event.data?.[schema.referencingColumn],
                event.dataOld?.[schema.referencingColumn],
              ],
            },
          });
        }
      }

      // Now we can walk down the graph
      findDependencies({
        schema: schema.schema,
        table: schema.referencingTable,
        onFind: ({query, tableAlias, overrideColumn}) => {
          if (depth === 0 && schema.column === rootSchema.primaryKey) {
            query
              .select(
                `"${tableAlias}"."${overrideColumn ?? schema.referencingColumn}" as "id"`,
              )
              .groupBy(
                `"${tableAlias}"."${overrideColumn ?? schema.referencingColumn}"`,
              );
            queries.push(query);
            return;
          }

          if (
            parent?.type === 'many-to-one' &&
            parent.referencesColumn === schema.column
          ) {
            onFind({
              query,
              tableAlias,
              overrideColumn: schema.referencingColumn,
            });
            return;
          }

          const tAlias = tableAliasCache.getAlias(table);

          query.innerJoin(
            `"${table}" as "${tAlias}"`,
            `"${tAlias}"."${schema.column}"`,
            `"${tableAlias}"."${overrideColumn ?? schema.referencingColumn}"`,
          );
          onFind({query, tableAlias: tAlias});
        },
        depth: depth + 1,
        parent: schema,
      });
    }

    if (schema.type === 'object') {
      // If the schema is an object, we need to walk down the graph for each individual key
      for (const subSchema of Object.values(schema.properties)) {
        findDependencies({schema: subSchema, table, onFind, depth, parent});
      }
    }
  };

  // Start the search from the root table
  findDependencies({
    schema: rootSchema.schema,
    table: rootSchema.table,
    onFind: ({query, tableAlias}) => {
      query
        .select(`"${tableAlias}"."${rootSchema.primaryKey}" as "id"`)
        .groupBy(`"${tableAlias}"."${rootSchema.primaryKey}"`);
      queries.push(query);
    },
  });

  return {
    ids: [
      ...new Set(ids.filter(id => typeof id === 'string' && id) as string[]),
    ],
    query: queries.length >= 1 ? queries[0].union(...queries.slice(1)) : null,
  };
};
