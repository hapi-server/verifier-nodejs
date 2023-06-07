const log      = require('./log.js').log;
const timings  = require('./timings.js').timings;
const headers  = require('./headers.js').headers;
const info     = require('./info.js').info;
const csv      = require('./csv.js').csv;

function report(argv, infos, data) {

  log.argv = argv;

  let errs = 0;

  if (data != null) {
    errs += timings(data[0]['timing'], data[1]['timing'], argv);
    errs += headers(data[0]['headers'], data[1]['headers'], argv)
  }

  // Get matching info parameters until difference
  errs += info(infos, argv);

  if (data == null) {
    return errs;
  } 

  let ct1 = data[0]['headers']['content-type'];
  let ct2 = data[1]['headers']['content-type'];
  if (ct1.includes('csv') && ct2.includes('csv')) {
    errs += csv(data[0]['body'], data[1]['body'], infos[0], argv);
  } else {
    log("content-types are not both csv",true);
    errs += 1;
  }
  return errs;
}
exports.report = report;