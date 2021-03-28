import Router from '@koa/router';
import fs from 'fs/promises';
import {
  readJSONFile,
  getLastModified
} from '../utils/index.js';

const newsRouter = new Router({prefix: '/news'});

newsRouter.get('/news', async (ctx, next) => {
  const filePath = './response/news.json';
  const stats = await fs.stat(filePath);
  const maxAge = (stats.mtimeMs + 3600000 - Date.now()) / 1000;
  ctx.cacheControl = {
    maxAge: Math.floor(maxAge), // should be integer
    mustRevalidate: true
  };
  ctx.lastModified = await getLastModified(filePath);
  ctx.body = await readJSONFile(filePath);
  await next();
});

export default newsRouter;
