---
sidebar_position: 4
---

# Events

Since PG-Capture is agnostic of the source of the events, it is your job to format the events in a way that PG-Capture can understand. The events should look like this: 

```typescript
type WALEvent =
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
```

Note that all events require a `data` and / or `dataOld` fields which is not present by default with Postgres. For Postgres to include these fields, you need to enable `REPLICA IDENTITY FULL` on all tables you want to capture events from. 

```sql
ALTER TABLE table_name REPLICA IDENTITY FULL;
```

This has a small negative impact on performance, so only enable it on tables you want to capture events from. You can use [schema introspection](introspection) to know which tables should have `REPLICA IDENTITY FULL` enabled. 
