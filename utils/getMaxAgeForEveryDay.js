function getMaxAgeForEveryDay(hour) {
  const now = new Date(Date.now());
  // data expires at 13:00 UTC every day
  let expire = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour
  );
  // if it's later than ${hour}:00 currently
  // data expires at ${hour}:00 in the next day
  if (now.getUTCHours() >= hour) {
    expire += 24 * 60 * 60 * 1000;
  }
  return Math.floor((expire - Date.now()) / 1000);
}

export default getMaxAgeForEveryDay;
