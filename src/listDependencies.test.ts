import {listDependencies} from './listDependencies';
import {QueryBuilder} from './QueryBuilder';
import {expectQuery} from './helpers.test';

test('self insert', () => {
  expect(
    listDependencies(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'column',
          column: 'email',
        },
      },
      {
        table: 'user',
        action: 'INSERT',
        data: {id: 'foo'},
        dataOld: undefined,
      },
    ),
  ).toEqual({ids: ['foo'], query: null});
});

test('self update', () => {
  expect(
    listDependencies(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'column',
          column: 'email',
        },
      },
      {
        table: 'user',
        action: 'UPDATE',
        data: {id: 'foo', email: 'old@gmail.com'},
        dataOld: {id: 'foo', email: 'new@gmail.com'},
      },
    ),
  ).toEqual({ids: ['foo'], query: null});
});

test('self update multiple columns', () => {
  expect(
    listDependencies(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'object',
          properties: {
            foo: {
              type: 'column',
              column: 'email',
            },
            bar: {
              type: 'column',
              column: 'name',
            },
          },
        },
      },
      {
        table: 'user',
        action: 'UPDATE',
        data: {id: 'foo', phone: '456', email: 'old@gmail.com'},
        dataOld: {id: 'foo', phone: '123', email: 'new@gmail.com'},
      },
    ),
  ).toEqual({ids: ['foo'], query: null});
});

test('unconventional primary key self update', () => {
  expect(
    listDependencies(
      {
        table: 'user',
        primaryKey: 'email',
        schema: {
          type: 'column',
          column: 'name',
        },
      },
      {
        table: 'user',
        action: 'UPDATE',
        data: {email: 'user@gmail.com', name: 'foo'},
        dataOld: {email: 'user@gmail.com', name: 'bar'},
      },
    ),
  ).toEqual({ids: ['user@gmail.com'], query: null});
});

test('self update primary key', () => {
  expect(
    listDependencies(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'column',
          column: 'email',
        },
      },
      {
        table: 'user',
        action: 'UPDATE',
        data: {id: 'foo', email: 'user@gmail.com'},
        dataOld: {id: 'bar', email: 'user@gmail.com'},
      },
    ),
  ).toEqual({ids: ['foo', 'bar'], query: null});
});

test('self update not updating interesting column', () => {
  expect(
    listDependencies(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'column',
          column: 'email',
        },
      },
      {
        table: 'user',
        action: 'UPDATE',
        data: {id: 'foo', name: 'Alice'},
        dataOld: {id: 'foo', name: 'Bob'},
      },
    ),
  ).toEqual({ids: [], query: null});
});

test('self delete', () => {
  expect(
    listDependencies(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'column',
          column: 'email',
        },
      },
      {
        table: 'user',
        action: 'DELETE',
        data: undefined,
        dataOld: {id: 'foo'},
      },
    ),
  ).toEqual({ids: ['foo'], query: null});
});

test('foreignKey insert', () => {
  expect(
    listDependencies(
      {
        table: 'article',
        primaryKey: 'id',
        schema: {
          type: 'foreign-key',
          column: 'authorId',
          referencesColumn: 'id',
          referencesTable: 'user',
          hasFKConstraint: true,
          schema: {
            type: 'column',
            column: 'name',
          },
        },
      },
      {
        table: 'user',
        action: 'INSERT',
        data: {id: 'foo'},
        dataOld: undefined,
      },
    ),
  ).toEqual({ids: [], query: null});
});

test('foreignKey insert, no constraint', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'user',
      action: 'INSERT',
      data: {id: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "article_1"."id" AS "id"
     FROM "article" AS "article_1"
     WHERE "article_1"."authorId" = 'foo'
     GROUP BY "article_1"."id"`,
  );
});

test('foreignKey insert, random table', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'comment',
      action: 'INSERT',
      data: {id: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: [], query: null});
});

test('foreignKey insert, no constraint, same PK', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'id',
        referencesColumn: 'userId',
        referencesTable: 'user_phone',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'phone',
        },
      },
    },
    {
      table: 'user_phone',
      action: 'INSERT',
      data: {userId: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: ['foo'], query: null});
});

test('foreignKey delete', () => {
  expect(
    listDependencies(
      {
        table: 'article',
        primaryKey: 'id',
        schema: {
          type: 'foreign-key',
          column: 'authorId',
          referencesColumn: 'id',
          referencesTable: 'user',
          hasFKConstraint: true,
          schema: {
            type: 'column',
            column: 'name',
          },
        },
      },
      {
        table: 'user',
        action: 'DELETE',
        data: undefined,
        dataOld: {id: 'foo'},
      },
    ),
  ).toEqual({ids: [], query: null});
});

test('foreignKey delete, no constraint', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'user',
      action: 'DELETE',
      data: undefined,
      dataOld: {id: 'foo'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "article_1"."id" AS "id"
     FROM "article" AS "article_1"
     WHERE "article_1"."authorId" = 'foo'
     GROUP BY "article_1"."id"`,
  );
});

