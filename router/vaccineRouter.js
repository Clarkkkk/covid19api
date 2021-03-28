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

vaccineRouter.get('/:country', async (ctx, next) => {
  const country = ctx.params.country.toLowerCase();
  let filePath;
  let body;
  if (country === 'latest') {
    filePath = './response/vaccine/latest.json';
    body = await readJSONFile(filePath);
  } else {
    filePath = './response/vaccine/countries/' + country + '.json';
    const obj = await readJSONFile(filePath);
    delete obj.provinces;
    body = obj;
  }
  ctx.lastModified = await getLastModified(filePath);
  ctx.body = body;
  await next();
});

export default vaccineRouter;
