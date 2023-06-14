const log  = require('./log.js').log;
const plural  = require('./plural.js').plural;

function info(infos, argv) {

  let infoDiffs = 0;
  function equals(a,b,name) {

    if (typeof a != typeof b) {
      //log(`${argv['name1']} type = ${typeof a}`,true);
      //log(`${argv['name2']} type = ${typeof b}`,true);
      infoDiffs++;
      return false;
    }

    if (a === null && b === null) {
      //log(`${argv['name1']} ${null}`,false);
      //log(`${argv['name2']} ${null}`,false);
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
      }
      let ldiff = false;
      if (a.length != b.length) {
        infoDiffs++;
        ldiff = true;
      }
      log(`${argv['name1']}.length = ${a.length}`,ldiff);
      log(`${argv['name2']}.length = ${b.length}`,ldiff);
      return diff == true || ldiff == true;
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
          log(`${argv['name1']} ${name}['${key}'] = ${a[key]}`,diff);
          log(`${argv['name2']} ${name}['${key}'] = ${b[key]}`,diff);
        }
        seen.push(key);
      }
      for (let key of Object.keys(b)) {
        let diff = false;
        if (seen.includes(key)) continue;
        diff = true;
        diffs++;
        infoDiffs++;
        log(`${argv['name1']} ${name}['${key}'] = ${a[key]}`,diff);
        log(`${argv['name2']} ${name}['${key}'] = ${b[key]}`,diff);
      }
      return diffs.length > 0;
    }

    return true;
  }


  function namecheck(p1, p2) {

    let ldiff = false;
    if (p1.length != p2.length) {
      infoDiffs++;
      ldiff = true;
    }
    log(`${argv['name1']} parameters.length = ${p1.length}`,ldiff);
    log(`${argv['name2']} parameters.length = ${p2.length}`,ldiff);

    let ndiff = false;
    for (let p in p1) {
      ndiff = false;
      if (p1[p]['name'] !== p2[p]['name']) {
        infoDiffs++;
        ndiff = true;
        log(`${argv['name1']} parameters[${p}]['name'] = ${p1[p]['name']}`,ndiff);
        log(`${argv['name2']} parameters[${p}]['name'] = ${p2[p]['name']}`,ndiff);
      }
    }

    return ldiff == true || ndiff == true;
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

  if (argv['namesonly']) {
    namecheck(infos[0]['parameters'],infos[1]['parameters']);
  } else {
    equals(infos[0],infos[1],'info');    
  }

  let post = "";
  if (argv['namesonly']) {
    let np = infos[0].parameters.length;
    post = ` in ${np} parameter name${plural(np)}`;
  }
  let msg = `${infoDiffs} difference${plural(infoDiffs)}${post}`;
  console.log('-'.repeat(4));
  if (infoDiffs === 0) {
    log(msg,'pass-summary');
    return 0;
  } else {
    log(msg,'fail-summary');
    return 1;
  }
}
module.exports.info = info;