const fs = require('fs/promises');
const path = require('path');
const csv = require('csvtojson');
const fetch = require('node-fetch');

const express = require('express');
const {F_OK} = require('constants');
const app = express();

app.get('/', function(req, res) {
  res.send('Hello World!');
});

app.use(express.static('public'));

app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});

// create folder to store source data
const dirPath = path.join(__dirname, 'sourceData');
fs.access(dirPath, F_OK)
  .catch(() => fs.mkdir(dirPath))
  .then(() => console.log('Folder created: ' + dirPath))
  .catch((err) => console.log(err));

// const url = 'https://raw.githubusercontent.com/datasets/covid-19/main/data/time-series-19-covid-combined.csv';
// const countriesCsvUrl = 'https://raw.githubusercontent.com/datasets/covid-19/main/data/countries-aggregated.csv';

const TimeSeriesCsvUrl = 'http://localhost:3000/time-series-19-covid-combined.csv';
const countriesCsvUrl = 'http://localhost:3000/countries-aggregated.csv';
Promise.all([
  fetchCsvToJSON(TimeSeriesCsvUrl),
  fetchCsvToJSON(countriesCsvUrl)
]).then((rawData) => createFile(rawData));

function createFile(rawData) {
  const startTime = Date.now();
  const [timeSeriesData, countriesData] = rawData;
  const allData = {};

  for (const item of countriesData) {
    const countryKey = item['Country'];
    if (countryKey === 'Taiwan*') {
      continue;
    } else if (!allData[countryKey]) {
      // initialize country key
      allData[countryKey] = {};
      allData[countryKey].data = [];
      allData[countryKey].provinces = {};
    }
    // push country data
    allData[countryKey].data.push(item);
  }


  for (const item of timeSeriesData) {
    const countryKey = item['Country/Region'];
    const provinceKey = item['Province/State'];

    // initialize province key
    if (provinceKey && !allData[countryKey].provinces[provinceKey]) {
      allData[countryKey].provinces[provinceKey] = {};
      allData[countryKey].provinces[provinceKey].data = [];
    }

    if (countryKey === 'Taiwan*') {
      // Taiwan's data
      if (!allData['China'].provinces['Taiwan']) {
        allData['China'].provinces['Taiwan'] = {};
        allData['China'].provinces['Taiwan'].data = [];
      }
      allData['China'].provinces['Taiwan'].data.push(item);
    } else if (provinceKey) {
      // push province data
      allData[countryKey].provinces[provinceKey].data.push(item);
    }
  }

  for (const country of Object.keys(allData)) {
    const path = './public/countries/' + country + '.json';
    const dataStr = JSON.stringify(allData[country]);
    fs.writeFile(path, dataStr)
      .then(() => console.log('File created: ' + path))
      .catch((err) => console.log(err));
  }

  const endTime = Date.now();
  const time = endTime - startTime;
  console.log('normalizeData time: ' + time + 'ms');
}

function fetchCsvToJSON(url) {
  return fetch(url, {
    method: 'get'
  }).then((body) => {
    if (body.ok) {
      console.log('fetch:');
      console.log(body);
      return body.text();
    } else {
      throw new Error('Request failed: ' +
        body.status + ' ' + body.statusText);
    }
  }).catch((err) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fetchData(url));
      }, 500);
    });
  }).then((str) => csv().fromString(str));
}
