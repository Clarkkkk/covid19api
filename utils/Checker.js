import crypto from 'crypto';
import fetchText from './fetchText.js';

export default class Checker {
  constructor(url, interval, retryTimes = 6) {
    this._url = url;
    this._interval = interval;
    this._retryTimes = retryTimes;
    this._md5;
  }

  async checkUpdate() {
    let same = false;
    let retryCount = 0;
    let str;
    do {
      str = await fetchText(this._url);
      same = this._checkMd5(str);
      if (same) {
        console.log('Data not updated yet.');
        await this._wait();
      } else {
        break;
      }
      retryCount++;
    } while (retryCount < this._retryTimes);
    return same ? '' : str;
  }

  async _wait() {
    await new Promise((resolve) => {
      setTimeout(() => resolve(), this._interval * 1000);
    });
  }

  _checkMd5(str) {
    const hash = crypto.createHash('md5');
    hash.update(str, 'utf8');
    const currentMd5 = hash.digest('hex');
    const same = this._md5 === currentMd5;
    this._md5 = currentMd5;
    return same;
  }
}
