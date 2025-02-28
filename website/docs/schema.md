---
sidebar_position: 2
---

# Schema definition

## Introduction

PG-Capture is a schema-based Change-Data-Capture utility. It allows you to define a schema and automatically capture changes to it. You need to define a `RootSchema` and nest other schemas within it to define the structure of the objects you want to capture:

```typescript
import { RootSchema } from 'pg-capture';

const schema: RootSchema = {
  table: 'user',
  primaryKey: 'id',
  schema: {
    type: 'object',
    properties: {
      id: {
        type: 'column',
        column: 'id',
      },
      name: {
        type: 'object',
        properties: {
          first: {
            type: 'column',
            column: 'first_name',
          },
          last: {
            type: 'column',
            column: 'last_name',
          },
        },
      },
      organizationName: {
        type: 'many-to-one',
        column: 'organizationId',
        referencesTable: 'organization',
        referencesColumn: 'id',
        hasFKConstraint: true,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
      follows: {
        type: 'one-to-many',
        column: 'id',
        referencesTable: 'follow',
        referencesColumn: 'userId',
        schema: {
          type: 'many-to-one',
          column: 'followedUserId',
          referencesTable: 'user',
          referencesColumn: 'id',
          hasFKConstraint: true,
          schema: {
            type: 'column',
            column: 'email',
          },
        },
      },
    },
  },
}
```

This schema will result in having one object per user, with the `id` as the primary key.
The objects will look like this:

```json
{
  "id": 1,
  "name": {
    "first": "John",
    "last": "Doe"
  },
  "organizationName": "ACME",
  "follows": ["alice@gmail.com", "bob@gmail.com"]
}
```

## Reference

### RootSchema
```typescript
type RootSchema = {
  table: string
  primaryKey: string
  schema: Schema
}
```

The `RootSchema` defines to which table the schema belongs to, resulting in having one object per row. Therefore, you cannot group multiple rows in a single object, unless you choose a different table for your `RootSchema`.

### Schema

A schema can be one of the following types:
```typescript
type Schema =
  | ColumnSchema
  | ObjectSchema
  | ManyToOneSchema
  | OneToManySchema
```

Note that a `Schema` is always defined in the context of a table, may it be from the `RootSchema` or from the parent `Schema` since schemas can be nested indefinitely.

### ColumnSchema
```typescript
type ColumnSchema = {
  type: 'column'
  column: string
}
```
This schema type returns the value of a column from the table in which it is defined.

### ObjectSchema
```typescript
type ObjectSchema = {
  type: 'object'
  properties: Record<string, Schema>
}
```

This schema type is used to build more complex objects by combining multiple sub-schemas in a single object. As any other schema, it can be nested with itself.

### ManyToOneSchema

```typescript
type ManyToOneSchema = {
  type: 'many-to-one'
  column: string
  referencesTable: string
  referencesColumn: string
  hasFKConstraint: boolean
  schema: Schema
}
```

You should use a `ManyToOneSchema` when you want to join another table that has a **unique constraint** on the column you are referencing. This schema type will return the value of the `schema` property.

If the current table has a foreign-key constraint to the referenced table, you can set `hasFKConstraint` to `true` to optimize the generated queries by reducing the number of checks PG-Capture has to do.

### OneToManySchema
```typescript
type OneToManySchema = {
  type: 'one-to-many'
  column: string
  referencingTable: string
  referencingColumn: string
  schema: Schema
}
```
You should use a `OneToManySchema` when you want to join another table that may have multiple rows for each parent object. This schema type will return an array of the `schema` property.

:::note
By default, the array is flattened and all null values are removed.
:::
