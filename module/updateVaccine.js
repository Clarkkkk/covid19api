import fs from 'fs/promises';
import csv from 'csvtojson';
import {
  clearFolder,
  readJSONFile,
  iso3To2,
  Checker
} from '../utils/index.js';

const url = process.env.NODE_ENV === 'development' ?
  'http://localhost:3100/vaccinations.csv' :
  'https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/vaccinations.csv';

const checker = new Checker(url, 1800);

async function updateVaccine() {
  const csvStr = await checker.checkUpdate();

  if (!csvStr) return;

  const rawData = await csv({checkType: true}).fromString(csvStr);
  const data = normalizeData(rawData);
  await createCountriesJSON(data);
  await createTodayJSON(data);
  await updateCovidJSON(data);
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
    // abandon continent's data
    if (!iso3To2[countryKey]) continue;
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
    const fileName = item.iso.toLowerCase();
    const path = `./response/vaccine/countries/${fileName}.json`;
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

async function updateCovidJSON(dataArr) {
  const worldCovidPath = './response/covid/countries/world.json';
  const worldCovidData = await readJSONFile(worldCovidPath);
  const countries = worldCovidData.provinces;
  for (const item of dataArr) {
    const vaccineData = item.data;
    const fileName = item.iso.toLowerCase();
    const path = `./response/covid/countries/${fileName}.json`;
    let index = -1;
    try {
      let covidObj;
      if (item.country === 'World') {
        covidObj = worldCovidData;
      } else {
        covidObj = await readJSONFile(path);
      }
      const covidData = covidObj.data;
      for (const covidDataEntry of covidData) {
        if (covidDataEntry.Date === vaccineData[0].date) {
          index = 0;
        }

        if (index >= 0 && covidDataEntry.Date === vaccineData[index]?.date) {
          Object.assign(covidDataEntry, {
            total: vaccineData[index].total,
            totalPerHundred: vaccineData[index].totalPerHundred,
            daily: vaccineData[index].daily,
            dailyPerMillion: vaccineData[index].dailyPerMillion
          });
          index++;
        }
      }
      await fs.writeFile(path, JSON.stringify(covidObj));
    } catch (err) {
      console.log(err.message);
      continue;
    }

    const countryObj =
      countries.find((entry) => entry.iso === item.iso);
    if (countryObj) {
      for (const covidDataEntry of countryObj.data) {
        if (covidDataEntry.Date === vaccineData[0].date) {
          index = 0;
        }

        if (index >= 0 && covidDataEntry.Date === vaccineData[index]?.date) {
          Object.assign(covidDataEntry, {
            total: vaccineData[index].total,
            totalPerHundred: vaccineData[index].totalPerHundred,
            daily: vaccineData[index].daily,
            dailyPerMillion: vaccineData[index].dailyPerMillion
          });
          index++;
        }
      }
    }
  }
  await fs.writeFile(worldCovidPath, JSON.stringify(worldCovidData));
  console.log('Added vaccine data to covid files.');
}

export default updateVaccine;
