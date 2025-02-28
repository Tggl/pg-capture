---
sidebar_position: 3
---

# Schema introspection

## Introduction

Introspection on a schema can be very useful for multiple reasons:
- Generating types from a schema
- Knowing which tables are used by a schema to make sure they use `REPLICA IDENTITY FULL`
- Knowing which WAL events to listen to

You can introspect a schema by calling the `introspection` function:

```typescript
import { introspection, IntrospectionResult, RootSchema } from 'pg-captur';

const schema: RootSchema = {
  table: 'users',
  primaryKey: 'id',
  schema: {
    type: 'object',
    properties: {
      name: {
        type: 'column',
        column: 'name',
      },
      organizationNames: {
        type: 'one-to-many',
        column: 'id',
        referencingTable: 'userToOrganization',
        referencingColumn: 'userId',
        schema: {
          type: 'many-to-one',
          column: 'organizationId',
          referencesTable: 'organizations',
          referencesColumn: 'id',
          hasFKConstraint: true,
          schema: {
            type: 'column',
            column: 'name',
          },
        },
      },
    },
  },
};

const result: IntrospectionResult = introspection(schema);
```

Given the schema above, the output will look like this:

```typescript
const result = {
  tables: [
    {
      table: 'users',
      columns: ['id', 'name'],
    },
    {
      table: 'organizations',
      columns: ['name', 'id'],
    },
    {
      table: 'userToOrganization',
      columns: ['organizationId', 'userId'],
    },
  ],
  output: {
    type: 'object',
    properties: {
      name: {
        type: 'column',
        table: 'users',
        column: 'name',
      },
      organizationNames: {
        type: 'array',
        items: {
          type: 'column',
          table: 'organizations',
          column: 'name',
        },
      },
    },
  },
}
```

## Reference
### IntrospectionResult
```typescript
type IntrospectionResult = {
  tables: {
    table: string
    columns: string[]
  }[]
  output: SchemaOutput
}
```

The `tables` key contains the list of tables that are used by the schema. All those tables should have a `REPLICA IDENTITY FULL` in Postgres. It can be used to filter WAL events if needed.

The `output` key contains the schema that will be outputted. You can use it to generate types at build time.

### SchemaOutput
```typescript
type SchemaOutput = ColumnOutput | ObjectOutput | ArrayOutput
```
The output schema is a union and can be nested indefinitely.

### ColumnOutput
```typescript
type ColumnOutput = {
  type: 'column'
  table: string
  column: string
}
```
Will return the value of a given column for a given table. It is up to you to know the type of the column and generate your types accordingly.

### ObjectOutput
```typescript
type ObjectOutput = {
  type: 'object'
  properties: Record<string, SchemaOutput>
}
```

Will return an object with the given properties. Each property being its own sub-schema.

### ArrayOutput
```typescript
type ArrayOutput = {
  type: 'array'
  items: ColumnOutput | ObjectOutput
}
```
Will return an array of the given type. Notice that by default arrays are not nested.
