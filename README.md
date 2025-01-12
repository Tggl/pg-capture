# pg-capture

A modular CDC (Change Data Capture) utility for PostgreSQL. Works on top of the logical replication feature to generate high level events from a schema.

`pg-capture` is like having WAL (Write Ahead Log) events on an SQL view.

- Aggregate table-level events into schema level events
- Use PG as your single source of truth
- Keep PG in sync with other storages such as Elasticsearch, Redis, etc...
- Subscribe to schema changes in real-time
- Never miss a beat

## Usage
Start by defining a schema:
```typescript
import { RootSchema } from 'pg-capture/build/types';

const schema: RootSchema = {
  table: 'book',
  primaryKey: 'id',
  schema: {
    type: 'object',
    properties: {
      id: {
        type: 'column',
        column: 'id',
      },
      title: {
        type: 'column',
        column: 'title',
      },
      author: {
        type: 'many-to-one',
        column: 'authorId',
        referencesTable: 'author',
        referencesColumn: 'id',
        hasFKConstraint: true,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
  },
};
```

To build an object for a given set of ids, simply call the `buildSchemaQuery` function:

```typescript
import { buildSchemaQuery } from 'pg-capture/build/buildSchemaQuery';

const query = buildSchemaQuery(schema, ['foo']);

const { text, values } = result.toQuery();
```

You can now run the query against your database to get the value of the object. In this case the bindings (ie. `values`) would be `['foo']` and the query (ie. `text`) will be:

```sql
SELECT 
  "book_1"."id" AS "id", 
  JSON_BUILD_OBJECT(
    'id', "book_1"."id", 
    'title', "book_1"."title", 
    'author', "author_2"."object"
  ) AS "object" 
FROM "book" AS "book_1" 
LEFT JOIN (
  SELECT 
    "author_1"."id" AS "id", 
    "author_1"."name" AS "object" 
  FROM "author" AS "author_1"
) AS "author_2" ON "book_1"."authorId" = "author_2"."id" 
WHERE "book_1"."id" = $1
```

To know when the object was updated (and therefore when to re-run the query above), you can use any tool to catch PG replication events (eg. [pg-logical-replication](https://www.npmjs.com/package/pg-logical-replication)) and forward the event to the `getRootIdsFromEvent` function:

```typescript
import { getRootIdsFromEvent } from "pg-capture/build/getRootIdsFromEvent";

const { ids, query } = getRootIdsFromEvent(schema, {
  action: 'INSERT',
  table: 'book',
  data: {
    id: 'foo',
    title: 'Harry Potter',
  },
  dataOld: undefined,
});
```

Here `ids` would be `['foo']`, indicating that we should build the schema for the object with id `foo` (since it was just inserted) and `query` would be null. 

Here is another example with an event on the `author` table:

```typescript
const { ids, query } = getRootIdsFromEvent(schema, {
  action: 'UPDATE',
  table: 'author',
  data: {
    id: 'bar',
    name: 'Alice',
  },
  dataOld: {
    id: 'bar',
    name: 'Bob',
  },
});

const { text, values } = query.toQuery();
```

Here `ids` would be an empty array because we do not know which objects were affected by the update. The `query` would be an object with bindings `['foo']` and the query:

```sql
SELECT "book_1"."id" as "id" 
FROM "book" as "book_1"  
WHERE "book_1"."authorId" = $1 
GROUP BY "book_1"."id"
```

Running this query would give you a list of root ids (here ids of books) that were affected by the update. You can concatenate this list with the `ids` array to get the full list of root ids that were affected by the event:
  
```typescript
const { ids, query } = getRootIdsFromEvent(schema, event);

if (query) {
  const { text, values } = query.toQuery();
  const result = await client.query(text, values);
  ids.push(...result.rows.map((row) => row.id));
}

const schemaQuery = buildSchemaQuery(schema, ids);
const result = await client.query(text, values);

for (const id of ids) {
  const object = result.rows.find((row) => row.id === id);
  
  if (!object) {
    // Object was deleted
  } else {
    // Object was created / updated
  }
}
```
