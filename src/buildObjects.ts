import {RootSchema, Schema} from './types';
import {TableAliasCache} from './TableAliasCache';
import {QueryBuilder} from './QueryBuilder';

const postgresJsonBuildObject = (entries: {key: string; value: string}[]) => {
  return `JSON_BUILD_OBJECT(${entries
    .map(({key, value}) => `'${key}', ${value}`)
    .join(', ')})`;
};

const buildQuery = ({
  tableAliasCache = new TableAliasCache(),
  table,
  ids,
  identifierColumn,
  group = false,
  schema,
}: {
  tableAliasCache?: TableAliasCache;
  table: string;
  ids?: string[];
  identifierColumn: string;
  group?: boolean;
  schema: Schema;
}): QueryBuilder<{id: string; record: unknown}> => {
  const tableAlias = tableAliasCache.getAlias(table);

  const query = new QueryBuilder<{id: string; record: unknown}>()
    .from(`"${table}" AS "${tableAlias}"`)
    .select(`"${tableAlias}"."${identifierColumn}" AS "${identifierColumn}"`);

  const getDefinition = (schema: Schema): string => {
    if (schema.type === 'column') {
      return `"${tableAlias}"."${schema.column}"`;
    }

    if (schema.type === 'many-to-one') {
      if (
        schema.schema.type === 'one-to-many' &&
        schema.schema.column === schema.referencesColumn
      ) {
        const subQueryId = query.subQuery(
          buildQuery({
            tableAliasCache: tableAliasCache,
            table: schema.schema.referencingTable,
            identifierColumn: schema.schema.referencingColumn,
            schema: schema.schema.schema,
            group: true,
          }),
        );
        const alias = tableAliasCache.getAlias(schema.schema.referencingTable);
        query.leftJoin(
          `(${subQueryId}) AS "${alias}"`,
          `"${tableAlias}"."${schema.column}"`,
          `"${alias}"."${schema.schema.referencingColumn}"`,
        );

        return `COALESCE("${alias}"."object", '[]'::json)`;
      } else {
        const subQueryId = query.subQuery(
          buildQuery({
            tableAliasCache: tableAliasCache,
            table: schema.referencesTable,
            identifierColumn: schema.referencesColumn,
            schema: schema.schema,
          }),
        );
        const alias = tableAliasCache.getAlias(schema.referencesTable);
        query.leftJoin(
          `(${subQueryId}) AS "${alias}"`,
          `"${tableAlias}"."${schema.column}"`,
          `"${alias}"."${schema.referencesColumn}"`,
        );

        return `"${alias}"."object"`;
      }
    }

    if (schema.type === 'one-to-many') {
      const subQueryId = query.subQuery(
        buildQuery({
          tableAliasCache: tableAliasCache,
          table: schema.referencingTable,
          schema: schema.schema,
          group: true,
          identifierColumn: schema.referencingColumn,
        }),
      );

      const alias = tableAliasCache.getAlias(schema.referencingTable);
      query.leftJoin(
        `(${subQueryId}) AS "${alias}"`,
        `"${tableAlias}"."${schema.column}"`,
        `"${alias}"."${schema.referencingColumn}"`,
      );

      return `COALESCE("${alias}"."object", '[]'::json)`;
    }

    if (schema.type === 'object') {
      return postgresJsonBuildObject(
        Object.entries(schema.properties).map(([key, value]) => ({
          key,
          value: getDefinition(value),
        })),
      );
    }

    throw new Error('Unknown schema type');
  };

  const select = getDefinition(schema);
  query.select((group ? `JSON_AGG(${select})` : select) + ' AS "object"');

  if (group) {
    query.groupBy(`"${tableAlias}"."${identifierColumn}"`);
  }

  if (ids) {
    query.whereIn(`"${tableAlias}"."${identifierColumn}"`, ids);
  }

  return query;
};

/**
 * Given a schema and a list of ids, build a query that returns the objects.
 */
export const buildObjects = (
  schema: RootSchema,
  ids: string[],
): QueryBuilder<{id: string; record: unknown}> => {
  return buildQuery({
    table: schema.table,
    identifierColumn: schema.primaryKey,
    ids,
    schema: schema.schema,
  });
};
