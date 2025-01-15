import {Changes, Client, IdsSet, RootSchema, WALEvent} from './types';
import {getRootIdsFromEvent} from './getRootIdsFromEvent';
import {buildSchemaQuery} from './buildSchemaQuery';
import {cleanQueryOutput} from './cleanQueryOutput';
import {InMemorySet} from './InMemorySet';

export class EventAggregator {
  private readonly _idsSet: IdsSet;
  private readonly _schema: RootSchema;
  private readonly _client: Client;
  private readonly _onChange: (changes: Changes) => void | Promise<void>;
  private readonly _scheduleBuildObjects: (
    build: () => Promise<void>,
  ) => void | Promise<void>;

  constructor({
    idsSet = new InMemorySet(),
    schema,
    client,
    onChange = () => {},
    scheduleBuildObjects = build => build(),
  }: {
    idsSet?: IdsSet;
    schema: RootSchema;
    client: Client;
    onChange?: (changes: Changes) => void | Promise<void>;
    scheduleBuildObjects?: (build: () => Promise<void>) => void | Promise<void>;
  }) {
    this._idsSet = idsSet;
    this._schema = schema;
    this._client = client;
    this._onChange = onChange;
    this._scheduleBuildObjects = scheduleBuildObjects;
  }

  async handleEvent(event: WALEvent) {
    const {ids, query} = getRootIdsFromEvent(this._schema, event);

    if (query) {
      const result = await query.run(this._client);
      ids.push(...result);
    }

    await this._idsSet.add(ids);
    await this._scheduleBuildObjects(() => this.buildObjects());
  }

  async buildObjects() {
    for await (const ids of this._idsSet.getAll()) {
      const result = await buildSchemaQuery(this._schema, ids)
        .run(this._client)
        .then(cleanQueryOutput);

      const byId = result.reduce((acc, obj) => {
        acc.set(obj.id, obj);
        return acc;
      }, new Map());

      const changes: Changes = {
        upsert: [],
        delete: [],
      };

      for (const id of ids) {
        if (byId.has(id)) {
          changes.upsert.push({id, object: byId.get(id)});
        } else {
          changes.delete.push(id);
        }
      }

      await this._onChange(changes);
      await this._idsSet.delete(ids);
    }
  }
}