test('foreignKey delete, random table', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'comment',
      action: 'DELETE',
      data: undefined,
      dataOld: {id: 'foo'},
    },
  );
  expect(result).toEqual({ids: [], query: null});
});

test('foreignKey delete, no constraint, same PK', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'id',
        referencesColumn: 'userId',
        referencesTable: 'user_phone',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'phone',
        },
      },
    },
    {
      table: 'user_phone',
      action: 'DELETE',
      data: undefined,
      dataOld: {userId: 'foo'},
    },
  );
  expect(result).toEqual({ids: ['foo'], query: null});
});

test('foreignKey update', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: true,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'user',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'foo', name: 'Bob'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "article_1"."id" AS "id"
     FROM "article" AS "article_1"
     WHERE "article_1"."authorId" = 'foo'
     GROUP BY "article_1"."id"`,
  );
});

test('nested foreignKey update', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: true,
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesColumn: 'id',
          referencesTable: 'organization',
          hasFKConstraint: true,
          schema: {
            type: 'column',
            column: 'name',
          },
        },
      },
    },
    {
      table: 'organization',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'foo', name: 'Bob'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "article_1"."id" AS "id"
     FROM "user" AS "user_1"
     LEFT JOIN "article" AS "article_1" ON "article_1"."authorId" = "user_1"."id"
     WHERE "user_1"."organizationId" = 'foo'
     GROUP BY "article_1"."id"`,
  );
});

test('double nested foreignKey update', () => {
  const result = listDependencies(
    {
      table: 'comment',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'articleId',
        referencesColumn: 'id',
        referencesTable: 'article',
        hasFKConstraint: true,
        schema: {
          type: 'foreign-key',
          column: 'authorId',
          referencesColumn: 'id',
          referencesTable: 'user',
          hasFKConstraint: true,
          schema: {
            type: 'foreign-key',
            column: 'organizationId',
            referencesColumn: 'id',
            referencesTable: 'organization',
            hasFKConstraint: true,
            schema: {
              type: 'column',
              column: 'name',
            },
          },
        },
      },
    },
    {
      table: 'organization',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'foo', name: 'Bob'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "comment_1"."id" AS "id"
     FROM "user" AS "user_1"
     LEFT JOIN "article" AS "article_1" ON "article_1"."authorId" = "user_1"."id"
     LEFT JOIN "comment" AS "comment_1" ON "comment_1"."articleId" = "article_1"."id"
     WHERE "user_1"."organizationId" = 'foo'
     GROUP BY "comment_1"."id"`,
  );
});

test('foreignKey update, random table', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: true,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'comment',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'foo', name: 'Bob'},
    },
  );
  expect(result).toEqual({ids: [], query: null});
});

test('foreignKey update, same PK', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'id',
        referencesColumn: 'userId',
        referencesTable: 'user_phone',
        hasFKConstraint: true,
        schema: {
          type: 'column',
          column: 'phone',
        },
      },
    },
    {
      table: 'user_phone',
      action: 'UPDATE',
      data: {userId: 'foo', phone: '123'},
      dataOld: {userId: 'foo', phone: '456'},
    },
  );
  expect(result).toEqual({ids: ['foo'], query: null});
});

test('foreignKey update primary key', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: true,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'user',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'bar', name: 'Alice'},
    },
  );
  expect(result).toEqual({ids: [], query: null});
});

test('foreignKey update primary key, no constraint', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'user',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'bar', name: 'Alice'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "article_1"."id" AS "id"
     FROM "article" AS "article_1"
     WHERE "article_1"."authorId" IN ('foo', 'bar')
     GROUP BY "article_1"."id"`,
  );
});

test('foreignKey update, no interesting column', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: true,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'user',
      action: 'UPDATE',
      data: {id: 'foo', email: 'old@gmail.com'},
      dataOld: {id: 'foo', email: 'new@gmail.com'},
    },
  );
  expect(result).toEqual({ids: [], query: null});
});

