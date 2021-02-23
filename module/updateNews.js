import fs from 'fs/promises';
import xml2js from 'xml2js';
import fetchText from '../utils/fetchText.js';

async function updateNews() {
  const newsUrl = process.env.NODE_ENV === 'development' ?
    'http://localhost:3100/nCov2019.xml' :
    'https://rsshub.app/telegram/channel/nCov2019';
  const parser = new xml2js.Parser({explicitArray: false, ignoreAttrs: true});
  const xml = await fetchText(newsUrl);
  try {
    const data = await parser.parseStringPromise(xml);
    const dataStr = JSON.stringify(data.rss.channel.item);
    const path = './response/news.json';
    // clear the folder first
    await fs.writeFile(path, dataStr);
    console.log('File created: ' + path);
  } catch (err) {
    console.log(err);
  }
}

export default updateNews;
