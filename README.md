# pg-capture

A modular CDC (Change Data Capture) utility for PostgreSQL. Works on top of the logical replication feature to generate high level events from a schema.

`pg-capture` is like having WAL (Write Ahead Log) events on an SQL view.

- Aggregate low level events on tables (insert, update, and delete) into high level events on schemas (object upsert or delete)
- Use PG as your single source of truth
- Keep PG in sync with other storages such as Elasticsearch, Redis, etc...
- Subscribe to schema changes in real-time

## Usage
Start by defining a schema:
```typescript
import { RootSchema } from 'pg-capture';

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

Here the schema describes an object that looks like this:
```json
{
  "id": "foo",
  "title": "Harry Potter",
  "author": "J.K. Rowling"
}
```

This object will change if the table `book` or `author` changes. This library allows you to turn low level events on tables (ie. insert, update, and delete) into high level events on schemas (ie. object upsert or delete).

To aggregate low level events create an aggregator:

```typescript
import { EventAggregator, Changes } from 'pg-capture';
import { Client } from 'pg';

const client = new Client(/*...*/)

const onChange = (changes: Changes) => {
  console.log(changes.upsert); // An array of { id, object } that were upserted
  console.log(changes.delete); // An array of root ids that were deleted
}

const aggregator = new EventAggregator({
  schema,
  client,
  onChange
})
```

you can now use any tool to catch PG replication events (eg. [pg-logical-replication](https://www.npmjs.com/package/pg-logical-replication)) and forward the event to the `handleEvent` method:

```typescript
await aggregator.handleEvent({
  action: 'INSERT',
    table: 'book',
    data: {
      id: 'foo',
      title: 'Harry Potter',
      authorId: 'bar',
  },
  dataOld: undefined,
})
```

This will result on the `onChange` callback being called with the following changes object:
```json
{
  "upsert": [
    {
      "id": "foo",
      "object": {
        "id": "foo",
        "title": "Harry Potter",
        "author": "J.K. Rowling"
      }
    }
  ],
  "delete": []
}
```

## How to
### Forward events to a queue
It is up to you to forward high level events into a queue. Here is an example using RabbitMQ:
```typescript
const aggregator = new EventAggregator({
  schema,
  client,
  onChange: (changes) => {
    channel.sendToQueue('my-queue', Buffer.from(JSON.stringify(changes)));
  }
})
```

### Aggregate events
To avoid re-building an object too many times when multiple tables are updated simultaneously, and to leverage batching, you can throttle events:

```typescript
const aggregator = new EventAggregator({
  schema,
  client,
  scheduleBuildObjects: (build) => {
    setTimeout(() => {
      build();
    }, 100);
  }
})
```

This will aggregate all events that happen within 100ms into a single call to the `onChange` callback.

## Under the hood

To know if a schema is impacted by an event, the aggregator calls the `getRootIdsFromEvent` function:

```typescript
import { getRootIdsFromEvent } from 'pg-captur';

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

`ids` is an array of root ids that we know were affected by the event without doing any database call. In our example, here `ids` would be `['foo']` since we know that it was just inserted.

`query` is a query that can be run to get the full list of root ids that were affected by the event but could not be deduced immediately. In our example, `query` would be null.

Let's have a look at an event on the `author` table:

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

Here `ids` would be an empty array because we cannot know which objects were affected by the update directly. And the `query` would be:

```sql
SELECT "book_1"."id" as "id" 
FROM "book" as "book_1"  
WHERE "book_1"."authorId" = $1 
GROUP BY "book_1"."id"
```

Running this query would give you a list of root ids (here ids of books) that were affected by the update. You can concatenate this list with the `ids` array to get the full list of root ids that were affected by the event.

From the list of ids, the aggregator can build the objects by calling the `buildSchemaQuery` function: 

```typescript
import { buildSchemaQuery } from 'pg-capture';

const query = buildSchemaQuery(schema, ['foo']);

const { text, values } = result.toQuery();
```

In this example the bindings (ie. `values`) would be `['foo']` and the query (ie. `text`) will be:

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

If the query returns a result for a given id, then the object was upserted. If the query returns no result, then the object was deleted.
