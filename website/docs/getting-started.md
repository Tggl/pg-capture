---
sidebar_position: 1
---

# Getting started

Install the package:

```bash
npm i pg-capture
```


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

You can now use any tool to catch PG replication events:
- [pg-logical-replication](https://www.npmjs.com/package/pg-logical-replication)
- [wal-listener](https://github.com/ihippik/wal-listener)
- [debezium](https://debezium.io/)

Forward the events to the `handleEvent` method:

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
