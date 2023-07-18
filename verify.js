checkNodeJSVersion();

const fs   = require('fs');
const argv = require('yargs')
              .help()
              .default({
                "port": 9999,
                "url": "",
                "id": "",
                "dataset": "",
                "parameter": "",
                "timemax": "",
                "start": "",
                "timemin": "",
                "stop": "",
                "version": "",
                "datatimeout": 5000,
                "metatimeout": 1000,
                "output": "console",
                "test": false,
                "plotserver":"https://hapi-server.org/plot"
              })
              .describe('dataset','Start with "^" to indicate a regular expression')
              .boolean('test')
              .deprecateOption('id', 'use --dataset')
              .deprecateOption('timemin', 'use --start')
              .deprecateOption('timemax', 'use --stop')
              .choices('output', ['console', 'json'])
              .argv;


const tests = require('./tests.js'); // Test runner
const versions = require('./is.js').versions; // Array of implemented versions


function fixurl(q) {

  // Allow typical copy/paste error
  //   ?url=http://server/hapi/info?{id,dataset}=abc
  // and treat as equivalent to 
  //   ?url=http://server/hapi&{id,dataset}=abc
  // for web interface and similar for command line.

  if (/\?id=/.test(q['url'])) {
    q['id'] = q['url'].split("?id=")[1];
    q['url'] = q['url']
                  .split("?id=")[0]
                  .replace(/\/info$|\/data$|\/catalog$/,"")
  }
  if (/\?dataset=/.test(q['url'])) {
    q['id'] = q['url'].split("?datset=")[1];
    q['url'] = q['url']
                  .split("?dataset=")[0]
                  .replace(/\/info$|\/data$|\/catalog$/,"")
  }
  q['url'] = q['url'].replace(/\/$/,"");
}

if (argv.url !== "" || argv.test == true) {

  // Command-line mode

  if (argv.test) {
    argv.url = "https://hapi-server.org/servers/TestData2.0/hapi";
    argv.id = "dataset1";
  }

  fixurl(argv);

  argv.parameter = argv.parameter || argv.parameters || "";

  if (argv.version !== "" && !versions().includes(argv.version)) {
    console.log("Version must be one of ", versions());
  }

  let opts = {
    "url": argv["url"],
    "id": argv["id"] || argv["dataset"],
    "parameter": argv["parameter"],
    "start": argv["timemin"] || argv["start"],
    "stop": argv["timemax"] || argv["stop"],
    "version": argv["version"],
    "output": argv["output"] || "console",
    "datatimeout": argv["datatimeout"],
    "metatimeout": argv["metatimeout"],
    "plotserver": argv["plotserver"]
  }

  tests.run(opts);
} else {

  // Server mode
  const express = require('express');
  const app     = express();
  const server  = require("http").createServer(app);

  app.get('/', function (req, res, next) {

    let addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    console.log(new Date().toISOString() 
              + " [verifier] Request from " + addr + ": " + req.originalUrl);

    if (!req.query.url) { 
      // Send HTML page if no URL given in query string
      res.contentType("text/html");
      fs.readFile(__dirname + "/verify.html",
                    function (err,html) {res.end(html)});
      return;
    }

    let allowed = ["url","id","dataset","parameter","parameters",
                   "time.min","start","time.max","stop","version",
                   "datatimeout","metatimeout","output"];
    for (let key in req.query) {
      if (!allowed.includes(key)) {
        res.end("Allowed parameters are " 
                + allowed.join(",") + " (not " + key + ").");
        return;
      }
    }

    fixurl(req.query);

    let version = req.query["version"] || argv["version"];
    if (version && !versions().includes(version)) {
      let vers = JSON.stringify(versions());
      res.status(400).end("<code>version</code> must be one of " + vers);
    }

    let parameter = req.query["parameter"] || req.query["parameters"] || "";
    if (parameter.trim() !== "") {
      if (parameter.split(",").length > 1) {
        res.end("Only one parameter may be specified.");
      }
    }

    let opts = {
      "url": req.query["url"] || "",
      "id": req.query["id"] || req.query["dataset"] || "",
      "parameter": parameter,
      "start": req.query["time.min"] || req.query["start"] || "",
      "stop": req.query["time.max"]  || req.query["start"] || "",
      "version": version,
      "output": req.query["output"] || "html",
      "datatimeout": parseInt(req.query["datatimeout"]) || argv["datatimeout"],
      "metatimeout": parseInt(req.query["metatimeout"]) || argv["metatimeout"],
      "plotserver": req.query["plotserver"] || argv["plotserver"]
    }

    tests.run(opts,req,res);
  });

  app.use(errorHandler);
  app.listen(argv.port);
  console.log(new Date().toISOString() 
              + " [verifier] HAPI verifier listening on port " 
              + argv.port + ". See http://localhost:" + argv.port + "/");
  console.log(new Date().toISOString() 
              + " [verifier] Using plotserver " + argv.plotserver);
}

// Uncaught errors in API request code.
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.end('<div style="border: 2px solid black; color: red; font-weight: bold; ">'
        + ' Problem with verification server (Uncaught Exception).'
        + ' Aborting. Please report last URL shown above in report to the'
        + ' <a href="https://github.com/hapi-server/verifier-nodejs/issues">'
        + '   issue tracker'
        + ' </a>.'
        + '</div>');
}

process.on('uncaughtException', function(err) {
  const clc  = require('chalk');
  if (err.errno === 'EADDRINUSE') {
    console.log(clc.red("Port " + argv.port + " is already in use."));
  } else {
    console.log(err.stack);
  }
});

function checkNodeJSVersion() {
  const minVersion = 12;
  const clc  = require('chalk');
  const nodever = parseInt(process.version.slice(1).split('.')[0]);
  if (parseInt(nodever) < minVersion) {
    let msg = `Error: Node.js version >=${minVersion} required. ` 
            + `node.js -v returns ${process.version}.\n`
            + "Consider installing https://github.com/creationix/nvm"
            + ` and then 'nvm install ${minVersion}'.\n`
    console.log(clc.red(msg));
    process.exit(1);
  }
}
