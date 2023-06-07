const clc  = require('chalk');

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
  if (msgType === undefined)
      console.log(' ' + msg);
}
module.exports.log = log;