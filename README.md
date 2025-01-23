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

// A read-only PG client
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

Note that no matter which table is updated (in our case, either `book` or `author`), the `onChange` callback will always be called with the same `Changes` object that matches the schema.

## Process
Here are all the steps that happen when an event is handled by the aggregator:

### 1. `handleEvent` is called with a low level event
It is you job to call the `handleEvent` method with all the low level events that happen on your tables. The goal of this method is to understand if the event might impact the schema by traversing the tree and comparing the event with each node.

```typescript
await aggregator.handleEvent({
  action: 'UPDATE',
  table: 'author',
  data: {
    id: 'foo',
    name: 'Alice',
  },
  dataOld: {
    id: 'foo',
    name: 'Bob',
  },
})
```

### 2. The list of root ids is fetched
The `handleEvent` method tries to determine if the event might impact the schema, if it does, it tries to find the id of the root table. 

Here if we update a book it will simply use the id of said book, and if we update an author it will use the id of the author to find the books that are impacted by the update.

Under the hood, it uses the `getRootIdsFromEvent` function. For an event on the book table we would have:

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

console.log(ids); // ['foo']
console.log(query); // null
```

For an event on the authors table we would have:

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

console.log(ids); // []
console.log(query); // QueryBuilder
```

With `query` that would be:

```sql
SELECT "book_1"."id" as "id" 
FROM "book" as "book_1"  
WHERE "book_1"."authorId" = $1 
GROUP BY "book_1"."id"
```

The `handleEvent` method runs this query to fetch the list of root ids (here ids of books) that were affected by the update. It then concatenates this list with the `ids` array to get the full list of root ids that were affected by the event.

### 3. The ids are aggregated in a store
The `handleEvent` method then adds those root ids to a set. By default, this set is in memory, but you can use Redis, or implement your own store. This step allows you to aggregate multiple low level events that may impact the same root object into a single high level event.

```typescript
import { RedisSet } from 'pg-capture';
import { Redis } from 'ioredis';

const redis = new Redis();

const aggregator = new EventAggregator({
  schema,
  client,
  idsSet: new RedisSet({ 
    client: redis,
    key: 'my-redis-key'
  }),
})
```

Alternatively you can implement your own `IdsSet` class:

```typescript
import type { IdsSet } from 'pg-capture';

export class MySet implements IdsSet {
  private set = new Set();
  
  async add(ids: unknown[]) {
    ids.forEach(id => this.set.add(id));
  }

  async delete(ids: unknown[]) {
    ids.forEach(id => this.set.delete(id));
  }

  async *getAll() {
    yield [...this.set]
  }
}

```

### 4. The build task is scheduled
The build task simply retrieves all the root ids from the store and builds the corresponding objects.

By default, the build task is called immediately, but you can schedule it to run later to avoid rebuilding the same object too many times, and to batch multiple objects is a single SQL query. This is useful when multiple tables are updated simultaneously in a transaction for instance.

```typescript
const aggregator = new EventAggregator({
  schema,
  client,
  scheduleBuildObjects: (build) => {
    setTimeout(() => {
      build();
    }, 100); // Call the build task 100ms after the event
  }
})
```

In reality this is not really practical. A common approach is rather to push a message to a queue with a small delay:

```typescript
const aggregator = new EventAggregator({
  schema,
  client,
  scheduleBuildObjects: () => {
    channel.sendToQueue(
      'my-queue', 
      Buffer.from('Build objects'), // Arbitrary message
      { delay: 100 }, // A small delay to allow for batching
    );
  }
})
```

### 5. The objects are built
By default, the `buildObjects` method of the aggregator is called automatically. But if your `scheduleBuildObjects` function does not call the `build` callback, you have to call it manually:

```typescript
const aggregatorEmitter = new EventAggregator({
  schema,
  client,
  idsSet: new RedisSet({
    client: redis,
    key: 'my-redis-key'
  }),
  scheduleBuildObjects: () => {
    // Schedule the build task by pushing a message to a queue
    channel.sendToQueue('my-queue', Buffer.from('Build objects'));
  }
});

// Handle the low level events by calling the handleEvent method
await aggregatorEmitter.handleEvent(event);

// ---------------- In another process

// Create an aggregator with the same schema
const aggregatorBuilder = new EventAggregator({
  schema,
  client,
  idsSet: new RedisSet({
    client: redis,
    key: 'my-redis-key'
  }),
  onChange: (changes) => {
    // Handle the high level event
  }
});

// Consume the queue
channel.consume('my-queue', async (msg) => {
  // Call buildObjects manually
  await aggregatorBuilder.buildObjects();
  channel.ack(msg);
});
```
Under the hood, the `buildObjects` method retrieves the list of root ids for the set and calls the `buildSchemaQuery` function: 

```typescript
import { buildSchemaQuery } from 'pg-capture';

const query = buildSchemaQuery(schema, ['foo', 'bar']);
```

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
WHERE "book_1"."id" IN ($1, $2)
```

If the query returns a result for a given id, then the object was upserted. If the query returns no result, then the object was deleted.
