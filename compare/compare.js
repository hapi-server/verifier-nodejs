const clc     = require('chalk');
const request = require('request');
const async   = require('async');
const report  = require('./lib/report.js').report;

const argv =
        require('yargs')
          .help()
          .default({
            "server2": "https://cdaweb.gsfc.nasa.gov/hapi",
            "server1": "http://localhost:8999/CDAWeb-cdas-cdf-using-pycdf/hapi",
//            "server1": "https://hapi-server.org/servers/TestData2.0/hapi",
//            "server2": "https://hapi-server.org/servers/TestData2.0/hapi",
            "name1": "BW",
            "name2": "NL",
            "dataset": "AC_H0_MFI",
            "parameters": "",
//            "start": "",
//            "stop": "",
            "start": "2021-03-12T00:00:42.000000000Z",
            "stop": "2021-03-12T00:20:42.000000000Z",
            "maxrecs": 2,
            "data": true,
            "namesonly": false,
            "simulate": false,
            "showpasses": false,
            "timefraction": "0.5"
          })
          .option('simulate',{'type': 'boolean'})
          .argv;

// Replace trailing /
argv['server1'] = argv['server1'].replace(/\/$/,"");
argv['server2'] = argv['server2'].replace(/\/$/,"");

console.log(`${argv['name1']} = ${argv['server1']}`);
console.log(`${argv['name2']} = ${argv['server2']}\n`);

if (argv['dataset'] === '') {
  getDatasetIDs(argv, run);
  return;
} else {
  run(argv, argv['dataset'].split(","));
}

function run(argv, datasets) {
  getInfos(argv, datasets[0], (argv, infos) => {
    getDatasets(argv, datasets[0], infos, 
      (err, argv, infos, data) => {
        if (!err) {
          report(argv, infos, data);
        }
        console.log("Finished " + datasets[0]);
        if (datasets.length > 1) {
          datasets.shift();
          run(argv, datasets);
        }
      });
  });
}

function getDatasetIDs(argv, cb) {

  // Get list of datasets from first server
  get(`${argv['server1']}/catalog`, argv['name1'], (err, res) => {
    if (err) {
      console.log(err);
      process.exit(1);
    }
    const body = parseResponse(err, res);
    const catalog = body['catalog'];
    let datasets = [];
    for (let ds of catalog) {
      datasets.push(ds["id"]);
    }
    cb(argv, datasets);
  });
}

function getInfos(argv, dataset, cb) {

  console.log("-".repeat(30));
  console.log(dataset)

  // Arguments for /info request
  const args_i = `?id=${dataset}&parameters=${argv['parameters']}`;

  // Get /info response for dataset
  const seriesInfo = [
    (cb) => {get(argv['server1'] + "/info" + args_i, argv['name1'], cb)}, 
    (cb) => {get(argv['server2'] + "/info" + args_i, argv['name2'], cb)}
  ];

  async.series(seriesInfo, 
    (err, infos) => {
      handleError(err);
      cb(argv, infos);
  })
}

function getDatasets(argv, dataset, infos, cb) {

  // Arguments for /info request
  const args_i = `?id=${dataset}&parameters=${argv['parameters']}`;

  infos[0] = JSON.parse(infos[0]['body']);
  infos[1] = JSON.parse(infos[1]['body']);

  startstop(argv, infos);
  if (argv['start'] === '' && argv['stop'] === '') {
    console.error('start/stop not given and sampleStartDate/sampleStopDate not available from either server.');
    process.exit(1);
  }

  if (argv['data'] === false) {
    report(argv, infos, null);
    // setTimeout is needed to avoid connection refused error from CDAWeb
    // HAPI server. 
    setTimeout(() => getInfos(argv, dataset, cb), 50);
    return;
  }

  let args_d = args_i + `&time.min=${argv['start']}&time.max=${argv['stop']}`;

  url1 = argv['server1'] + "/data" + args_d;
  url2 = argv['server2'] + "/data" + args_d;

  let seriesData = [
      (cb) => {get(url1, argv['name1'], cb)},
      (cb) => {get(url2, argv['name2'], cb)}
  ];

  async.series(seriesData,
    (err, data) => {
      handleError(err);
      cb(err, argv, infos, data);
  });
}

function parseResponse(err, res) {

  const body = JSON.parse(res['body']);
  if (parseInt(body['status']['code']) !== 1200) {
    err = `HAPI status ${body['status']['code']} != 1200.`;
  }

  if (err) {
    console.error(clc.red("Error."));
    console.error("Response:");
    console.error(res)
    console.error("Error message:");
    console.error(clc.red(err))
    process.exit(1);
  }
  return body;
}

function startstop(argv, infos) {
  if (argv['start'] === '') {
    argv['start'] = infos[0]['sampleStartDate'] || infos[1]['sampleStartDate'];
  }
  if (argv['stop'] === '') {
    argv['stop'] = infos[0]['sampleStopDate'] || infos[1]['sampleStopDate'];
  }  
}

function get(url, msgPrefix, cb) {

  console.log(msgPrefix + clc.blue(' Getting ' + url));

  let opts = {"url": url, "time": true};
  request(opts,
    function (err,res,body) {
        handleError(err);
        if (err) cb(err, null);
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

function handleError(err, exit) {
  if (!err) return;
  console.log("Error:")
  console.error(err);
  console.error(err.message);
  //console.log("Exiting with code 1");
  //process.exit(1);
}
