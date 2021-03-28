import fs from 'fs/promises';

export default async function clearFolder(path) {
  try {
    const files = await fs.readdir(path);
    for (const file of files) {
      await fs.unlink(path + '/' + file);
    }
  } catch (err) {
    console.log(err);
  }
};

