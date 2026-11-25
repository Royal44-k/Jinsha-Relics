// A host override still opens the preserved V9 game. A full URL can point
// at another explicit archived build or fixture, including its query string.
module.exports = function legacyEntry(port = 5186, override = process.env.JINSHA_URL) {
  const origin = 'http://127.0.0.1:' + port + '/';
  const url = new URL(override || origin, origin);
  if (url.pathname === '/') url.pathname = '/forest.html';
  return url.href;
};
