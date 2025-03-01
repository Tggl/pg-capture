import style from './styles.module.css';
import CodeBlock from '@theme/CodeBlock';
import {useState} from 'react';
import {motion} from 'motion/react';

const schema = `
{
  table: 'book',
  schema: {
    id: 'id',
    title: 'title',
    author: {
      type: 'many-to-one',
      column: 'authorId',
      references: 'author.id',
      schema: 'name',
    }
  }
}
`.trim();

const events = [
  {
    event: `
{
  action: 'INSERT',
  table: 'book',
  data: { 
    id: '1', 
    title: 'The Hobbit', 
    authorId: '2' 
  }
}
    `.trim(),
    result: `
{
  upsert: [
    { 
      id: '1', 
      title: 'The Hobbit', 
      author: 'J.R.R. Tolkien' 
    }
  ],
  delete: [],
}
    `.trim(),
  },
  {
    event: `
{
  action: 'UPDATE',
  table: 'author',
  data: { 
    id: '2', 
    name: 'Tolkien', 
  }
}
    `.trim(),
    result: `
{
  upsert: [
    { 
      id: '1', 
      title: 'The Hobbit', 
      author: 'Tolkien' 
    }
    { 
      id: '3', 
      title: 'The Lord of the Rings', 
      author: 'Tolkien' 
    }
  ],
  delete: [],
}
    `.trim(),
  },
  {
    event: `
{
  action: 'DELETE',
  table: 'book',
  data: { 
    id: '1', 
  }
}
    `.trim(),
    result: `
{
  upsert: [],
  delete: ['1'],
}
    `.trim(),
  },
];

export const MainAnimation = () => {
  const [index, setIndex] = useState(0);

  return (
    <div className={style.main}>
      <div className={style.container}>
        <motion.div className={style.card} layout>
          <h3>Table-level event</h3>
          <CodeBlock language="ts">{events[index].event}</CodeBlock>
        </motion.div>
        <motion.div className={style.link} layout />
        <motion.div className={style.card} layout>
          <h3>
            <img src="/img/logo.svg" alt="Pg-Capture logo" height={24} />{' '}
            PG-Capture
          </h3>
          <CodeBlock language="ts">{schema}</CodeBlock>
        </motion.div>
        <motion.div className={style.link} layout />
        <motion.div className={style.card} layout>
          <h3>Schema-level event</h3>
          <CodeBlock language="ts">{events[index].result}</CodeBlock>
        </motion.div>
      </div>
      <div className={style.pages}>
        {events.map((event, i) => (
          <div
            className={style.page + ' ' + (i === index ? style.activePage : '')}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
};
