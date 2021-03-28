import fs from 'fs/promises';
import csv from 'csvtojson';
import {fetchText, clearFolder, iso3To2} from '../utils/index.js';

async function updateVaccine() {
  const url = process.env.NODE_ENV === 'development' ?
    'http://localhost:3100/vaccinations.csv' :
    'https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/vaccinations.csv';
  const csvStr = await fetchText(url);
  const rawData = await csv({checkType: true}).fromString(csvStr);
  const data = normalizeData(rawData);
  await createCountriesJSON(data);
  await createTodayJSON(data);
}

function normalizeData(rawData) {
  const dataObj = {};
  for (const item of rawData) {
    const isoCode = item['iso_code'];
    if (!dataObj[isoCode]) {
      dataObj[isoCode] = {
        country: item['location'],
        data: []
      };
    }

    dataObj[isoCode].data.push({
      date: item['date'],
      total: item['total_vaccinations'],
      totalPerHundred: item['total_vaccinations_per_hundred'],
      daily: item['daily_vaccinations'] || 0,
      dailyPerMillion: item['daily_vaccinations_per_million']
    });
  }

  for (const countryKey of Object.keys(dataObj)) {
    const data = dataObj[countryKey].data;
    for (let i = 1; i < data.length; i++) {
      if (!data[i].total) {
        data[i].total = data[i - 1].total;
      }
      if (!data[i].totalPerHundred) {
        data[i].totalPerHundred = data[i - 1].totalPerHundred;
      }
    }
  }

  const result = [];
  for (const countryKey of Object.keys(dataObj)) {
    result.push({
      iso: iso3To2[countryKey],
      ...dataObj[countryKey]
    });
  }
  return result;
}

async function createCountriesJSON(dataArr) {
  await clearFolder('./response/vaccine/countries/');
  for (const item of dataArr) {
    const path = './response/vaccine/countries/' + item.iso + '.json';
    const dataStr = JSON.stringify(item);
    await fs.writeFile(path, dataStr);
  }
  console.log('Countries\'s JSONs created.');
}

async function createTodayJSON(dataArr) {
  const todayData = [];
  for (const item of dataArr) {
    todayData.push({
      country: item.country,
      iso: item.iso,
      data: item.data.slice(-1)[0]
    });
  }

  const path = './response/vaccine/latest.json';
  const dataStr = JSON.stringify(todayData);
  await fs.writeFile(path, dataStr);
  console.log('File created: ' + path);
}

export default updateVaccine;