test('foreignKey update, no FK constraint', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'name',
        },
      },
    },
    {
      table: 'user',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'foo', name: 'Bob'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "article_1"."id" AS "id"
     FROM "article" AS "article_1"
     WHERE "article_1"."authorId" = 'foo'
     GROUP BY "article_1"."id"`,
  );
});

test('insert referencing table top level', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'article',
        referencingColumn: 'authorId',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'INSERT',
      data: {authorId: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: ['foo'], query: null});
});

test('nested insert referencing table', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'article',
        referencingColumn: 'authorId',
        schema: {
          type: 'referencing-table',
          column: 'id',
          referencingTable: 'comment',
          referencingColumn: 'articleId',
          schema: {
            type: 'column',
            column: 'message',
          },
        },
      },
    },
    {
      table: 'comment',
      action: 'INSERT',
      data: {articleId: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "article_1"."authorId" AS "id"
     FROM "article" AS "article_1"
     WHERE "article_1"."id" = 'foo'
     GROUP BY "article_1"."authorId"`,
  );
});

test('double nested insert referencing table', () => {
  const result = listDependencies(
    {
      table: 'organization',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'user',
        referencingColumn: 'organizationId',
        schema: {
          type: 'referencing-table',
          column: 'id',
          referencingTable: 'article',
          referencingColumn: 'authorId',
          schema: {
            type: 'referencing-table',
            column: 'id',
            referencingTable: 'comment',
            referencingColumn: 'articleId',
            schema: {
              type: 'column',
              column: 'message',
            },
          },
        },
      },
    },
    {
      table: 'comment',
      action: 'INSERT',
      data: {articleId: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "user_1"."organizationId" AS "id"
     FROM "article" AS "article_1"
     LEFT JOIN "user" AS "user_1" ON "user_1"."id" = "article_1"."authorId"
     WHERE "article_1"."id" = 'foo'
     GROUP BY "user_1"."organizationId"`,
  );
});

test('insert referencing table top level, non PK', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'ref',
        referencingTable: 'article',
        referencingColumn: 'authorRef',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'INSERT',
      data: {authorRef: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "user_1"."id" AS "id"
     FROM "user" AS "user_1"
     WHERE "user_1"."ref" = 'foo'
     GROUP BY "user_1"."id"`,
  );
});

test('insert referencing table, random table', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'article',
        referencingColumn: 'authorId',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'comment',
      action: 'INSERT',
      data: {authorId: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: [], query: null});
});

test('delete referencing table top level', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'article',
        referencingColumn: 'authorId',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'DELETE',
      data: undefined,
      dataOld: {authorId: 'foo'},
    },
  );
  expect(result).toEqual({ids: ['foo'], query: null});
});

test('delete referencing table top level, non PK', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'ref',
        referencingTable: 'article',
        referencingColumn: 'authorRef',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'DELETE',
      data: undefined,
      dataOld: {authorRef: 'foo'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "user_1"."id" AS "id"
     FROM "user" AS "user_1"
     WHERE "user_1"."ref" = 'foo'
     GROUP BY "user_1"."id"`,
  );
});

test('delete referencing table, random table', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'article',
        referencingColumn: 'authorId',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'comment',
      action: 'DELETE',
      data: undefined,
      dataOld: {authorId: 'foo'},
    },
  );
  expect(result).toEqual({ids: [], query: null});
});

test('update referencing table top level', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'article',
        referencingColumn: 'authorId',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'UPDATE',
      data: {authorId: 'foo', title: 'Title A'},
      dataOld: {authorId: 'foo', title: 'Title B'},
    },
  );
  expect(result).toEqual({ids: ['foo'], query: null});
});

test('update referencing table top level foreign key', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'article',
        referencingColumn: 'authorId',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'UPDATE',
      data: {authorId: 'foo'},
      dataOld: {authorId: 'bar'},
    },
  );
  expect(result).toEqual({ids: ['foo', 'bar'], query: null});
});

test('update referencing table top level uninteresting column', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'article',
        referencingColumn: 'authorId',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'UPDATE',
      data: {authorId: 'foo', prop: 1},
      dataOld: {authorId: 'foo', prop: 2},
    },
  );
  expect(result).toEqual({ids: [], query: null});
});

test('update referencing table top level, non PK', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'ref',
        referencingTable: 'article',
        referencingColumn: 'authorRef',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'UPDATE',
      data: {authorRef: 'foo', title: 'Title A'},
      dataOld: {authorRef: 'foo', title: 'Title B'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "user_1"."id" AS "id"
     FROM "user" AS "user_1"
     WHERE "user_1"."ref" = 'foo'
     GROUP BY "user_1"."id"`,
  );
});

