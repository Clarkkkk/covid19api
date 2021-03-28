import fs from 'fs/promises';
import {F_OK} from 'constants';

export default async function readJSONFile(filePath) {
  try {
    await fs.access(filePath, F_OK);
    const str = await fs.readFile(filePath, {encoding: 'utf-8'});
    return JSON.parse(str);
  } catch (err) {
    console.log('File not existed: ' + filePath);
    console.log(err);
    return Promise.reject(err);
  }
}
