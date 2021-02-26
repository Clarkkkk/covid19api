// Node
import fs from 'fs/promises';
import {F_OK} from 'constants';

// Koa
import Koa from 'koa';
import Router from '@koa/router';
import helmet from 'koa-helmet';
import cacheControl from 'koa-cache-control';
import serveStatic from 'koa-static';

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

router.get('/', async (ctx) => {
  console.log(ctx.req);
  ctx.body = 'Covid 19 API.';
});

router.get('/latest', async (ctx, next) => {
  console.log(ctx.req);

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
    maxAge
  };

  // read the corresponding file and send a response
  ctx.state.filePath = './response/todayData.json';
  await next();
});

router.get('/news', async (ctx, next) => {
  console.log(ctx.req);
  ctx.cacheControl = {
    maxAge: 1800
  };
  ctx.state.filePath = './response/news.json';
  await next();
});

router.get('/countries/:country', async (ctx, next) => {
  console.log(ctx.req);
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
  const maxAge = expire - Date.now() + 60000;
  ctx.cacheControl = {maxAge};

  const country = ctx.params.country;
  ctx.state.filePath = './response/countries/' + country + '.json';
  await next();
});

router.use(async (ctx) => {
  if (ctx.state.filePath) {
    console.log(ctx.state.filePath);
    ctx.body = await readJSONFile(ctx.state.filePath);
  }
});

app.use(router.routes());
app.use(serveStatic('public'));
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
