const log  = require('./log.js').log;
const plural  = require('./plural.js').plural;

function timings(timing1, timing2, argv) {

    const TIMEFRACTION = parseFloat(argv['timefraction']);
  
    log(`Timings`,'title');
  
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
  
      //log(`${argv['name1']} ${key} = ${val1}`,timingDiff);
      //log(`${argv['name2']} ${key} = ${val2}`,timingDiff);
      log(`${argv['name1']} ${key} = ${val1}`);
      log(`${argv['name2']} ${key} = ${val2}`);
    }
  
    let msg = `${timingDiffs} |diff|/ave value${plural(timingDiffs)} >= ${TIMEFRACTION}`;
    console.log('-'.repeat(4));
    return;
    if (timingDiffs === 0) {
      log(msg,'pass-summary');
      return 0;
    } else {
      log(msg,'fail-summary');
      return 1;
    }
  }
  module.exports.timings = timings;