test('update referencing table top level, non PK, referencing column', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'ref',
        referencingTable: 'article',
        referencingColumn: 'authorRef',
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'UPDATE',
      data: {authorRef: 'foo'},
      dataOld: {authorRef: 'bar'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "user_1"."id" AS "id"
     FROM "user" AS "user_1"
     WHERE "user_1"."ref" IN ('foo', 'bar')
     GROUP BY "user_1"."id"`,
  );
});

test('nested foreignKey referencingTable', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'organizationId',
        referencesColumn: 'id',
        referencesTable: 'organization',
        hasFKConstraint: true,
        schema: {
          type: 'referencing-table',
          column: 'id',
          referencingTable: 'article',
          referencingColumn: 'organizationId',
          schema: {
            type: 'column',
            column: 'title',
          },
        },
      },
    },
    {
      table: 'article',
      action: 'UPDATE',
      data: {organizationId: 'foo', title: 'Title A'},
      dataOld: {organizationId: 'foo', title: 'Title B'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "user_1"."id" AS "id"
     FROM "user" AS "user_1"
     WHERE "user_1"."organizationId" = 'foo'
     GROUP BY "user_1"."id"`,
  );
});

test('double nested foreignKey referencingTable', () => {
  const result = listDependencies(
    {
      table: 'comment',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'userId',
        referencesTable: 'user',
        referencesColumn: 'id',
        hasFKConstraint: true,
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesColumn: 'id',
          referencesTable: 'organization',
          hasFKConstraint: true,
          schema: {
            type: 'referencing-table',
            column: 'id',
            referencingTable: 'article',
            referencingColumn: 'organizationId',
            schema: {
              type: 'column',
              column: 'title',
            },
          },
        },
      },
    },
    {
      table: 'article',
      action: 'UPDATE',
      data: {organizationId: 'foo', title: 'Title A'},
      dataOld: {organizationId: 'foo', title: 'Title B'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "comment_1"."id" AS "id"
     FROM "user" AS "user_1"
     LEFT JOIN "comment" AS "comment_1" ON "comment_1"."userId" = "user_1"."id"
     WHERE "user_1"."organizationId" = 'foo'
     GROUP BY "comment_1"."id"`,
  );
});

test('triple nested foreignKey referencingTable', () => {
  const result = listDependencies(
    {
      table: 'comment',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'userId',
        referencesTable: 'user',
        referencesColumn: 'id',
        hasFKConstraint: true,
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesColumn: 'id',
          referencesTable: 'organization',
          hasFKConstraint: true,
          schema: {
            type: 'referencing-table',
            column: 'id',
            referencingTable: 'article',
            referencingColumn: 'organizationId',
            schema: {
              type: 'referencing-table',
              column: 'id',
              referencingTable: 'like',
              referencingColumn: 'articleId',
              schema: {
                type: 'column',
                column: 'createdAt',
              },
            },
          },
        },
      },
    },
    {
      table: 'like',
      action: 'INSERT',
      data: {articleId: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "comment_1"."id" AS "id"
     FROM "article" AS "article_1"
     LEFT JOIN "user" AS "user_1" ON "user_1"."organizationId" = "article_1"."organizationId"
     LEFT JOIN "comment" AS "comment_1" ON "comment_1"."userId" = "user_1"."id"
     WHERE "article_1"."id" = 'foo'
     GROUP BY "comment_1"."id"`,
  );
});

