# pg-capture

A lightweight and modular CDC (Change Data Capture) utility for PostgreSQL. Works on top of the logical replication feature to generate high level events from a schema.

`pg-capture` is like having WAL (Write Ahead Log) events but on an SQL view.

- Aggregate low level events on tables (insert, update, and delete) into high level events on schemas (object upsert or delete)
- Use PG as your single source of truth
- Keep PG in sync with other storages such as Elasticsearch, Redis, etc...
- Subscribe to schema changes in real-time

## [Documentation](https://pg-capture.onrender.com/)
