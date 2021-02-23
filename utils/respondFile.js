import fs from 'fs/promises';
import {F_OK} from 'constants';

function respondFile(res, filePath, maxAge) {
  const options = {
    root: import.meta.url,
    maxAge
  };
  fs.access(filePath, F_OK).then(() => {
    res.sendFile(filePath, options, (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log('File sent: ' + filePath);
      }
    });
  }).catch((err) => {
    console.log('File not existed: ' + filePath);
    console.log(err);
    res.sendStatus(404);
  });
}

export default respondFile;
