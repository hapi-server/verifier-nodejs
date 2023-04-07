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
            "simulate": true,
            "timefraction": "0.5"
          })
          .option('simulate',{'type': 'boolean'})
          .argv;

let report = require('./report.js').report;

let url1 = argv['server1'].replace(/\/$/,"") + "/" + argv['endpoint'];
let url2 = argv['server2'].replace(/\/$/,"") + "/" + argv['endpoint'];
url1 = url1 + "?id=" + argv['dataset'] + "&parameters=" + argv['parameters'] + "&time.min=" + argv['start'] + "&time.max=" + argv['stop'];
url2 = url2 + "?id=" + argv['dataset'] + "&parameters=" + argv['parameters'] + "&time.min=" + argv['start'] + "&time.max=" + argv['stop'];

let url1i = argv['server1'].replace(/\/$/,"") + "/info";
url1i = url1i + "?id=" + argv['dataset'] + "&parameters=" + argv['parameters'];

//Using Callbacks
let series = 
              [
                function(cb) {get(url1, cb)},
                function(cb) {get(url2, cb)}
              ];

get(url1i, (err, data) => {
  async.series(series, 
    (err, results) => {
      report(argv, JSON.parse(data.body), results);
    });  
})

function get(url, cb) {

  console.log(clc.blue('Getting ' + url + '\n'));
  let opts = {"url": url, "time": true};
  request(opts,
    function (err,res,body) {
        let data = 
                    {
                      "url": url,
                      "headers": res.headers,
                      "timing": extractTiming(res),
                      "body": body
                    }
        cb(err, data);
    });
}

function extractTiming(res, precision) {
  // Remove nonsense extra precision on timings.
  if (precision === undefined) {
    precision = 1;
  }
  var timings = res.timings;
  for (var key in timings) {
    timings[key] = timings[key].toFixed(precision);
  }
  var timingPhases = res.timingPhases;
  for (var key in timingPhases) {
    timingPhases[key] = timingPhases[key].toFixed(precision);
  }
  return {...timings, ...timingPhases}
}
