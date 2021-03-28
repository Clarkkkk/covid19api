import Router from '@koa/router';
import {
  readJSONFile,
  getMaxAgeForEveryDay,
  getLastModified
} from '../utils/index.js';

const covidRouter = new Router({prefix: '/covid'});

covidRouter.use(async (ctx, next) => {
  ctx.cacheControl = {
    maxAge: getMaxAgeForEveryDay(6),
    mustRevalidate: true
  };
  await next();
});

covidRouter.get('/latest', async (ctx, next) => {
  // read the corresponding file and send a response
  const filePath = './response/covid/latest.json';
  ctx.lastModified = await getLastModified(filePath);
  ctx.body = await readJSONFile(filePath);
  await next();
});

covidRouter.get('/:country', async (ctx, next) => {
  const country = ctx.params.country;
  const filePath = './response/covid/countries/' + country + '.json';
  ctx.lastModified =await getLastModified(filePath);
  const obj = await readJSONFile(filePath);
  delete obj.provinces;
  ctx.body = obj;
  await next();
});

covidRouter.get('/:country/:province', async (ctx, next) => {
  const country = ctx.params.country;
  const province = ctx.params.province;
  const filePath = './response/covid/countries/' + country + '.json';
  ctx.lastModified = await getLastModified(filePath);
  const obj = await readJSONFile(filePath);
  // pagination
  if (province === 'all') {
    // convert the query params to number
    const limit = +ctx.query.limit;
    const page = +ctx.query.page || 0;
    if (limit) {
      const start = limit * page;
      const end = limit * (page + 1);
      obj.more = obj.data.length > end;
      obj.data = obj.data.slice(start, end);
      for (const province of obj.provinces) {
        province.data = province.data.slice(start, end);
      }
    }
    ctx.body = obj;
  } else {
    ctx.body = obj.provinces.find((obj) => obj.province === province);
  }
  await next();
});

export default covidRouter;
