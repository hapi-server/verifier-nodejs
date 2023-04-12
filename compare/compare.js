const clc     = require('chalk');
const request = require('request');
const async   = require('async');
const report  = require('./report.js').report;

const argv =
        require('yargs')
          .help()
          .default({
            "server1": "https://hapi-server.org/servers/TestData2.0/hapi",
            "server2": "https://hapi-server.org/servers/TestData2.0/hapi",
            "name1": "1 ",
            "name2": "2 ",
            "dataset": "",
            "parameters": "",
            "start": "",
            "stop": "",
            "simulate": false,
            "showpasses": false,
            "timefraction": "0.5"
          })
          .option('simulate',{'type': 'boolean'})
          .argv;

argv['server1'] = argv['server1'].replace(/\/$/,"");
argv['server2'] = argv['server2'].replace(/\/$/,"");

if (argv['dataset'] === '') {
  get(`${argv['server1']}/catalog`, "1 ", (err, res) => {

    const body = parseResponse(err, res);
    const datasets = body['catalog'];

    argv['dataset'] = datasets[0]['id'];    
    if (argv['parameters'] === '' || argv['start'] === '' || argv['stop'] === '') {
      get(`${argv['server1']}/info?id=${argv['dataset']}`, "1 ", 
        (err, res) => {
          const info = JSON.parse(res['body']);
          startstop(argv, info);
          argv['parameters'] = info['parameters'][1]['name'];
          run(argv);
      })      
    } else {
      run(argv);
    }
  });
} else {
  run(argv);
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

function startstop(argv, info) {
  if (argv['start'] === '') {
    argv['start'] = info['sampleStartDate'];
  }
  if (argv['stop'] === '') {
    argv['stop'] = info['sampleStopDate'];
  }  
}

function run(argv) {

  const args_a = `?id=${argv['dataset']}&parameters=${argv['parameters']}`;

  const seriesInfo = [
    (cb) => {get(argv['server1'] + "/info" + args_a, argv['name1'], cb)}, 
    (cb) => {get(argv['server2'] + "/info" + args_a, argv['name2'], cb)}
  ];

  async.series(seriesInfo, 

    (err, infos) => {
      if (err) {
        console.log("Error:")
        console.error(err);
        console.log("Exiting with code 1")
        process.exit(1);
      }

      infos[0] = JSON.parse(infos[0]['body']);
      infos[1] = JSON.parse(infos[1]['body']);

      let args_b = `&time.min=${argv['start']}&time.max=${argv['stop']}`;

      url1 = argv['server1'] + "/data" + args_a + args_b;
      url2 = argv['server2'] + "/data" + args_a + args_b;

      let seriesData = [
          (cb) => {get(url1, argv['name1'], cb)},
          (cb) => {get(url2, argv['name2'], cb)}
      ];

      async.series(seriesData, 
        (err, data) => {
          if (err) {
            console.log("Error:");
            console.error(err);
            console.log("Exiting with code 1.");
            process.exit(1);
          }
          report(argv, infos, data);
      });
  });
}

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
