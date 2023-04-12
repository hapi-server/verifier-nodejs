const clc     = require('chalk');
const request = require('request');
const async   = require('async');

const argv =
        require('yargs')
          .help()
          .default({
            "port": 9998,
            "server1": "https://hapi-server.org/servers/TestData2.0/hapi",
            "server2": "https://hapi-server.org/servers/TestData2.0/hapi",
            "endpoint": "data",
            "dataset": "dataset1",
            "parameters": "scalar",
            "start": "1970-01-01Z",
            "stop": "1970-01-01T00:00:11.000Z",
            "simulate": false,
            "showpasses": false,
            "timefraction": "0.5"
          })
          .option('simulate',{'type': 'boolean'})
          .argv;

let report = require('./report.js').report;

let args_a = `?id=${argv['dataset']}&parameters=${argv['parameters']}`;
let args_b = `&time.min=${argv['start']}&time.max=${argv['stop']}`;

let url1 = argv['server1'].replace(/\/$/,"") + "/" + argv['endpoint'];
let url2 = argv['server2'].replace(/\/$/,"") + "/" + argv['endpoint'];
url1 = url1 + args_a + args_b;
url2 = url2 + args_a + args_b;

let url1i = argv['server1'].replace(/\/$/,"") + "/info";
let url2i = argv['server1'].replace(/\/$/,"") + "/info";
url1i = url1i + args_a;
url2i = url2i + args_a;

let seriesi = [(cb) => {get(url1i, "1 ", cb)}, (cb) => {get(url2i, "2 ", cb)}];
let seriesd = [(cb) => {get(url1, "1 ", cb)}, (cb) => {get(url2, "2 ", cb)}];


async.series(seriesi, 

  (err, infos) => {
    if (err) {
      console.log("Error:")
      console.error(err);
      console.log("Exiting with code 1")
      process.exit(1);
    }

    infos[0] = JSON.parse(infos[0]['body']);
    infos[1] = JSON.parse(infos[1]['body']);

    async.series(seriesd, 
      (err, data) => {
        if (err) {
          console.log("Error:")
          console.error(err);
          console.log("Exiting with code 1")
          process.exit(1);
        }
        report(argv, infos, data);
    });
});


function get(url, msgPrefix, cb) {

  console.log(msgPrefix + clc.blue('Getting ' + url));

  let opts = {"url": url, "time": true};
  request(opts,
    function (err,res,body) {
        let data = 
                    {
                      "url": url,
                      "headers": res.headers,
                      "body": body,
                      "timing": extractTiming(res)
                    }
        cb(err, data);
    });
}

function extractTiming(res, precision) {

  // Remove extra precision on timings.
  if (precision === undefined) {
    precision = 2;
  }

  let timings = res.timings;
  for (let key in timings) {
    timings[key] = timings[key].toFixed(precision);
  }

  let timingPhases = res.timingPhases;
  for (let key in timingPhases) {
    timingPhases[key] = timingPhases[key].toFixed(precision);
  }

  return {...timings, ...timingPhases};
}
