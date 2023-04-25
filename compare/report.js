const clc  = require('chalk');
function plural(v) {return v > 1 || v == 0 ? "s" : "";}

function report(argv, infos, data) {

  log.argv = argv;

  let errs = 0;
  errs += timings(data[0]['timing'], data[1]['timing'], argv);
  errs += headers(data[0]['headers'], data[1]['headers'], argv)

  // Get matching info parameters until difference
  errs += info(infos, argv);

  let ct1 = data[0]['headers']['content-type'];
  let ct2 = data[1]['headers']['content-type'];

  if (ct1.includes('csv') && ct2.includes('csv')) {
    errs += csv(data[0]['body'], data[1]['body'], infos[0], argv);
  } else {
    log("content-types are not both csv",true);
    errs += 1;
  }
}
exports.report = report;

function log(msg, msgType) {

  if (msgType === true)
    console.log(clc.red(' ✗ ') + msg);
  if (msgType === false && log.argv['showpasses'] === true)
    console.log(clc.green(' ✓ ') + msg);
  if (msgType === 'title')
    console.log("\n" + clc.blue(msg));
  if (msgType === 'pass-summary')
    console.log(clc.green(' ✓ ' + msg));
  if (msgType === 'fail-summary')
    console.log(clc.red(' ✗ ' + msg));
}

function timings(timing1, timing2, argv) {

  const TIMEFRACTION = parseFloat(argv['timefraction']);

  log(`Timings (|diff|/ave values >= ${TIMEFRACTION})`,'title');

  let timingDiffs = 0;
  for (let key of Object.keys(timing1)) {
  
    timingDiff = false;

    let val1 = parseFloat(timing1[key]);
    let val2 = parseFloat(timing2[key]);
    let ave = (val1 + val2);

    if (Math.abs(val1 - val2)/ave >= TIMEFRACTION) {
      timingDiff = true;
      timingDiffs = timingDiffs + 1;
    }

    log(`1 ${key} = ${val1}`,timingDiff);
    log(`2 ${key} = ${val2}`,timingDiff);
  }

  let msg = `${timingDiffs} |diff|/ave value${plural(timingDiffs)} >= ${TIMEFRACTION}`;
  console.log('-'.repeat(4));
  if (timingDiffs === 0) {
    log(msg,'pass-summary');
    return 0;
  } else {
    log(msg,'fail-summary');
    return 1;
  }
}

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
    log(`1 ${key} = ${h1[key]}`,headerDiff);
    log(`2 ${key} = ${h2[key]}`,headerDiff);
    seen.push(key);
  }

  for (let key of Object.keys(h2)) {
    if (seen.includes(key)) continue;
    headerDiff = true;
    headerDiffs = headerDiffs + 1;
    log(`1 ${key} = ${h1[key]}`,headerDiff);
    log(`2 ${key} = ${h2[key]}`,headerDiff);
  }

  let msg = `${headerDiffs} difference${plural(headerDiffs)}`;
  console.log('-'.repeat(4));
  if (headerDiffs === 0) {
    log(msg,'pass-summary');
    return 0;
  } else {
    log(msg,'fail-summary');
    return 1;
  }
}

function info(infos, argv) {

  let infoDiffs = 0;

  function equals(a,b,name) {

    if (typeof a != typeof b) {
      log(`1 ${name} type = ${typeof a}`,true);
      log(`1 ${name} type = ${typeof b}`,true);
      infoDiffs++;
      return false;
    }

    if (a === null && b === null) {
      log(`1 ${null}`,0);
      log(`2 ${null}`,0);
      return true;
    }

    if ('string' == typeof a || 'number' == typeof a) {
      let diff = false;
      if (a != b) {
        diff = true;
        infoDiffs++;
      }
      return diff == false;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      let diff = false;
      for (let i = 0; i < Math.min(a.length,b.length); i++) {
        if (!equals(a[i], b[i], `${name}[${i}]`)) {
          diff = true;
        }
        //log(`1 ${name}[${i}] = ${a[i]}`,diff);
        //log(`2 ${name}[${i}] = ${b[i]}`,diff);
      }
      let ldiff = false;
      if (a.length != b.length) {
        infoDiffs++;
        ldiff = true;
      }
      log(`1 ${name}.length = ${a.length}`,ldiff);
      log(`2 ${name}.length = ${b.length}`,ldiff);
      return diff == true;
    }

    if (typeof a === 'object' && typeof b === 'object') {

      if (a === null || b === null) return 1;

      let diffs = 0;
      let seen = [];
      for (let key of Object.keys(a)) {
        let diff = false;
        if (!equals(a[key], b[key], `${name}[${key}]`)) {
          diff = true;
          diffs++;
        }
        if (typeof a[key] !== 'object' && a !== null) {
          log(`1 ${name}['${key}'] = ${a[key]}`,diff);
          log(`2 ${name}['${key}'] = ${b[key]}`,diff);
        }
        seen.push(key);
      }
      for (let key of Object.keys(b)) {
        let diff = false;
        if (seen.includes(key)) continue;
        diff = true;
        diffs++;
        infoDiffs++;
        log(`1 ${key} = ${a[key]}`,diff);
        log(`2 ${key} = ${b[key]}`,diff);
      }
      return diffs.length > 0;
    }

    return true;
  }

  log("/info",'title');

  if (argv['simulate']) {
    delete infos[0]['startDate'];
    infos[0]['parameters'][0]['name'] += 'x';
    //delete infos[1]['parameters'][1];
    infos[1]['parameters'] = infos[1]['parameters'].slice(0,1);
  }
  delete infos[0]['status'];
  delete infos[1]['status'];

  equals(infos[0],infos[1],'info');

  let msg = `${infoDiffs} difference${plural(infoDiffs)}`;
  console.log('-'.repeat(4));
  if (infoDiffs === 0) {
    log(msg,'pass-summary');
    return 0;
  } else {
    log(msg,'fail-summary');
    return 1;
  }
}

