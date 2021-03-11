// Node
import fs from 'fs/promises';
import {F_OK} from 'constants';

// Koa
import Koa from 'koa';
import Router from '@koa/router';
import helmet from 'koa-helmet';
import cacheControl from 'koa-cache-control';
import serveStatic from 'koa-static';
import cors from '@koa/cors';

// Third party package
import schedule from 'node-schedule';

// module
import updateData from './module/updateData.js';
import updateNews from './module/updateNews.js';

// initialize server
const app = new Koa();
const router = new Router();

app.use(cacheControl());
app.use(
  helmet({
    dnsPrefetchControl: {allow: true},
    referrerPolicy: {policy: ['same-origin']}
  })
);

app.use(cors({
  origin: process.env.NODE_ENV === 'development' ?
    'http://localhost:8080' : 'https://carllllo.work',
  maxAge: 60
}));

app.use(async (ctx, next) => {
  console.log(ctx.req.url);
  console.log(ctx.req.headers);
  console.log(ctx.req.host);
  console.log(ctx.req.ip);
  await next();
});

router.get('/', async (ctx) => {
  ctx.body = 'Covid 19 API.';
});

router.get('/latest', async (ctx, next) => {
  // calculate max-age
  const now = new Date(Date.now());
  let expire = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    6
  );
  if (now.getUTCHours() >= 6) {
    expire += 24 * 60 * 60 * 1000;
  }
  const maxAge = (expire - Date.now() + 60000) / 1000;
  ctx.cacheControl = {
    maxAge: Math.floor(maxAge),
    mustRevalidate: true
  };

  // read the corresponding file and send a response
  const filePath = './response/todayData.json';
  const stats = await fs.stat(filePath);
  ctx.lastModified = new Date(stats.mtimeMs);
  ctx.body = await readJSONFile(filePath);
  console.log(filePath);
});

router.get('/news', async (ctx, next) => {
  const filePath = './response/news.json';
  const stats = await fs.stat(filePath);
  const maxAge = (stats.mtimeMs + 3600000 - Date.now()) / 1000;
  ctx.cacheControl = {
    maxAge: Math.floor(maxAge), // should be integer
    mustRevalidate: true
  };
  ctx.lastModified = new Date(stats.mtimeMs);
  ctx.body = await readJSONFile(filePath);
  console.log(filePath);
});

const countryRouter = new Router({prefix: '/countries'});
countryRouter.use(async (ctx, next) => {
  const now = new Date(Date.now());
  // data expires at 6:00 UTC every day
  let expire = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    6
  );
  // if it's later than 6:00 currently
  // data expires at 6:00 in the next day
  if (now.getUTCHours() >= 6) {
    expire += 24 * 60 * 60 * 1000;
  }
  const maxAge = (expire - Date.now() + 60000) / 1000;
  ctx.cacheControl = {
    maxAge: Math.floor(maxAge),
    mustRevalidate: true
  };
  await next();
});

countryRouter.get('/:country', async (ctx, next) => {
  const country = ctx.params.country;
  const filePath = './response/countries/' + country + '.json';
  const stats = await fs.stat(filePath);
  ctx.lastModified = new Date(stats.mtimeMs);
  const obj = await readJSONFile(filePath);
  delete obj.provinces;
  ctx.body = obj;
  await next();
});

countryRouter.get('/:country/:province', async (ctx, next) => {
  const country = ctx.params.country;
  const province = ctx.params.province;
  const filePath = './response/countries/' + country + '.json';
  const stats = await fs.stat(filePath);
  ctx.lastModified = new Date(stats.mtimeMs);
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

router.use(countryRouter.routes());

app.use(router.routes());
app.use(serveStatic('public', {
  maxage: 2592000000,
  gzip: false
}));
app.listen(3100, function() {
  console.log('NODE_ENV is: ' + process.env.NODE_ENV);
  console.log('Covid 19 API running @ http://localhost:3100');
  initialize();
});

async function initialize() {
  // create folder to store data
  await createFolder('./response');
  await createFolder('./response/countries');
  // update data immediately
  await updateData();
  await updateNews();
  // set schedule to update data at 6:00 UTC every day
  schedule.scheduleJob('0 6 * * *', () => updateData());
  // set schedule to update news every hour
  schedule.scheduleJob('0 * * * *', () => updateNews());
}

async function createFolder(dirPath) {
  try {
    await fs.access(dirPath, F_OK);
  } catch (e) {
    await fs.mkdir(dirPath);
    console.log('Folder created: ' + dirPath);
  }
}

async function readJSONFile(filePath) {
  try {
    await fs.access(filePath, F_OK);
    const str = await fs.readFile(filePath, {encoding: 'utf-8'});
    return JSON.parse(str);
  } catch (err) {
    console.log('File not existed: ' + filePath);
    console.log(err);
    return Promise.reject(err);
  }
}
