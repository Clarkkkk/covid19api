import Router from '@koa/router';
import {
  readJSONFile,
  getMaxAgeForEveryDay,
  getLastModified
} from '../utils/index.js';

const vaccineRouter = new Router({prefix: '/vaccine'});

vaccineRouter.use(async (ctx, next) => {
  ctx.cacheControl = {
    maxAge: getMaxAgeForEveryDay(13),
    mustRevalidate: true
  };
  await next();
});

vaccineRouter.get('/latest', async (ctx, next) => {
  // read the corresponding file and send a response
  const filePath = './response/vaccine/latest.json';
  ctx.lastModified = await getLastModified(filePath);
  ctx.body = await readJSONFile(filePath);
  console.log(filePath);
  await next();
});

vaccineRouter.get('/:country', async (ctx, next) => {
  // read the corresponding file and send a response
  const country = ctx.params.country;
  const filePath = './response/vaccine/countries/' + country + '.json';
  ctx.lastModified = await getLastModified(filePath);
  ctx.body = await readJSONFile(filePath);
  console.log(filePath);
  await next();
});

export default vaccineRouter;
