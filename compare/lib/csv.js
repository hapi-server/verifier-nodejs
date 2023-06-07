const log  = require('./log.js').log;
const plural  = require('./plural.js').plural;

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

  let bodyNLinesDiff = false;
  if (b1.length !== b2.length) {
    bodyNLinesDiff = true;
  }
  log(`${argv.name1} ${b1.length} lines`,bodyNLinesDiff);
  log(`${argv.name2} ${b2.length} lines`,bodyNLinesDiff);

  let bodyLineDiffs = 0;
  let bodyValDiffs = 0;
  let bodyNColsDiffs = 0;
  let types = expandTypes(infoc['parameters']);

  for (let i = 0; i < b1.length; i++) {

    if (i == argv['maxrecs']) break;

    let bodyLineDiff = false;
    if (b1[i].trim() !== b2[i].trim()) {
      bodyLineDiff = true;
      bodyLineDiffs = bodyLineDiffs + 1;
    }

    log(`unparsed line ${i}`,bodyLineDiff);
    log(`  ${argv.name1}: ${b1[i]}`,bodyLineDiff);
    log(`  ${argv.name2}: ${b2[i]}`,bodyLineDiff);

    let cols1 = b1[i].split(",");
    let cols2 = b2[i].split(",");
    let bodyNColsDiff = false;

    if (cols1.length !== cols2.length) {
      bodyNColsDiffs = bodyNColsDiffs + 1;
    }
    log(`  ${argv.name1} ${cols1.length} columns`,bodyNColsDiff);
    log(`  ${argv.name2} ${cols2.length} columns`,bodyNColsDiff);

    for (let j = 0; j < Math.min(cols1.length, cols2.length); j++) {

      let bodyValDiff = false;

      cols1p = cols1[j].trim();
      cols2p = cols2[j].trim();

      parsed = false;
      
      if ('double' === types[j]) {
        parsed = true;
        cols1p = parseFloat(cols1[j]);
        cols2p = parseFloat(cols2[j]);
      }

      if (cols1p !== cols2p) {
        bodyValDiff = true;
        bodyValDiffs = bodyValDiffs + 1;
      }

      if (parsed === true) {
        log(`    ${argv.name1} col ${j}: raw: ${cols1[j]} parsed: ${cols1p}`,bodyValDiff);
        log(`    ${argv.name2} col ${j}: raw: ${cols2[j]} parsed: ${cols2p}`,bodyValDiff);
      } else {
        log(`    ${argv.name1} col ${j}: ${cols1[j]}`,bodyValDiff);
        log(`    ${argv.name2} col ${j}: ${cols2[j]}`,bodyValDiff);
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
      if (bodyLineDiffs.length == 1) {
        log(`${bodyLineDiffs} unparsed line differs`,'fail-summary');
      } else {
        log(`${bodyLineDiffs} unparsed lines differ`,'fail-summary');
      }
    }
    if (bodyNColsDiffs > 0)
      log(`Number of columns differ`,'fail-summary');
    if (bodyValDiffs > 0) {
      let s = plural(bodyValDiffs);
      log(`${bodyValDiffs} parsed column value${s} differs`,'fail-summary');
    }
    return 1;
  }
}
module.exports.csv = csv;

function expandTypes(parameters) {

  let types = [];
  for (let j = 0; j < parameters.length; j++) {
      let Nc = parameters[j]['size'] || 1;
      types.push(...repeat(parameters[j]['type'],Nc))
  }
  return types;

  function repeat(str, Nc) {
      let arr = [];
      for (i = 0; i < Nc; i++) {
          arr.push(str);
      }
      return arr
  }
}
