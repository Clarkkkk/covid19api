import fs from 'fs/promises';
import csv from 'csvtojson';
import {
  clearFolder,
  fetchText,
  Checker,
  countryCode,
  provinceCode
} from '../utils/index.js';

const url = process.env.NODE_ENV === 'development' ?
  'http://localhost:3100' :
  'https://raw.githubusercontent.com/datasets/covid-19/main/data';
const TimeSeriesUrl = url + '/time-series-19-covid-combined.csv';
const countriesUrl = url + '/countries-aggregated.csv';
const worldUrl = url + '/worldwide-aggregate.csv';

const checker = new Checker(worldUrl, 1800);

async function updateCovid() {
  const worldCsv = await checker.checkUpdate();

  if (!worldCsv) return;

  const worldData = await csv({checkType: true}).fromString(worldCsv);
  const timeSeriesData = await fetchCsvToJSON(TimeSeriesUrl);
  const countriesData = await fetchCsvToJSON(countriesUrl);
  const data = normalizeData(timeSeriesData, countriesData, worldData);
  await createCountriesJSON(data);
  await createTodayJSON(data);
}

async function fetchCsvToJSON(url) {
  const csvStr = await fetchText(url);
  return csv({checkType: true}).fromString(csvStr);
}

function normalizeData(timeSeriesData, countriesData, worldData) {
  const startTime = Date.now();
  const dataObj = {};

  // world data
  dataObj['World'] = {
    data: [],
    iso: countryCode['World'],
    provinces: {} // countries data
  };

  for (let item of worldData) {
    const data = dataObj['World'].data;
    item.CurrentConfirmed = item.Confirmed - item.Deaths - item.Recovered;
    item = addIncrData(item, data);
    data.push(item);
  }


  // country data
  for (let item of countriesData) {
    const countryKey = item['Country'];
    if (countryKey === 'Taiwan*') {
      continue; // Taiwan is a province of China
    } else if (!dataObj[countryKey]) {
      // initialize country key
      dataObj[countryKey] = {
        iso: countryCode[countryKey],
        data: [],
        provinces: {}
      };
    }

    // calculate incremental data
    const countryData = dataObj[countryKey].data;
    item.CurrentConfirmed = item.Confirmed - item.Deaths - item.Recovered;
    item = addIncrData(item, countryData);

    // push country data
    countryData.push(item);
    // world data contains countries data as well
    if (!dataObj['World'].provinces[countryKey]) {
      dataObj['World'].provinces[countryKey] = {
        iso: countryCode[countryKey],
        data: countryData
      };
    }
  }


  // province data
  for (let item of timeSeriesData) {
    let countryKey;
    let provinceKey;

    // Taiwan belongs to China
    if (item['Country/Region'] === 'Taiwan*') {
      countryKey = 'China';
      provinceKey = 'Taiwan';
    } else if (!item['Province/State']) {
      continue; // no province data, continue
    } else {
      countryKey = item['Country/Region'];
      provinceKey = item['Province/State'];
    }

    // initialize province key
    if (!dataObj[countryKey].provinces[provinceKey]) {
      dataObj[countryKey].provinces[provinceKey] = {
        iso: provinceCode[provinceKey] || '',
        data: []
      };
    }

    // calculate incremental data
    const provinceData = dataObj[countryKey].provinces[provinceKey].data;
    item.CurrentConfirmed = item.Confirmed - item.Deaths - item.Recovered;
    item = addIncrData(item, provinceData);

    // push province data
    provinceData.push(item);
  }


  // turn dataObj to array structure
  const result = [];
  for (const country of Object.keys(dataObj)) {
    const provinces = [];
    const provincesKeys = Object.keys(dataObj[country].provinces);
    for (const province of provincesKeys) {
      provinces.push({
        province,
        data: dataObj[country].provinces[province].data,
        iso: dataObj[country].provinces[province].iso
      });
    }
    result.push({
      country,
      iso: dataObj[country].iso,
      data: dataObj[country].data,
      provinces
    });
  }

  const endTime = Date.now();
  const time = endTime - startTime;
  console.log('normalizeData time: ' + time + 'ms');

  // the data would be used in different functions
  // thus should not be changed
  return deepFreeze(result);
}

async function createCountriesJSON(dataArr) {
  await clearFolder('./response/covid/countries/');
  for (const item of dataArr) {
    // skip the data of Diamond Princess and MS Zaandam
    if (!item.iso) continue;
    const fileName = item.iso.toLowerCase();
    const path = `./response/covid/countries/${fileName}.json`;
    const dataStr = JSON.stringify(item);
    await fs.writeFile(path, dataStr);
  }
  console.log('Countries\'s JSONs created.');
}

function addIncrData(item, arr) {
  if (arr.length) {
    const lastItem = arr[arr.length - 1];
    return {
      ...item,
      ConfirmedIncr: item.Confirmed - lastItem.Confirmed,
      CurrentConfirmedIncr: item.CurrentConfirmed - lastItem.CurrentConfirmed,
      RecoveredIncr: item.Recovered - lastItem.Recovered,
      DeathsIncr: item.Deaths - lastItem.Deaths,
      updateTime: Date.now()
    };
  } else {
    return {
      ...item,
      ConfirmedIncr: item.Confirmed,
      CurrentConfirmedIncr: item.CurrentConfirmed,
      RecoveredIncr: item.Recovered,
      DeathsIncr: item.Deaths,
      updateTime: Date.now()
    };
  }
}

async function createTodayJSON(dataArr) {
  const todayData = [];

  // extract the data of latest day for countries and provinces
  for (const item of dataArr) {
    const provinces = [];
    if (item.country !== 'World') {
      for (const obj of item.provinces) {
        provinces.push({
          province: obj.province,
          iso: obj.iso,
          data: obj.data.slice(-1)[0]
        });
      }
    }

    todayData.push({
      country: item.country,
      iso: item.iso,
      data: item.data.slice(-1)[0],
      provinces
    });
  }

  const path = './response/covid/latest.json';
  const dataStr = JSON.stringify(todayData);
  await fs.writeFile(path, dataStr);
  console.log('File created: ' + path);
}

function deepFreeze(ref) {
  if (Array.isArray(ref)) {
    for (const item of ref) {
      if (typeof item === 'object') {
        deepFreeze(item);
      }
    }
  } else if (typeof ref === 'object') {
    for (const prop of Object.keys(ref)) {
      if (typeof ref[prop] === 'object') {
        deepFreeze(ref[prop]);
      }
    }
  }
  return Object.freeze(ref);
}

export default updateCovid;
