const log  = require('./log.js').log;
const plural  = require('./plural.js').plural;

function headers(h1, h2, argv) {

  log("HTTP Header",'title');

  delete h1['date'];
  delete h2['date'];

  if (argv['simulate']) delete h1['transfer-encoding']

  let headerDiffs = 0;
  let seen = [];
  for (let key of Object.keys(h1)) {
    let headerDiff = false;
    if (h1[key] !== h2[key]) {
      headerDiff = true;
      headerDiffs = headerDiffs + 1;
    }
    //log(`${argv['name1']} ${key} = ${h1[key]}`,headerDiff);
    //log(`${argv['name1']} ${key} = ${h2[key]}`,headerDiff);
    log(`${argv['name1']} ${key} = ${h1[key]}`);
    log(`${argv['name2']} ${key} = ${h2[key]}`);
    seen.push(key);
  }

  for (let key of Object.keys(h2)) {
    if (seen.includes(key)) continue;
    headerDiff = true;
    headerDiffs = headerDiffs + 1;
    //log(`${argv['name1']} ${key} = ${h1[key]}`,headerDiff);
    //log(`${argv['name1']} ${key} = ${h2[key]}`,headerDiff);
    log(`${argv['name1']} ${key} = ${h1[key]}`);
    log(`${argv['name2']} ${key} = ${h2[key]}`);
}

  let msg = `${headerDiffs} difference${plural(headerDiffs)}`;
  console.log('-'.repeat(4));
  return;
  if (headerDiffs === 0) {
    log(msg,'pass-summary');
    return 0;
  } else {
    log(msg,'fail-summary');
    return 1;
  }
}
module.exports.headers = headers;