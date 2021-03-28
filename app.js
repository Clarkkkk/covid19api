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
import {
  updateCovid,
  updateNews,
  updateVaccine
} from './module/index.js';

// router
import {
  covidRouter,
  newsRouter,
  vaccineRouter
} from './router/index.js';

// utils
import {createFolder} from './utils/index.js';

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
  await next();
});

router.get('/', async (ctx) => {
  ctx.body = 'Covid 19 API.';
});

router.use(covidRouter.routes());
router.use(vaccineRouter.routes());
router.use(newsRouter.routes());
app.use(router.routes());

app.use(serveStatic('public', {
  maxage: 2592000000, // 30 days
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
  await createFolder('./response/covid');
  await createFolder('./response/covid/countries');
  await createFolder('./response/vaccine');
  await createFolder('./response/vaccine/countries');
  // update data immediately
  await updateCovid();
  await updateNews();
  await updateVaccine();
  // set schedule to update data at 6:00 UTC every day
  schedule.scheduleJob('0 6 * * *', () => updateCovid());
  // set schedule to update vaccine data at 13:00 UTC every day
  schedule.scheduleJob('0 13 * * *', () => updateVaccine());
  // set schedule to update news every hour
  schedule.scheduleJob('0 * * * *', () => updateNews());
}
