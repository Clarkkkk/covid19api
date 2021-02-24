import schedule from 'node-schedule';
import helmet from 'helmet';
import express from 'express';
import updateData from './module/updateData.js';
import updateNews from './module/updateNews.js';
import respondFile from './utils/respondFile.js';
import createFolder from './utils/createFolder.js';

// initialize server
const app = express();
app.use(
  helmet({
    dnsPrefetchControl: {allow: true},
    referrerPolicy: {policy: ['same-origin']}
  })
);

app.get('/', function(req, res) {
  console.log(req);
  res.send('Covid 19 API.');
});

app.get('/latest', function(req, res) {
  console.log(req);
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
  const maxAge = expire - Date.now() + 60000;
  const filePath = './response/todayData.json';
  respondFile(res, filePath, maxAge);
});

app.get('/news', function(req, res) {
  console.log(req);
  const filePath = './response/news.json';
  respondFile(res, filePath, 1800000);
});

app.get('/countries/:country', (req, res) => {
  console.log(req);
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
  const country = req.params.country;
  const filePath = './response/countries/' + country + '.json';
  respondFile(res, filePath, maxAge);
});

app.use(express.static('public'));
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
