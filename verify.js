var fs   = require('fs');
var clc  = require('chalk');
var argv = require('yargs')
            .help()
            .default({
              "port": 9999,
              "url": "",
              "id": "",
              "parameter": "",
              "timemax": "",
              "timemin": "",
              "version": "",
              "datatimeout": 5000,
              "metatimeout": 1000,
              "output": "",
              "test": false,
              "plotserver":"http://hapi-server.org/plot"
            })
            .argv

var tests = require('./tests.js'); // Test runner
var versions = require('./is.js').versions;

const nodever = parseInt(process.version.slice(1).split('.')[0]);
if (parseInt(nodever) < 8) {
  // TODO: On windows, min version is 8
  console.log(clc.red("!!! node.js version >= 8 required.!!! "
    + "node.js -v returns " + process.version
    + ".\nConsider installing https://github.com/creationix/nvm and then 'nvm install 8'.\n"));
  process.exit(1);
}

function fixurl(q) {

  // Allow typical copy/paste error
  //   ?url=http://server/hapi/info?id=abc
  // and treat as equivalent to 
  //   ?url=http://server/hapi&id=abc
  // for web interface and similar for command line.

  if (/\?id=/.test(q['url'])) {
    q['id'] = q['url'].split("?id=")[1];
    q['url'] = q['url']
                  .split("?id=")[0]
                  .replace(/\/info$|\/data$|\/catalog$/,"")
  }
  q['url'] = q['url'].replace(/\/$/,"");
}

if (argv.url !== "" || argv.test) {
  // Command-line mode

  if (argv.test) {
    argv.url = "https://hapi-server.org/servers/TestData2.0/hapi";
    argv.id = "dataset1";
  }

  fixurl(argv);

  argv.parameter = argv.parameter || argv.parameters || "";
  
  if (argv.version !== "" && !versions().includes(argv.version)) {
    console.log("Version must be one of ",versions());
  }

  let opts = {
    "url": argv["url"],
    "id": argv["id"] || argv["dataset"],
    "parameter": argv["parameter"],
    "start": argv["timemin"],
    "stop": argv["timemax"],
    "version": argv["version"],
    "output": argv["output"] || "console",
    "datatimeout": argv["datatimeout"],
    "metatimeout": argv["metatimeout"],
    "plotserver": argv["plotserver"]
  }

  tests.run(opts);

} else {
  // Server mode
  var express = require('express');
  var app     = express();
  var server  = require("http").createServer(app);

  app.get('/favicon.ico', function (req, res, next) {
    res.setHeader('Content-Type', 'image/x-icon');
    fs.readFile(__dirname + "/favicon.ico",
      function (err,data) {
        res.end(data);
    });
  });

  app.get('/', function (req, res, next) {

    var addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    console.log(new Date().toISOString() + " [verifier] Request from " + addr + ": " + req.originalUrl)
    
    if (!req.query.url) { // Send html page if no url given in query string
      res.contentType("text/html");
      fs.readFile(__dirname + "/verify.html",function (err,html) {res.end(html);});
      return;
    }

    var allowed = ["url","id","dataset","parameter","parameters",
                   "time.min","start","time.max","stop","version",
                   "datatimeout","metatimeout","output"];
    for (var key in req.query) {
      if (!allowed.includes(key)) {
        res.end("Only allowed parameters are " + allowed.join(",") + " (not "+key+").");
        return;
      }
    }

    fixurl(req.query);

    var version = req.query["version"] || argv["version"];
    if (version && !versions().includes(version)) {
      res.status(400).end("version must be one of " + JSON.stringify(versions()));
    }

    let parameter = req.query["parameter"] || req.query["parameters"] || "";
    if (parameter) {
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
  console.log(new Date().toISOString() + " [verifier] HAPI verifier listening on port " + argv.port + ". See http://localhost:" + argv.port + "/");
  console.log(new Date().toISOString() + " [verifier] Using plotserver " + argv.plotserver);
}

// Uncaught errors in API request code.
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.end('<div style="border:2px solid black"><b><font style="color:red"><b>Problem with verification server (Uncaught Exception). Aborting. Please report last URL shown above in report to the <a href="https://github.com/hapi-server/verifier-nodejs/issues">issue tracker</a>.</b></font></div>');
}

process.on('uncaughtException', function(err) {
  if (err.errno === 'EADDRINUSE') {
    console.log(clc.red("Port " + argv.port + " already in use."));
  } else {
    console.log(err.stack);
  }
})
