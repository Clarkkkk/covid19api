const fs = require('fs');
const path = require('path');
const https = require('https');
const csv = require('csvtojson');

// create folder to store source data
const dirPath = path.join(__dirname, 'sourceData');
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath);
  console.log('文件夹创建成功：' + dirPath);
}

const url = 'https://raw.githubusercontent.com/datasets/covid-19/main/data/time-series-19-covid-combined.csv';
https.get(url, (res) => {
  console.log(res);
  res.setEncoding('utf8');
  let rawData = '';
  res.on('data', (chunk) => rawData += chunk);
  res.on('end', () => {
    try {
      csv({
        noheader: true,
        output: 'csv'
      }).fromString(rawData)
        .then((csv) => {
          console.log(typeof csv) // => [["1","2","3"], ["4","5","6"], ["7","8","9"]]
        });
    } catch (e) {
      console.error(e.message);
    }
  });
});


//module.exports = request;