test('triple nested foreignKey referencingTable with object', () => {
  const result = listDependencies(
    {
      table: 'comment',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'userId',
        referencesTable: 'user',
        referencesColumn: 'id',
        hasFKConstraint: true,
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesColumn: 'id',
          referencesTable: 'organization',
          hasFKConstraint: true,
          schema: {
            type: 'object',
            properties: {
              name: {
                type: 'column',
                column: 'name',
              },
              likes: {
                type: 'referencing-table',
                column: 'id',
                referencingTable: 'article',
                referencingColumn: 'organizationId',
                schema: {
                  type: 'referencing-table',
                  column: 'id',
                  referencingTable: 'like',
                  referencingColumn: 'articleId',
                  schema: {
                    type: 'column',
                    column: 'createdAt',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      table: 'like',
      action: 'INSERT',
      data: {articleId: 'foo'},
      dataOld: undefined,
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "comment_1"."id" AS "id"
     FROM "article" AS "article_1"
     LEFT JOIN "user" AS "user_1" ON "user_1"."organizationId" = "article_1"."organizationId"
     LEFT JOIN "comment" AS "comment_1" ON "comment_1"."userId" = "user_1"."id"
     WHERE "article_1"."id" = 'foo'
     GROUP BY "comment_1"."id"`,
  );
});

test('triple nested foreignKey referencingTable with object update', () => {
  const result = listDependencies(
    {
      table: 'comment',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'userId',
        referencesTable: 'user',
        referencesColumn: 'id',
        hasFKConstraint: true,
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesColumn: 'id',
          referencesTable: 'organization',
          hasFKConstraint: true,
          schema: {
            type: 'object',
            properties: {
              name: {
                type: 'column',
                column: 'name',
              },
              likes: {
                type: 'referencing-table',
                column: 'id',
                referencingTable: 'article',
                referencingColumn: 'organizationId',
                schema: {
                  type: 'referencing-table',
                  column: 'id',
                  referencingTable: 'like',
                  referencingColumn: 'articleId',
                  schema: {
                    type: 'column',
                    column: 'createdAt',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      table: 'organization',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'foo', name: 'Bob'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "comment_1"."id" AS "id"
     FROM "user" AS "user_1"
     LEFT JOIN "comment" AS "comment_1" ON "comment_1"."userId" = "user_1"."id"
     WHERE "user_1"."organizationId" = 'foo'
     GROUP BY "comment_1"."id"`,
  );
});

test('nested foreignKey referencingTable, skip middle table', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'organizationId',
        referencesColumn: 'organizationId',
        referencesTable: 'article',
        hasFKConstraint: false,
        schema: {
          type: 'column',
          column: 'title',
        },
      },
    },
    {
      table: 'article',
      action: 'UPDATE',
      data: {organizationId: 'foo', title: 'Title A'},
      dataOld: {organizationId: 'foo', title: 'Title B'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "user_1"."id" AS "id"
     FROM "user" AS "user_1"
     WHERE "user_1"."organizationId" = 'foo'
     GROUP BY "user_1"."id"`,
  );
});

test('nested referencingTable foreignKey', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'referencing-table',
        column: 'id',
        referencingTable: 'user_organization',
        referencingColumn: 'userId',
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesTable: 'organization',
          referencesColumn: 'id',
          hasFKConstraint: true,
          schema: {
            type: 'column',
            column: 'name',
          },
        },
      },
    },
    {
      table: 'organization',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Name A'},
      dataOld: {id: 'foo', name: 'Name B'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "user_organization_1"."userId" AS "id"
     FROM "user_organization" AS "user_organization_1"
     WHERE "user_organization_1"."organizationId" = 'foo'
     GROUP BY "user_organization_1"."userId"`,
  );
});

test('both direct and indirect', () => {
  const result = listDependencies(
    {
      table: 'user',
      primaryKey: 'id',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'column',
            column: 'name',
          },
          followers: {
            type: 'referencing-table',
            column: 'id',
            referencingTable: 'follows',
            referencingColumn: 'userId',
            schema: {
              type: 'foreign-key',
              column: 'followsUserId',
              referencesTable: 'user',
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
    },
    {
      table: 'user',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'foo', name: 'Bob'},
    },
  );
  expect(result).toEqual({ids: ['foo'], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "follows_1"."userId" AS "id"
     FROM "follows" AS "follows_1"
     WHERE "follows_1"."followsUserId" = 'foo'
     GROUP BY "follows_1"."userId"`,
  );
});

test('multiple queries', () => {
  const result = listDependencies(
    {
      table: 'article',
      primaryKey: 'id',
      schema: {
        type: 'foreign-key',
        column: 'authorId',
        referencesColumn: 'id',
        referencesTable: 'user',
        hasFKConstraint: true,
        schema: {
          type: 'object',
          properties: {
            name: {
              type: 'column',
              column: 'name',
            },
            follows: {
              type: 'referencing-table',
              column: 'id',
              referencingTable: 'follows',
              referencingColumn: 'userId',
              schema: {
                type: 'foreign-key',
                column: 'followsUserId',
                referencesTable: 'user',
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
      },
    },
    {
      table: 'user',
      action: 'UPDATE',
      data: {id: 'foo', name: 'Alice'},
      dataOld: {id: 'foo', name: 'Bob'},
    },
  );
  expect(result).toEqual({ids: [], query: expect.any(QueryBuilder)});
  expectQuery(
    result.query,
    `SELECT "article_1"."id" AS "id"
     FROM "article" AS "article_1"
     WHERE "article_1"."authorId" = 'foo'
     GROUP BY "article_1"."id"
     
     UNION
     
     SELECT "article_2"."id" AS "id"
     FROM "follows" AS "follows_1"
     LEFT JOIN "article" AS "article_2" ON "article_2"."authorId" = "follows_1"."userId"
     WHERE "follows_1"."followsUserId" = 'foo'
     GROUP BY "article_2"."id"`,
  );
});
