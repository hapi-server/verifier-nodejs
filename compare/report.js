const clc  = require('chalk');

function report(argv, info, data) {

  const SIMULATE = argv['simulate'];
  const TIMEFRACTION = parseFloat(argv['timefraction']);

  console.log(clc.blue(`Timings (|diff|/ave values >= ${TIMEFRACTION})`));

  let timingDiff = false;
  for (let key of Object.keys(data[0]['timing'])) {
    let val1 = parseFloat(data[0]['timing'][key]);
    let val2 = parseFloat(data[1]['timing'][key]);
    let timingDiff = true;
    let ave = (val1 + val2);
    if (Math.abs(val1 - val2)/ave >= TIMEFRACTION) {
      console.log(` 1 ${key} = ${val1}`);
      console.log(` 2 ${key} = ${val2}`);
    }
  }
  if (timingDiff === false) {
    console.log(` No |diff|/ave values >= ${TIMEFRACTION}`);
  }

  console.log(clc.blue("HTTP Header"));
  let headerDiff = false;

  let h1 = data[0]['headers'];
  let h2 = data[1]['headers'];
  delete h1['date'];
  delete h2['date'];

  if (SIMULATE) delete h1['transfer-encoding']

  let seen = [];
  for (let key of Object.keys(h1)) {
    if (h1[key] !== h2[key]) {
      headerDiff = true;
      console.log(` 1 ${key} = ${h1[key]}`);
      console.log(` 2 ${key} = ${h2[key]}`);
    }
    seen.push(key);
  }
  for (let key of Object.keys(h2)) {
    if (seen.includes(key)) continue;
    headerDiff = true;
    console.log(` 1 ${key} = ${h1[key]}`);
    console.log(` 2 ${key} = ${h2[key]}`);
  }
  if (headerDiff === false) {
    console.log(" No differences");
  }

  if (h1['content-type'].includes('csv') && h2['content-type'].includes('csv')) {

    console.log(clc.blue("CSV Data"))

    b1 = data[0]['body'].split("\n");
    b2 = data[1]['body'].split("\n");

    bodyNLinesDiff = false;
    if (b1.length !== b2.length) {
      console.log(` 1 ${b1.length} lines`);
      console.log(` 2 ${b2.length} lines`);
      bodyNLinesDiff = true;
    }

    let bodyExactDiff = false;
    for (let i = 0; i < b1.length; i++) {
      if (b1[i] !== b2[i]) {
        bodyExactDiff = true;
        console.log(` 1 line ${i}: ${b1[i]}`);
        console.log(` 2 line ${i}: ${b2[i]}`);
      }
    }

    let bodyValDiff = false;
    let bodyNColsDiff = false;
    for (let i = 0; i < b1.length; i++) {
      let cols1 = b1[i].split(",");
      let cols2 = b2[i].split(",");
      if (cols1.length !== cols2.length) {
          console.log(` 1 line ${i} ${cols1.length} columns`);
          console.log(` 2 line ${i} ${cols2.length} columns`);
          bodyNColsDiff = true;
          break;        
      }
      for (let j = 0; j < cols1.length; j++) {
        if (SIMULATE) cols1[j] = cols1[j] + "9";

        cols1p = cols1[j].trim();
        cols2p = cols2[j].trim();

        parsed = false;
        if (j > 0) {
          // TODO: Determine if float from /info response.
          parsed = true;
          cols1p = parseFloat(cols1[j]);
          cols2p = parseFloat(cols2[j]);
        }
        if (cols1p !== cols2p) {
          bodyValDiff = true;
          if (parsed === true) {
            console.log(` 1 line ${i} col ${j}: raw: ${cols1[j]}`);
            console.log(`              parsed: ${cols1p}`);
            console.log(` 2 line ${i} col ${j}: raw: ${cols2[j]}`);
            console.log(`              parsed: ${cols2p}`);
          }
        }
      }
    }
    if (bodyNLinesDiff === false && bodyExactDiff === false
        && bodyValDiff === false && bodyNColsDiff === false) {
      console.log(" No differences");
    }
  }
}
exports.report = report;
