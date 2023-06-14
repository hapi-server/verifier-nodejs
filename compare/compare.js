const clc     = require('chalk');
const async   = require('async');
const report  = require('./lib/report.js').report;
const axios   = require('axios');

const cli = require('./lib/cli.js').cli;
argv = cli();

// Replace trailing /
argv['server1'] = argv['server1'].replace(/\/$/,"");
argv['server2'] = argv['server2'].replace(/\/$/,"");

console.log(`${argv['name1']} = ${argv['server1']}`);
console.log(`${argv['name2']} = ${argv['server2']}\n`);

if (argv['dataset'].trim() === '') {
  // No dataset given. Get all dataset IDs.
  getDatasetIDs();
  return;
} else {
  run(argv['dataset'].split(","));
}

function run(datasets) {
  getInfos(datasets[0], (infos) => {
    getDatasets(datasets[0], infos, 
      (err, infos, data) => {
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

function getDatasetIDs(cb) {

  // Get list of datasets from first server
  get(`${argv['server1']}/catalog`, (res) => {

    const body = res['body'];
    const catalog = body['catalog'];
    let datasets = [];
    for (let ds of catalog) {
      datasets.push(ds["id"]);
    }
    //console.log(datasets);
    run(datasets);
  });
}

function getInfos(dataset, cb) {

  console.log("-".repeat(30));
  console.log(dataset);

  // Arguments for /info request
  let args_i = `?id=${dataset}&parameters=${argv['parameters']}`;
  if (argv['parameters'] === '') {
    args_i = `?id=${dataset}`;
  }

  // Get /info response for dataset
  const urls = [
    argv['server1'] + "/info" + args_i,
    argv['server2'] + "/info" + args_i
  ];

  get(urls, (responses) => {
    let infos = [];
    infos[0] = responses[0]['body'];
    infos[1] = responses[1]['body'];
    //report(argv, infos, null);
    //console.log(infos)
    cb(infos)
  });
}

function getDatasets(dataset, infos, cb) {

  //console.log(infos)
  // Arguments for /data request
  let args_i = `?id=${dataset}&parameters=${argv['parameters']}`;
  if (argv['parameters'] === '') {
    args_i = `?id=${dataset}`;
  }

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

  // Get /info response for dataset
  const urls = [
    argv['server1'] + "/data" + args_d,
    argv['server2'] + "/data" + args_d
  ];

  get(urls, (responses) => {
    let data = [];
    data[0] = responses[0]['body'];
    data[1] = responses[1]['body'];
    //report(argv, infos, null);
    //console.log(infos)
    cb(null, infos, data);
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

function get(urls, cb) {

  if (!Array.isArray(urls)) {
    urls = [urls];
  }

  function finished(err, response, url) {
    if (finished.N === undefined) {
      finished.responses = [];
      finished.N = 0;
    }

    console.log("Received " + url);
    finished.responses.push(response);
    if (finished.responses.length === urls.length) {
      if (urls.length === 1) {
        cb(finished.responses[0]);
      } else {
        cb(finished.responses);
      }
    }
  }

  for (let idx in urls) {
    console.log("Requesting " + urls[idx])
    axios.get(urls[idx])
      .then((response) => {
        //console.log(response)
        finished(null, {'body': response.data, 'headers': response.headers}, urls[idx]);
      })
      .catch((error) => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.log(error.response.data);
          console.log(error.response.status);
          console.log(error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
        console.log(error.config);
      });
  }
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