function csv(b1, b2, infoc, argv) {

  log("CSV Data",'title');

  if (argv['simulate']) {
    b1 = b1.trimEnd();
    b2 = b2.trimEnd();
    b1 = b1.split("\n");
    b1 = b1.slice(0,b1.length-1);
    b1[1] = b1[1] + "9";
    b1 = b1.join("\n");
    //console.log(b1);
    //console.log(b2);
  }

  if (b1 === b2 && log.argv['showpasses'] === false) {
    log(`No differences`,'pass-summary');
    return 0;
  }

  b1 = b1.split("\n");
  b2 = b2.split("\n");

  bodyNLinesDiff = false;
  if (b1.length !== b2.length) {
    bodyNLinesDiff = true;
  }
  log(`1 ${b1.length} lines`,bodyNLinesDiff);
  log(`2 ${b2.length} lines`,bodyNLinesDiff);

  let bodyLineDiffs = 0;
  for (let i = 0; i < Math.min(b1.length,b2.length); i++) {
    let bodyLineDiff = false;
    if (b1[i] !== b2[i]) {
      bodyLineDiff = true;
      bodyLineDiffs = bodyLineDiffs + 1;
    }
    log(`1 line ${i}: ${b1[i]}`,bodyLineDiff);
    log(`2 line ${i}: ${b2[i]}`,bodyLineDiff);
  }

  let bodyValDiffs = 0;
  let bodyNColsDiffs = 0;
  for (let i = 0; i < b1.length; i++) {
    let cols1 = b1[i].split(",");
    let cols2 = b2[i].split(",");
    let bodyNColsDiff = false;

    if (cols1.length !== cols2.length) {
      let bodyNColsDiff = true;
      bodyNColsDiffs = bodyNColsDiffs + 1;
    }
    log(`1 line ${i} ${cols1.length} columns`,bodyNColsDiff);
    log(`2 line ${i} ${cols2.length} columns`,bodyNColsDiff);

    for (let j = 0; j < Math.min(cols1.length,cols2.length); j++) {

      let bodyValDiff = false;

      cols1p = cols1[j].trim();
      cols2p = cols2[j].trim();

      parsed = false;
      if ('double' === infoc['parameters'][j]['type']) {
        // TODO: Determine if float from /info response.
        parsed = true;
        cols1p = parseFloat(cols1[j]);
        cols2p = parseFloat(cols2[j]);
      }

      if (cols1p !== cols2p) {
        bodyValDiff = true;
        bodyValDiffs = bodyValDiffs + 1;
      }

      if (parsed === true) {
        log(`1 line ${i} col ${j}:    raw: ${cols1[j]}`,bodyValDiff);
        log(`                parsed: ${cols1p}`,bodyValDiff);
        log(`2 line ${i} col ${j}:    raw: ${cols2[j]}`,bodyValDiff);
        log(`                parsed: ${cols2p}`,bodyValDiff);
      } else {
        log(`1 line ${i} col ${j}: ${cols1[j]}`,bodyValDiff);
        log(`2 line ${i} col ${j}: ${cols2[j]}`,bodyValDiff);
      }
    }
  }

  console.log('-'.repeat(4));
  if (bodyNLinesDiff === false && bodyLineDiffs === 0 &&
      bodyNColsDiffs === 0 && bodyValDiffs === 0) {
    log("No differences",'pass-summary');
    return 0;
  } else {
    if (bodyNLinesDiff === true)
      log("Number of lines differs",'fail-summary');
    if (bodyLineDiffs > 0) {
      let s = plural(bodyLineDiffs);
      log(`${bodyLineDiffs} line${s} differ`,'fail-summary');      
    }
    if (bodyNColsDiffs > 0)
      log(`Number of columns differ`,'fail-summary');
    if (bodyValDiffs > 0) {
      let s = plural(bodyValDiffs);
      log(`${bodyValDiffs} column value${s} differs`,'fail-summary');
    }
    return 1;
  }
}
