import fs from 'fs/promises';

async function getLastModified(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return new Date(stats.mtimeMs);
  } catch (e) {
    return Promise.reject(e);
  }
}

export default getLastModified;
