const fs = require('fs/promises');
const path = require('path');
const csv = require('csvtojson');
const xml2js = require('xml2js');
const schedule = require('node-schedule');
const fetch = require('node-fetch');
const express = require('express');
const {F_OK} = require('constants');

initialize();

async function initialize() {
  // initialize server
  const app = express();
  app.get('/', function(req, res) {
    res.send('Hello World!');
  });
  app.use(express.static('public'));
  app.listen(3100, function() {
    console.log('Covid 19 API is listening on port 3100');
  });

  // create folder to store data
  await createFolder(path.join(__dirname, 'response'));
  await createFolder(path.join(__dirname, 'response/countries'));

  // set schedule to update data
  setSchedule();

  // update data immediately
  updateData();
  updateNews();
}

async function createFolder(dirPath) {
  try {
    await fs.access(dirPath, F_OK);
  } catch (e) {
    await fs.mkdir(dirPath);
    console.log('Folder created: ' + dirPath);
  }
}

function setSchedule() {
  const rule = new schedule.RecurrenceRule();
  rule.hour = 14;
  rule.minute = 0;
  rule.tz = 'UTC+8';
  schedule.scheduleJob(rule, () => {
    updateData();
    updateNews();
  });
}

function updateNews() {
  const newsUrl = 'http://localhost:3100/nCov2019.xml';
  // const newsUrl = 'https://rsshub.app/telegram/channel/nCov2019';
  const parser = new xml2js.Parser({explicitArray: false, ignoreAttrs: true});
  fetch(newsUrl)
    .then((res) => res.text())
    .then((xml) => parser.parseStringPromise(xml))
    .catch((err) => console.log(err))
    .then((result) => {
      const path = './response/news.json';
      const dataStr = JSON.stringify(result.rss.channel.item);
      // clear the folder first
      return fs.writeFile(path, dataStr);
    })
    .then(() => console.log('File created: ./response/news.json'))
    .catch((err) => console.log(err));
}

function updateData() {
  // const url = 'https://raw.githubusercontent.com/datasets/covid-19/main/data/time-series-19-covid-combined.csv';
  // const countriesCsvUrl = 'https://raw.githubusercontent.com/datasets/covid-19/main/data/countries-aggregated.csv';

  const TimeSeriesCsvUrl = 'http://localhost:3100/time-series-19-covid-combined.csv';
  const countriesCsvUrl = 'http://localhost:3100/countries-aggregated.csv';
  Promise.all([
    fetchCsvToJSON(TimeSeriesCsvUrl),
    fetchCsvToJSON(countriesCsvUrl)
  ]).then((rawData) => {
    const data = normalizeData(rawData);
    createCountriesJSON(data);
    createTodayJSON(data);
  });
}

async function createCountriesJSON(data) {
  await clearFolder('./response/countries/');
  for (const country of Object.keys(data)) {
    const path = './response/countries/' + country + '.json';
    const dataStr = JSON.stringify(data[country]);
    await fs.writeFile(path, dataStr);
    console.log('File created: ' + path);
  }
}

function createTodayJSON(data) {
  const todayData = {};

  for (const country of Object.keys(data)) {
    todayData[country] = {
      data: data[country].data.slice(-1)[0]
    };

    const provinces = data[country].provinces;
    const provincesKeys = Object.keys(provinces);
    if (provincesKeys.length) {
      todayData[country].provinces = {};
      for (const province of provincesKeys) {
        todayData[country].provinces[province] = {
          data: provinces[province].data.slice(-1)[0]
        };
      }
    }
  }

  const path = './response/todayData.json';
  const dataStr = JSON.stringify(todayData);
  return fs.writeFile(path, dataStr)
    .then(() => console.log('File created: ' + path))
    .catch((err) => console.log(err));
}


async function clearFolder(path) {
  try {
    const files = await fs.readdir(path);
    for (const file of files) {
      await fs.unlink(path + '/' + file);
    }
  } catch (err) {
    console.log(err);
  }
};

function normalizeData(rawData) {
  const startTime = Date.now();
  const [timeSeriesData, countriesData] = rawData;
  const result = {};

  // country data
  for (let item of countriesData) {
    const countryKey = item['Country'];
    if (countryKey === 'Taiwan*') {
      continue; // Taiwan is a province of China
    } else if (!result[countryKey]) {
      // initialize country key
      result[countryKey] = {
        data: [],
        provinces: {}
      };
    }

    // calculate incremental data
    const countryData = result[countryKey].data;
    if (countryData.length) {
      const lastDayData = countryData[countryData.length - 1];
      item = {
        ...item,
        ConfirmedIncr: item.Confirmed - lastDayData.Confirmed,
        RecoveredIncr: item.Recovered - lastDayData.Recovered,
        DeathsIncr: item.Deaths - lastDayData.Deaths
      };
    }

    // push country data
    countryData.push(item);
  }


  // province data
  for (let item of timeSeriesData) {
    let countryKey;
    let provinceKey;

    // Taiwan belongs to China
    if (countryKey === 'Taiwan*') {
      countryKey = 'China';
      provinceKey = 'Taiwan';
    } else if (!item['Province/State']) {
      continue; // no province data, continue
    } else {
      countryKey = item['Country/Region'];
      provinceKey = item['Province/State'];
    }

    // initialize province key
    if (!result[countryKey].provinces[provinceKey]) {
      result[countryKey].provinces[provinceKey] = {
        data: []
      };
    }

    // calculate incremental data
    const provinceData = result[countryKey].provinces[provinceKey].data;
    if (provinceData.length) {
      const lastDayData = provinceData[provinceData.length - 1];
      item = {
        ...item,
        ConfirmedIncr: item.Confirmed - lastDayData.Confirmed,
        RecoveredIncr: item.Recovered - lastDayData.Recovered,
        DeathsIncr: item.Deaths - lastDayData.Deaths
      };
    }

    // push province data
    provinceData.push(item);
  }

  const endTime = Date.now();
  const time = endTime - startTime;
  console.log('normalizeData time: ' + time + 'ms');

  return result;
}

let retryCount = 0;
function fetchCsvToJSON(url) {
  return fetch(url, {
    method: 'get'
  }).then((body) => {
    if (body.ok) {
      return body.text();
    } else {
      throw new Error('Request failed: ' +
        body.status + ' ' + body.statusText);
    }
  }).catch((err) => {
    console.log(err);
    if (retryCount < 10) {
      retryCount++;
      console.log('Retrying...');
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(fetch(url, {method: 'get'}));
        }, 3100 * retryCount);
      });
    } else {
      retryCount = 0;
      return Promise.reject(new Error('Network error.'));
    }
  }).then((str) => csv().fromString(str));
}
