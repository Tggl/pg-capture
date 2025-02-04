import {introspection} from './introspection';

test('single column', () => {
  expect(
    introspection({
      table: 'users',
      primaryKey: 'id',
      schema: {
        type: 'column',
        column: 'name',
      },
    }),
  ).toEqual({
    tables: [
      {
        table: 'users',
        columns: ['id', 'name'],
      },
    ],
    output: {
      type: 'column',
      table: 'users',
      column: 'name',
    },
  });
});

test('object columns', () => {
  expect(
    introspection({
      table: 'users',
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
    }),
  ).toEqual({
    tables: [
      {
        table: 'users',
        columns: ['id', 'name', 'email'],
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
        email: {
          type: 'column',
          table: 'users',
          column: 'email',
        },
      },
    },
  });
});

test('many to one', () => {
  expect(
    introspection({
      table: 'users',
      primaryKey: 'id',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'column',
            column: 'name',
          },
          organizationName: {
            type: 'many-to-one',
            referencesTable: 'organizations',
            column: 'organizationId',
            referencesColumn: 'id',
            hasFKConstraint: true,
            schema: {
              type: 'column',
              column: 'name',
            },
          },
        },
      },
    }),
  ).toEqual({
    tables: [
      {
        table: 'users',
        columns: ['id', 'name', 'organizationId'],
      },
      {
        table: 'organizations',
        columns: ['name', 'id'],
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
        organizationName: {
          type: 'column',
          table: 'organizations',
          column: 'name',
        },
      },
    },
  });
});

test('join table', () => {
  expect(
    introspection({
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
    }),
  ).toEqual({
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
  });
});

test('nested one to many', () => {
  expect(
    introspection({
      table: 'users',
      primaryKey: 'id',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'column',
            column: 'name',
          },
          comments: {
            type: 'one-to-many',
            column: 'id',
            referencingTable: 'article',
            referencingColumn: 'authorId',
            schema: {
              type: 'one-to-many',
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
    }),
  ).toEqual({
    tables: [
      {
        table: 'users',
        columns: ['id', 'name'],
      },
      {
        table: 'comment',
        columns: ['message', 'articleId'],
      },
      {
        table: 'article',
        columns: ['id', 'authorId'],
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
        comments: {
          type: 'array',
          items: {
            type: 'column',
            table: 'comment',
            column: 'message',
          },
        },
      },
    },
  });
});
