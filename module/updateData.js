import fs from 'fs/promises';
import csv from 'csvtojson';
import fetchText from '../utils/fetchText.js';
import clearFolder from '../utils/clearFolder.js';

async function updateData() {
  const url = process.env.NODE_ENV === 'development' ?
    'http://localhost:3100' :
    'https://raw.githubusercontent.com/datasets/covid-19/main/data';
  const TimeSeriesUrl = url + '/time-series-19-covid-combined.csv';
  const countriesUrl = url + '/countries-aggregated.csv';
  const timeSeriesData = await fetchCsvToJSON(TimeSeriesUrl);
  const countriesData = await fetchCsvToJSON(countriesUrl);
  const data = normalizeData(timeSeriesData, countriesData);
  await createCountriesJSON(data);
  await createTodayJSON(data);
}

async function fetchCsvToJSON(url) {
  const csvStr = await fetchText(url);
  return csv().fromString(csvStr);
}

function normalizeData(timeSeriesData, countriesData) {
  const startTime = Date.now();
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

async function createCountriesJSON(data) {
  await clearFolder('./response/countries/');
  for (const country of Object.keys(data)) {
    const path = './response/countries/' + country + '.json';
    const dataStr = JSON.stringify(data[country]);
    await fs.writeFile(path, dataStr);
    // console.log('File created: ' + path);
  }
  console.log('Countries\'s JSONs created.');
}

async function createTodayJSON(data) {
  const todayData = {};

  // extract the data of latest day for countries and provinces
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
  await fs.writeFile(path, dataStr);
  console.log('File created: ' + path);
}

export default updateData;
