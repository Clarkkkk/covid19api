import fs from 'fs/promises';
import {F_OK} from 'constants';

async function createFolder(dirPath) {
  try {
    await fs.access(dirPath, F_OK);
  } catch (e) {
    await fs.mkdir(dirPath);
    console.log('Folder created: ' + dirPath);
  }
}

export default createFolder;
