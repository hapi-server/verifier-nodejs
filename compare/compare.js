const clc     = require('chalk');
const request = require('request');
const async   = require('async');
const report  = require('./report.js').report;

const argv =
        require('yargs')
          .help()
          .default({
            "server2": "https://cdaweb.gsfc.nasa.gov/hapi",
            "server1": "http://localhost:8999/CDAWeb-cdas-cdf-using-pycdf/hapi",
//            "server1": "https://hapi-server.org/servers/TestData2.0/hapi",
//            "server2": "https://hapi-server.org/servers/TestData2.0/hapi",
            "name1": "1",
            "name2": "2",
            "dataset": "",
            "parameters": "",
            "start": "",
            "stop": "",
            "data": false,
            "namesonly": true,
            "infoonly": false,
            "simulate": false,
            "showpasses": false,
            "timefraction": "0.5"
          })
          .option('simulate',{'type': 'boolean'})
          .argv;

argv['server1'] = argv['server1'].replace(/\/$/,"");
argv['server2'] = argv['server2'].replace(/\/$/,"");

console.log(`${argv['name1']} = ${argv['server1']}`);
console.log(`${argv['name2']} = ${argv['server2']}\n`);

function cb() {
  console.log("Dataset finished.")
}

if (argv['dataset'] === '') {
  get(`${argv['server1']}/catalog`, "1", (err, res) => {

    const body = parseResponse(err, res);
    const catalog = body['catalog'];
    let datasets = [];
    for (let ds of catalog) {datasets.push(ds["id"])}
    run(argv, datasets);
  });
} else {
  run(argv, [argv['dataset']]);
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

function run(argv, datasets) {

  if (datasets.length == 0) return;
  dataset = datasets.shift();

  console.log("-".repeat(30));
  console.log(dataset)

  const args_a = `?id=${dataset}&parameters=${argv['parameters']}`;

  let args_i = args_a;
  if (argv['parameters'] === '') {
    args_i = `?id=${dataset}`;    
  }

  const seriesInfo = [
    (cb) => {get(argv['server1'] + "/info" + args_i, argv['name1'], cb)}, 
    (cb) => {get(argv['server2'] + "/info" + args_i, argv['name2'], cb)}
  ];

  async.series(seriesInfo, 

    (err, infos) => {

      handleError(err);

      infos[0] = JSON.parse(infos[0]['body']);
      infos[1] = JSON.parse(infos[1]['body']);

      startstop(argv, infos);
      if (argv['start'] === '' && argv['stop'] === '') {
        console.error('start/stop not given and sampleStartDate/sampleStopDate not available from either server.');
        process.exit(1);
      }

      if (argv['namesonly'] == true || argv['infonly'] == true) {
        if (!err) report(argv, infos, null);
        // Timeout is needed to avoid connection refused error from CDAWeb
        // HAPI server. 
        setTimeout(() => run(argv, datasets), 50);
        return;
      }

      let args_b = `&time.min=${argv['start']}&time.max=${argv['stop']}`;

      url1 = argv['server1'] + "/data" + args_a + args_b;
      url2 = argv['server2'] + "/data" + args_a + args_b;

      let seriesData = [
          (cb) => {get(url1, argv['name1'], cb)},
          (cb) => {get(url2, argv['name2'], cb)}
      ];

      async.series(seriesData,
        (err, data) => {
          handleError(err);
          if (!err) report(argv, infos, data);
          run(argv, datasets);
      });
  });
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