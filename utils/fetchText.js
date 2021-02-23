import fetch from 'node-fetch';

let retryCount = 0;
async function fetchText(url) {
  try {
    const body = await fetch(url, {method: 'get'});
    if (body.ok) {
      return body.text();
    } else {
      throw new Error('Request failed: ' +
        body.status + ' ' + body.statusText);
    }
  } catch (err) {
    console.log(err);
    if (retryCount < 10) {
      console.log('Retrying...');
      retryCount++;
      await wait(3500 * retryCount);
      return fetchText(url);
    } else {
      retryCount = 0;
      return Promise.reject(new Error('Network error.'));
    }
  }
}

function wait(t) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), t);
  });
}

export default fetchText;
