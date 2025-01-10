import {expectQuery} from './helpers.test';
import {buildObjects} from './buildObjects';

test('column', () => {
  expectQuery(
    buildObjects(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'column',
          column: 'name',
        },
      },
      ['foo'],
    ),
    `SELECT "user_1"."id" AS "id", "user_1"."name" AS "object"
     FROM "user" AS "user_1"
     WHERE "user_1"."id" = 'foo'`,
  );
});

test('object', () => {
  expectQuery(
    buildObjects(
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
            email: {
              type: 'column',
              column: 'email',
            },
          },
        },
      },
      ['foo', 'bar'],
    ),
    `SELECT "user_1"."id" AS "id", JSON_BUILD_OBJECT('name', "user_1"."name", 'email', "user_1"."email") AS "object"
     FROM "user" AS "user_1"
     WHERE "user_1"."id" IN ('foo', 'bar')`,
  );
});

test('foreignKey', () => {
  expectQuery(
    buildObjects(
      {
        table: 'article',
        primaryKey: 'id',
        schema: {
          type: 'foreign-key',
          column: 'authorId',
          referencesTable: 'user',
          referencesColumn: 'id',
          hasFKConstraint: true,
          schema: {
            type: 'column',
            column: 'email',
          },
        },
      },
      ['foo', 'bar'],
    ),
    `SELECT "article_1"."id" AS "id", "user_2"."object" AS "object"
     FROM "article" AS "article_1"
     LEFT JOIN (
       SELECT "user_1"."id" AS "id", "user_1"."email" AS "object" 
       FROM "user" AS "user_1"
     ) AS "user_2" ON "article_1"."authorId" = "user_2"."id"
     WHERE "article_1"."id" IN ('foo', 'bar')`,
  );
});

test('multiple foreignKey', () => {
  expectQuery(
    buildObjects(
      {
        table: 'article',
        primaryKey: 'id',
        schema: {
          type: 'object',
          properties: {
            author: {
              type: 'foreign-key',
              column: 'authorId',
              referencesTable: 'user',
              referencesColumn: 'id',
              hasFKConstraint: true,
              schema: {
                type: 'column',
                column: 'email',
              },
            },
            organization: {
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
      },
      ['foo', 'bar'],
    ),
    `SELECT "article_1"."id" AS "id",
            JSON_BUILD_OBJECT('author', "user_2"."object", 'organization', "organization_2"."object") AS "object"
     FROM "article" AS "article_1"
     LEFT JOIN (
       SELECT "user_1"."id" AS "id", "user_1"."email" AS "object" 
       FROM "user" AS "user_1"
     ) AS "user_2" ON "article_1"."authorId" = "user_2"."id"
     LEFT JOIN (
       SELECT "organization_1"."id" AS "id", "organization_1"."name" AS "object"
       FROM "organization" AS "organization_1"
     ) AS "organization_2" ON "article_1"."organizationId" = "organization_2"."id"
     WHERE "article_1"."id" IN ('foo', 'bar')`,
  );
});

test('nested foreignKey', () => {
  expectQuery(
    buildObjects(
      {
        table: 'article',
        primaryKey: 'id',
        schema: {
          type: 'foreign-key',
          column: 'authorId',
          referencesTable: 'user',
          referencesColumn: 'id',
          hasFKConstraint: true,
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
      ['foo', 'bar'],
    ),
    `SELECT "article_1"."id" AS "id", "user_2"."object" AS "object"
     FROM "article" AS "article_1"
     LEFT JOIN (
       SELECT "user_1"."id" AS "id", "organization_2"."object" AS "object"
       FROM "user" AS "user_1"
       LEFT JOIN (
         SELECT "organization_1"."id" AS "id", "organization_1"."name" AS "object"
         FROM "organization" AS "organization_1"
       ) AS "organization_2" ON "user_1"."organizationId" = "organization_2"."id"
     ) AS "user_2" ON "article_1"."authorId" = "user_2"."id"
     WHERE "article_1"."id" IN ('foo', 'bar')`,
  );
});

test('referencing table', () => {
  expectQuery(
    buildObjects(
      {
        table: 'article',
        primaryKey: 'id',
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
      ['foo', 'bar'],
    ),
    `SELECT "article_1"."id" AS "id", COALESCE("comment_2"."object", '[]'::json) AS "object"
     FROM "article" AS "article_1"
     LEFT JOIN (
       SELECT "comment_1"."articleId" AS "articleId", JSON_AGG("comment_1"."message") AS "object"
       FROM "comment" AS "comment_1"
       GROUP BY "comment_1"."articleId"
     ) AS "comment_2" ON "article_1"."id" = "comment_2"."articleId"
     WHERE "article_1"."id" IN ('foo', 'bar')`,
  );
});

test('double referencing table', () => {
  expectQuery(
    buildObjects(
      {
        table: 'article',
        primaryKey: 'id',
        schema: {
          type: 'object',
          properties: {
            comments: {
              type: 'referencing-table',
              column: 'id',
              referencingTable: 'comment',
              referencingColumn: 'articleId',
              schema: {
                type: 'column',
                column: 'message',
              },
            },
            likes: {
              type: 'referencing-table',
              column: 'id',
              referencingTable: 'like',
              referencingColumn: 'articleId',
              schema: {
                type: 'column',
                column: 'id',
              },
            },
          },
        },
      },
      ['foo', 'bar'],
    ),
    `SELECT 
       "article_1"."id" AS "id",
       JSON_BUILD_OBJECT(
         'comments', COALESCE("comment_2"."object", '[]'::json), 
         'likes', COALESCE("like_2"."object", '[]'::json)
       ) AS "object"
     FROM "article" AS "article_1"
     LEFT JOIN (
       SELECT "comment_1"."articleId" AS "articleId", JSON_AGG("comment_1"."message") AS "object"
       FROM "comment" AS "comment_1"
       GROUP BY "comment_1"."articleId"
     ) AS "comment_2" ON "article_1"."id" = "comment_2"."articleId"
     LEFT JOIN (
       SELECT "like_1"."articleId" AS "articleId", JSON_AGG("like_1"."id") AS "object"
       FROM "like" AS "like_1"
       GROUP BY "like_1"."articleId"
     ) AS "like_2" ON "article_1"."id" = "like_2"."articleId"
     WHERE "article_1"."id" IN ('foo', 'bar')`,
  );
});

test('nested referencing table', () => {
  expectQuery(
    buildObjects(
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
      ['foo', 'bar'],
    ),
    `SELECT "user_1"."id" AS "id", COALESCE("article_2"."object", '[]'::json) AS "object"
     FROM "user" AS "user_1"
     LEFT JOIN (
       SELECT 
         "article_1"."authorId" AS "authorId",
         JSON_AGG(COALESCE("comment_2"."object", '[]'::json)) AS "object"
       FROM "article" AS "article_1"
       LEFT JOIN (
         SELECT 
           "comment_1"."articleId" AS "articleId",
           JSON_AGG("comment_1"."message") AS "object"
         FROM "comment" AS "comment_1"
         GROUP BY "comment_1"."articleId"
       ) AS "comment_2" ON "article_1"."id" = "comment_2"."articleId"
       GROUP BY "article_1"."authorId"
     ) AS "article_2" ON "user_1"."id" = "article_2"."authorId"
     WHERE "user_1"."id" IN ('foo', 'bar')`,
  );
});

test('same table multiple times', () => {
  expectQuery(
    buildObjects(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'referencing-table',
          column: 'id',
          referencingTable: 'follower',
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
      ['foo', 'bar'],
    ),
    `SELECT "user_1"."id" AS "id", COALESCE("follower_2"."object", '[]'::json) AS "object"
     FROM "user" AS "user_1"
     LEFT JOIN (
       SELECT "follower_1"."userId" AS "userId", JSON_AGG("user_3"."object") AS "object"
       FROM "follower" AS "follower_1"
       LEFT JOIN (
         SELECT "user_2"."id" AS "id", "user_2"."name" AS "object"
         FROM "user" AS "user_2"
       ) AS "user_3" ON "follower_1"."followsUserId" = "user_3"."id"
       GROUP BY "follower_1"."userId"
     ) AS "follower_2" ON "user_1"."id" = "follower_2"."userId"
     WHERE "user_1"."id" IN ('foo', 'bar')`,
  );
});

test('skip middle table', () => {
  expectQuery(
    buildObjects(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesTable: 'organization',
          referencesColumn: 'id',
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
      ['foo', 'bar'],
    ),
    `SELECT "user_1"."id" AS "id", COALESCE("article_2"."object", '[]'::json) AS "object"
     FROM "user" AS "user_1"
     LEFT JOIN (
       SELECT 
         "article_1"."organizationId" AS "organizationId",
         JSON_AGG("article_1"."title") AS "object"
       FROM "article" AS "article_1"
       GROUP BY "article_1"."organizationId"
     ) AS "article_2" ON "user_1"."organizationId" = "article_2"."organizationId"
     WHERE "user_1"."id" IN ('foo', 'bar')`,
  );
});

test('do not skip middle table if not same column', () => {
  expectQuery(
    buildObjects(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesTable: 'organization',
          referencesColumn: 'id',
          hasFKConstraint: true,
          schema: {
            type: 'referencing-table',
            column: 'ref',
            referencingTable: 'article',
            referencingColumn: 'organizationRef',
            schema: {
              type: 'column',
              column: 'title',
            },
          },
        },
      },
      ['foo', 'bar'],
    ),
    `SELECT "user_1"."id" AS "id", "organization_2"."object" AS "object"
     FROM "user" AS "user_1"
     LEFT JOIN (
       SELECT "organization_1"."id" AS "id", COALESCE("article_2"."object", '[]'::json) AS "object"
       FROM "organization" AS "organization_1"
       LEFT JOIN (
         SELECT 
           "article_1"."organizationRef" AS "organizationRef",
           JSON_AGG("article_1"."title") AS "object"
         FROM "article" AS "article_1"
         GROUP BY "article_1"."organizationRef"
       ) AS "article_2" ON "organization_1"."ref" = "article_2"."organizationRef"
     ) AS "organization_2" ON "user_1"."organizationId" = "organization_2"."id"
     WHERE "user_1"."id" IN ('foo', 'bar')`,
  );
});

test('do not skip middle table if read', () => {
  expectQuery(
    buildObjects(
      {
        table: 'user',
        primaryKey: 'id',
        schema: {
          type: 'foreign-key',
          column: 'organizationId',
          referencesTable: 'organization',
          referencesColumn: 'id',
          hasFKConstraint: true,
          schema: {
            type: 'object',
            properties: {
              name: {
                type: 'column',
                column: 'name',
              },
              articles: {
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
      },
      ['foo', 'bar'],
    ),
    `SELECT "user_1"."id" AS "id", "organization_2"."object" AS "object"
     FROM "user" AS "user_1"
     LEFT JOIN (
       SELECT 
         "organization_1"."id" AS "id",
         JSON_BUILD_OBJECT(
           'name', "organization_1"."name", 
           'articles', COALESCE("article_2"."object", '[]'::json)
         ) AS "object"
       FROM "organization" AS "organization_1"
       LEFT JOIN (
         SELECT 
           "article_1"."organizationId" AS "organizationId",
           JSON_AGG("article_1"."title") AS "object"
         FROM "article" AS "article_1"
         GROUP BY "article_1"."organizationId"
       ) AS "article_2"  ON "organization_1"."id" = "article_2"."organizationId"
     ) AS "organization_2" ON "user_1"."organizationId" = "organization_2"."id"
     WHERE "user_1"."id" IN ('foo', 'bar')`,
  );
});
