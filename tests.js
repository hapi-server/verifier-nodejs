const fs      = require('fs');
const moment  = require('moment');
const ip      = require("ip");
const {URL}   = require("url");
const http    = require('http');
const https   = require('https');
const urllib  = require('url');
const request = require('request');

let is = require('./is.js'); // Test library
let report = require('./report.js').report; // Logging

exports.run = run;
function run(opts, clientRequest, clientResponse) {

  opts = setAndCheckOptions(opts, clientResponse);

  // For simulating timeouts
  //opts["metatimeout"] = 1;
  //opts["datatimeout"] = 1;

  if (clientRequest) {
    // If client closes connection, stop testing.
    var CLOSED = false;
    clientRequest.connection.on('close',function() {CLOSED = true;});
  }

  // First object passed to report().
  let r = {'res': clientResponse, 'opts': opts, 'infoAll': {}, 'dataAll1Body': {}};

  let ignoreVersionError = false;
  if (opts["version"]) {
    ignoreVersionError = true;
  }
  // Catch uncaught exceptions. TODO: This will over-write any previous handler
  // (will it?). Should move this to verifier.js.
  process.on('uncaughtException', (err) => uncaughtException(err,clientResponse));


  if (opts["parameter"]) {
    // Client wants to test one parameter.
    capabilities();
  } else {
    // Test everything if no parameter given. (Technically, should perhaps not
    // test everything if dataset given in URL. However, some servers have so
    // many datasets that typically one only tests one dataset, so we may as
    // well test everything.)
    landing();
  }

  function landing() {

    // Check optional landing page.

    let timeoutString = timeoutCondition(landing,'metadata');
    let url = opts["url"] + "/";
    report(r,url);
    request(requestOptions(url,opts,timeoutString),function (err,res,body) {
      landing.tries = landing.tries === undefined ? 1 : landing.tries + 1;
      if (err) {
        report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
        if (landing.tries === 1) {
          landing(); // Try again
        } else {
          landingRedirect();
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      report(r,url,is.HTTP200(res),{"warn":true});
      report(r,url,is.ContentType(/^text\/html/,res.headers["content-type"]),{"warn":true});

      landingRedirect();
    });
  }

  function landingRedirect() {

    // Check that /hapi redirects to /hapi/

    let timeoutString = timeoutCondition(landingRedirect,'metadata');
    let url = opts["url"];
    report(r,url);
    request(requestOptions(url,opts,timeoutString),function (err,res,body) {
      landing.tries = landing.tries === undefined ? 1 : landing.tries + 1;
      if (err) {
        report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
        if (landing.tries === 1) {
          landingRedirect(); // Try again
        } else {
          capabilities();
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      report(r,url,is.HTTP302or200(res),{"warn":true});
      report(r,url,is.ContentType(/^text\/html/,res.headers["content-type"]),{"warn":true});

      capabilities();
    });
  }

  function checkCapabilitiesAndAbout(err, res, body, url, timeoutString, func, funcName) {

    if (err) {
      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
      if (func.tries === 0) {
        func(); // Try again
      } else {
        catalog(['csv']);
      }
      return;
    }

    report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
    report(r,url,is.ContentType(/^application\/json/,res.headers["content-type"]));
    report(r,url,is.CORSAvailable(res.headers),{"warn":true});
    if (!report(r,url,is.HTTP200(res),{"stop":true})) {
      catalog(['csv']);
      return;
    }
    if (!report(r,url,is.JSONParsable(body),{"stop":true})) {
      catalog(['csv']);
      return;
    }
    let json = JSON.parse(body);
    versionCheckAndReport(r,url,opts,json.HAPI);

    if (!report(r,url,is.HAPIJSON(body,version(opts,json.HAPI),funcName,ignoreVersionError),{"stop":true})) {
      catalog(['csv']);
      return;
    }
    return json;
  }

  function capabilities() {

    if (CLOSED) {return;}

    let timeoutString = timeoutCondition(capabilities,'metadata');
    let url = opts["url"] + "/capabilities";

    report(r,url);
    request(requestOptions(url,opts,timeoutString),function (err,res,body) {
      let json = checkCapabilitiesAndAbout(err, res, body, url, timeoutString, capabilities, 'capabilities');
      if (json) {
        r["capabilities"] = json;
        report(r,url,is.AllowedOutputFormat(json));
        about();
      }
    });
  }

  function about() {

    if (CLOSED) {return;}

    if (versionParts(r["capabilities"].HAPI)["major"] < 3) {
      catalog();
      return;
    }

    let timeoutString = timeoutCondition(about,'metadata');
    let url = opts["url"] + "/about";

    report(r,url);
    request(requestOptions(url,opts,timeoutString),function (err,res,body) {
      let json = checkCapabilitiesAndAbout(err, res, body, url, timeoutString, about, 'about');
      if (json) {
        r["about"] = json;
        catalog();
      }
    });
  }

  function catalog() {

    if (CLOSED) {return;}

    let timeoutString = timeoutCondition(catalog,'metadata');
    let url = encodeURI(opts["url"] + "/catalog");

    report(r,url);
    request(requestOptions(url,opts,timeoutString),function (err,res,body) {
      if (err) {
        if (catalog.tries === 0) {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
          catalog(); // Try again
        } else {
          // Abort rest of server checks.
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"abort":true});
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      report(r,url,is.ContentType(/^application\/json/,res.headers["content-type"]));
      report(r,url,is.CORSAvailable(res.headers),{"warn":true});

      if (!report(r,url,is.HTTP200(res),{"abort":true})) return;
      if (!report(r,url,is.JSONParsable(body),{"abort":true})) return;

      var CATALOG = JSON.parse(body);
      versionCheckAndReport(r,url,opts,CATALOG.HAPI);

      r["catalog"] = CATALOG;
      r["datasetsToCheck"] = JSON.parse(JSON.stringify(CATALOG.catalog));
      report(r,url,is.HAPIJSON(body,version(opts,CATALOG.HAPI),'catalog',ignoreVersionError));

      report(r,url,is.Unique(r["datasetsToCheck"],"datasets","id"));
      r["datasetsToCheck"] = removeDuplicates(r["datasetsToCheck"],'id');
      report(r,url,is.TooLong(r["datasetsToCheck"],"catalog","id","title",40),{"warn":true});
      report(r,url,is.CIdentifier(r["datasetsToCheck"],"dataset id"),{"warn":true});

      r["datasetsToCheck"] = selectDatasets(r["datasetsToCheck"],opts);

      if (r["datasetsToCheck"].length == 0) {
        let desc = "Dataset " + opts["id"] + " is not in catalog";
        if (opts["id"].startsWith("^")) {
          desc = `<code>${opts["id"]} did not match any dataset id in catalog.`;
        }
        robj = {"description": desc, "error": true, "got": "to abort"};
        if (!report(r,url,robj,{"abort":true})) {
          return;
        }
      }

      if (opts["parameter"]) {
        // 'parameter' given in client request
        infoAll();
      } else {
        infoError();
      }
    });
  }

  function infoError() {

    if (CLOSED) {return;}

    if (opts["parameter"]) {
      infoAll();
    }

    let timeoutString = timeoutCondition(infoError,'metadata');
    let url = encodeURI(opts["url"] + '/info?id=' + "a_test_of_an_invalid_id_by_verifier-nodejs");

    report(r,url);
    request(requestOptions(url,opts,timeoutString),function (err,res,body) {
      if (err) {
        report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
        if (infoError.tries === 0) {
          infoError(); // Try again
        } else {
          infoAll();
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      report(r,url,is.ContentType(/^application\/json/,res.headers["content-type"]));
      report(r,url,is.ErrorCorrect(res.statusCode,404,"httpcode"));
      report(r,url,is.StatusInformative(res.statusMessage,errors(1406),'httpstatus'),{"warn":true});
      if (report(r,url,is.JSONParsable(body),{"stop":true})) {
        let json = JSON.parse(body);
        versionCheckAndReport(r,url,opts,json.HAPI);
        if (report(r,url,is.HAPIJSON(json,version(opts,json.HAPI),'error',ignoreVersionError),{"stop":true})) {
          report(r,url,is.ErrorCorrect(json.status.code,1406,"hapicode"));
          report(r,url,is.StatusInformative(json.status.message,"HAPI error 1406",'hapistatus'),{"warn":true});
        }
        infoAll();
      }
    });
  }

  function nextDataset(r,currentId) {
    if (r["datasetsToCheck"].length > 1) {
      r["datasetsToCheck"].shift();  // Remove first element
      delete r['infoAll'][currentId];
      delete r['dataAll1Body'][currentId];
      infoAll();  // Start next dataset
    } else {
      // All datasets have been checked.
      report(r);
      return;
    }
  }

  function infoAll() {

    if (CLOSED) {return;}

    let datasets = r["datasetsToCheck"];
    let id = datasets[0]["id"];

    let url = encodeURI(opts["url"] + '/info?id=' + datasets[0]["id"]);

    // Initialize object that stores additional info for this dataset.
    r['catalog'][id] = {};

    let timeoutString = timeoutCondition(infoAll,'metadata');

    report(r,url);

    if (infoAll.tries === undefined) {
      plotLink(clientResponse,opts,id);
    }

    request(requestOptions(url,opts,timeoutString),function (err,res,body) {

      if (err) {
        report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn": true});
        if (infoAll.tries === 0) {
          infoAll(); // Try again
        } else {
          nextDataset(r,id);
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));

      let rargs = {"abort": true};
      if (datasets.length > 1) {
        // If more datasets to check, don't abort rest of server checks.
        rargs = {"stop": true};
      }

      if (!report(r,url,is.HTTP200(res),rargs)) {
        nextDataset(r,id);
        return;
      }

      report(r,url,is.ContentType(/^application\/json/,res.headers["content-type"]));

      if (!report(r,url,is.JSONParsable(body),rargs)) {
        nextDataset(r,id);
        return;
      }

      let json = JSON.parse(body);
      r["infoAll"][id] = json;

      versionCheckAndReport(r,url,opts,json.HAPI);
      let hapiVersion = version(opts,json.HAPI);

      report(r,url,is.HAPIJSON(json,hapiVersion,'info',ignoreVersionError));
      if (json.parameters) {
        if (json.parameters[0].name) {
          report(r,url,is.Unique(json.parameters,"parameters","name"));
          //json.parameters = removeDuplicates(header.parameters,'name');
        } else {
          report(r,url,
            {
              "description":
              "Expect first parameter object to have a key 'name'",
              "error": true,
              "got": JSON.stringify(json.parameters[0])
            },
            {"abort":true});
          return;
        }
      } else {
        report(r,url,
          {
            "description": "Expect parameters element in catalog",
            "error": true,
            "got": json.parameters
          },
          {"abort":true});
        return;
      }

      computeAndCheckStartStop(url,id);

      report(r,url,is.FormatInHeader(json,"nodata"));
      report(r,url,is.FirstParameterOK(json,"name"),{"warn":true});
      report(r,url,is.FirstParameterOK(json,"fill"));
      report(r,url,is.TimeIncreasing(json,"{start,stop}Date"));
      report(r,url,is.TimeIncreasing(json,"sample{Start,Stop}Date"));

      if (opts["parameter"]) {
        var tmp = selectOne(json.parameters,'name',opts["parameter"]);
        if (tmp.length !== 1) {
          if (!report(r,url,
              {
                "description": "Parameter " + opts["parameter"] + " given in URL or on command line is not in parameter array returned by " + url,
                "error": true,
                "got": "To abort"
              },
              {
                "abort": true
              }))
              return;
        }
      }

      for (var i = 0;i < json.parameters.length;i++) {

        if (opts["parameter"] && (json.parameters[i]['name'] !== opts["parameter"])) {
          continue;
        }

        let len  = json.parameters[i]["length"];
        let type = json.parameters[i]["type"];
        let name = json.parameters[i]["name"];
        let size = json.parameters[i]["size"];
        let fill = json.parameters[i]["fill"];
        let units = json.parameters[i]["units"];
        let label = json.parameters[i]["label"];
        let bins = json.parameters[i]["bins"];

        if (size === undefined) {
          size = [1];
        }

        report(r,url,is.TimeParameterUnitsOK(name,units,type,size));
        report(r,url,is.LengthAppropriate(len,type,name));

        report(r,url,is.LabelOrUnitsOK(name,label,size,"label",hapiVersion));
        report(r,url,is.LabelOrUnitsOK(name,units,size,"units",hapiVersion));

        report(r,url,is.BinsLengthOK(name,bins,size,hapiVersion));
        for (d in size) {
          report(r,url,is.BinsLabelOrUnitsOK(name,bins,size,d,'labels',hapiVersion));
          report(r,url,is.BinsLabelOrUnitsOK(name,bins,size,d,'units',hapiVersion));
          report(r,url,is.BinsCentersOrRangesOK(json.parameters,i,d,'centers',hapiVersion));
          report(r,url,is.BinsCentersOrRangesOK(json.parameters,i,d,'ranges',hapiVersion));
        }

        report(r,url,is.FillOK(fill,type,len,name,type));

        if (type === "string") {
          // Additional checks.
          report(r,url,is.FillOK(fill,type,len,name,'nullstring'));
          report(r,url,is.FillOK(fill,type,len,name,'stringparse'));
        }

      }

      if (opts["parameter"]) {
        // No need to check single parameter request, because already checked above.
        dataAll1();
      } else {
        infoSingleParameter();
      }
    });
  }

  function infoSingleParameter() {

    if (CLOSED) {return;}

    // Check if JSON response has two parameter objects when only
    // one parameter is requested. Checks only the second parameter
    // (first parameter after Time).

    let datasets = r["datasetsToCheck"];
    let id = datasets[0]["id"];

    let timeoutString = timeoutCondition(infoSingleParameter,'metadata');

    let infoAll = r["infoAll"][id];

    if (infoAll.parameters.length == 1) {
      // Time is only parameter; can't do request for second parameter.
      dataAll1();
      return;
    }

    let parameter = infoAll.parameters[1].name;
    if (opts["parameter"] !== "") {
      for (var i = 0; i < infoAll.parameters.length; i++) {
        if (infoAll.parameters[i].name === opts["parameter"]) {
          parameter = infoAll.parameters[i].name;
          break;
        }
      }
    }

    let url = encodeURI(opts["url"] + '/info' + "?id=" + id + '&parameters=' + parameter);

    report(r,url);
    request(requestOptions(url,opts,timeoutString),function (err,res,body) {

      if (err) {
        if (infoSingleParameter.tries === 0) {
          // Try again
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
          infoSingleParameter();
        } else {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"stop":true});
          dataAll1();
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      if (!report(r,url,is.HTTP200(res),{"stop":true})) {
        dataAll1();
        return;
      }
      report(r,url,is.ContentType(/^application\/json/,res.headers["content-type"]));
      if (!report(r,url,is.JSONParsable(body),{"stop":true})) {
        dataAll1();
        return;
      }

      var infoFirst = JSON.parse(body); // Reduced header
      versionCheckAndReport(r,url,opts,infoFirst.HAPI);
      let hapiVersion = version(opts,infoFirst.HAPI);

      if (!report(r,url,is.HAPIJSON(body,hapiVersion,'info',ignoreVersionError))) {
        if (headerReduced.parameters) {
          if (headerReduced.parameters[0]) {
            report(r,url,
              {
                "description": "Expect # parameters in JSON to be 2 when one non-time parameter is requested",
                "error": headerReduced.parameters.length != 2,
                "got": headerReduced.parameters.length + " parameters."
              });
          } else {
            report(r,url,
              {
                "description":"Cannot count # of parameters because parameters element is not an array.",
                "error": true,
                "got": "Non-array parameter element."
              });
          }
        } else {
          report(r,url,
            {
              "description": "Cannot count # of parameters because parameters element not found.",
              "error": true,
              "got": "Missing parameter element."
            });
        }
      } else {
        report(r,url,
          {
            "description": "Expect # parameters in JSON to be 2 when one non-time parameter is requested",
            "error": infoFirst.parameters.length != 2,
            "got": infoFirst.parameters.length + " parameters."
          });
      }

      report(r,url,is.InfoEquivalent(infoAll,infoFirst));

      infoUsingDataset();
    });
  }

  function infoUsingDataset() {

    // Check that dataset=DATASET is supported if HAPI version >= 3.0
    if (versionParts(r["catalog"].HAPI)["major"] < 3) {
      dataAll1();
      return;
    }

    if (CLOSED) {return;}

    let datasets = r["datasetsToCheck"];
    let id = datasets[0]["id"];

    let timeoutString = timeoutCondition(infoUsingDataset,"metadata");

    let url = encodeURI(opts["url"] + '/info?dataset=' + datasets[0]["id"]);

    report(r,url);
    request(requestOptions(url,opts,timeoutString),function (err,res,body) {

      if (err) {
        if (infoUsingDataset.tries === 0) {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
          infoUsingDataset(); // Try again
        } else {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"stop":true});
          dataAll1();
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      if (!report(r,url,is.HTTP200(res),{"stop":true})) {
        dataAll1();
        return;
      }
      report(r,url,is.ContentType(/^application\/json/,res.headers["content-type"]));
      if (!report(r,url,is.JSONParsable(body),{"stop":true})) {
        dataAll1();
        return;
      }

      var infoAllUsingDataset = JSON.parse(body);

      report(r,url,is.InfoSame(r["infoAll"][id], infoAllUsingDataset, 'APIvsAPI'), {'warn': true});
      dataAll1();

    });

  }

  function computeAndCheckStartStop(url,id) {

    let json = r["infoAll"][id];
    let validCadence = false;
    var obj = is.CadenceValid(json["cadence"]);
    if (!report(r,url,is.CadenceGiven(json["cadence"]),{"warn":true})) {
      report(r,url,obj);
    }
    validCadence = !obj.error;

    let start,stop,dataTimeout;
    if (opts["start"] && opts["stop"]) { 
      // start/stop given in verifier request URL
      dataTimeout = "datasamplechosen";
      start = opts["start"];
      stop  = opts["stop"];
    } else if (json["sampleStartDate"] && json["sampleStopDate"]) {
      dataTimeout = "datasamplesuggested";
      start = json["sampleStartDate"];
      stop  = json["sampleStopDate"];
      report(r,url,is.CadenceOK(json["cadence"],start,stop,"sampleStart/sampleStop"),{"warn":true});
    } else {
      start = json["startDate"];
      stop = json["stopDate"];
      if (!start || !stop) {
        let desc = "Need at least startDate and stopDate or sampleStartDate and sampleStopDate to continue.";
        report(r,url,{"description": desc, "error": true,"got": "To abort"},{"abort": true});
      }
      if (json["cadence"] && validCadence) {
        dataTimeout = "datasample10xcadence";
        report(r,url,is.CadenceOK(json["cadence"],start,stop,"start/stop"));
        var md = moment.duration(json["cadence"]);
        stop = new Date(start).valueOf() + 10*md._milliseconds;
        stop = new Date(stop).toISOString();
      } else {
        dataTimeout = "datadefault";
        // Use one day
        let desc = "Expect enough infoSingleParametermation to compute time.max to use for data sample tests.";
        let got = "No cadence and no sampleStartDate and sampleStopDate."
                + " Will use time.min = startDate and time.max = startDate + P1D.";
        report(r,url,{"description": desc, "error": true, "got": got},{"warn": true});
        stop = new Date(start).valueOf() + 86400*1000;
        stop = new Date(stop).toISOString();
      }
    }
    r['catalog'][id]["startToUse"] = start;
    r['catalog'][id]["stopToUse"] = stop;
    r['catalog'][id]["dataTimeout"] = dataTimeout;
  }

  function dataAll1() {

    // Request all parameters using time format in request.

    if (CLOSED) {return;}

    let datasets = r["datasetsToCheck"];
    let id = datasets[0].id;

    let timeoutString = timeoutCondition(dataAll1,"data");

    let url = encodeURI(opts["url"] 
          + '/data?id=' + id 
          + '&time.min=' + r['catalog'][id]["startToUse"] 
          + '&time.max=' + r['catalog'][id]["stopToUse"]);

    report(r,url);
    let reqOpts = requestOptions(url,opts,timeoutString,true);
    request(reqOpts,function (err,res,dataAll1Body) {
      if (err) {
        if (dataAll1.tries === 0) {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
          dataAll1(); // Try again
        } else {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true,"stop":true});
          // Start checking individual parameters. Skip test using different
          // time format (dataAll2()) and request with header (dataAll_Header()).
          datar();
        }
        return;
      }

      r['dataAll1Body'][id] = dataAll1Body;

      function next() {
        if (opts['parameter']) {
          datar();
        } else {
          dataAll2('alternateTimeFormat');
        }
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      if (!report(r,url,is.HTTP200(res),{"stop":true})) {
        next();
        return;
      }
      if (!report(r,url,is.FileStructureOK(dataAll1Body,"empty",res.statusMessage),{"stop":true})) {
        next();
        return;
      }


      report(r,url,is.CompressionAvailable(res.headers),{"warn":true});
      report(r,url,is.ContentType(/^text\/csv/,res.headers["content-type"]));
      report(r,url,is.CORSAvailable(res.headers),{"warn":true});

      if (!dataAll1Body || dataAll1Body.length === 0) {
        next();
        return;
      }

      report(r,url,is.FileStructureOK(dataAll1Body,"firstchar"));
      report(r,url,is.FileStructureOK(dataAll1Body,"lastchar"));
      report(r,url,is.FileStructureOK(dataAll1Body,"extranewline"));
      report(r,url,is.FileStructureOK(dataAll1Body,"numlines"));

      report(r,url,is.FileLineOK(r["infoAll"][id],dataAll1Body,null,'Ncolumns'));

      next();
    })
  }

  function dataAll2(testName) {

    if (!dataAll2[testName]) {
      dataAll2[testName] = {"tries": 0};
    }

    // Same request as dataAll1() but with different time format.
    // If dataAll1() used YMD, then dataAll2() uses YDOY and vice-versa.

    if (CLOSED) {return;}

    let datasets = r["datasetsToCheck"];
    let id = datasets[0].id;

    let timeoutString = timeoutCondition(dataAll2[testName],"data");

    let url = "";
    if (testName === 'alternateTimeFormat') {
      // switchTimeFormat converts YMD -> DOY or YDOY -> YMD
      url = encodeURI(opts["url"] 
          + '/data?id=' + id
          + '&time.min=' + switchTimeFormat(r['catalog'][id]['startToUse'])
          + '&time.max=' + switchTimeFormat(r['catalog'][id]['stopToUse']));
    }
    if (testName === 'emptyParameters') {
      url = encodeURI(opts["url"] 
          + '/data?id=' + id
          + '&parameters='
          + '&time.min=' + switchTimeFormat(r['catalog'][id]['startToUse'])
          + '&time.max=' + switchTimeFormat(r['catalog'][id]['stopToUse']));
    }
    if (testName === 'hapi3API') {
      url = encodeURI(opts["url"] 
          + '/data?dataset=' + id
          + '&start=' + switchTimeFormat(r['catalog'][id]['startToUse'])
          + '&stop=' + switchTimeFormat(r['catalog'][id]['stopToUse']));
    }

    let reqOpts = requestOptions(url,opts,timeoutString,true);
    request(reqOpts,function (err,res,dataAll2Body) {

      if (err) {
        if (dataAll2[testName].tries === 0) {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
          dataAll2(testName); // Try again
        } else {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true,"stop":true});
          // Start checking individual parameters. Skip test
          // using different time format (dataAll2()) and request
          // with header (dataAll_Header()).
          datar();
        }
        return;
      }

      function next() {
        if (testName === 'alternateTimeFormat') {
          dataAll2('emptyParameters');
        } else if (testName === 'emptyParameters' && versionParts(r["catalog"].HAPI)["major"] > 3) {
          dataAll2('hapi3API');
        } else {
          dataAll_Header();
        }
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      if (!report(r,url,is.HTTP200(res),{"stop":true})) {
        next();
        return;
      }
      if (!report(r,url,is.FileStructureOK(dataAll2Body,"empty",res.statusMessage),{"stop":true})) {
        next();
        return;
      }
      if (!dataAll2Body || dataAll2Body.length === 0) {
        next();
        return;
      }

      report(r,url,is.FileContentSameOrConsistent(r["infoAll"][id],dataAll2Body,r['dataAll1Body'][id],"same"));
      next();
    });

  }

  function dataAll_Header() {

    // Same as dataAll1() but request with header.

    if (CLOSED) {return;}

    let datasets = r["datasetsToCheck"];
    let id = datasets[0].id;

    let timeoutString = timeoutCondition(dataAll_Header,"data");

    let url = encodeURI(opts["url"] 
          + '/data?id=' + id 
          + '&time.min=' + r['catalog'][id]["startToUse"]
          + '&time.max=' + r['catalog'][id]["stopToUse"]
          + "&include=header");

    report(r,url);
    let reqOpts = requestOptions(url,opts,timeoutString,true);
    request(reqOpts,function (err,res,body) {

      // TODO: Code below is very similar to that in dataAll1()
      if (err) {
        if (dataAll_Header.tries === 0) {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
          dataAll_Header(); // Try again
        } else {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true,"stop":true});
          // Start next test
          dataAll_1201();
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      if (!report(r,url,is.HTTP200(res),{"stop":true})) {
        dataAll_1201();
        return;
      }
      if (!report(r,url,is.FileStructureOK(body,"empty",res.statusMessage),{"stop":true})) {
        dataAll_1201();
        return;
      }
      if (!body || body.length === 0) {
        dataAll_1201();
        return;
      }
      // End similar code.

      let ret = is.HeaderParsable(body);
      if (report(r,url,ret,{"stop": true})) {
        report(r,url,is.FormatInHeader(ret.csvparts.header, "data"));
        report(r,url,is.InfoSame(r["infoAll"][id], ret.csvparts.header), {'warn': true});
        report(r,url,is.FileContentSameOrConsistent(r["infoAll"][id],r['dataAll1Body'][id],ret.csvparts.data,"same"));
      }
      dataAll_1201();
    });
  }

  function dataAll_1201() {

    // Attempt to create a HAPI 1201 response (no data in interval) by setting
    // start time to be 1 ms after reported dataset start and stop time to be
    // 2 ms after reported start.

    if (CLOSED) {return;}

    let datasets = r["datasetsToCheck"];
    let id = datasets[0].id;

    let timeoutString = timeoutCondition(dataAll_1201,"data");

    var start = r['catalog'][id]['stopToUse'];
    var stop = r['catalog'][id]['startToUse'];
    var stop2 = r['catalog'][id]['stopToUse'];
    var start2 = r['catalog'][id]['startToUse'];

    // moment.js assumes local time if no trailing Z. Add trailing
    // Z if it is not given. The trailingZfix function addresses
    // case where stop2 is a date only, in which case moment.js
    // does not accept a date only with a trailing Z and it is removed.
    if (!start2.match(/Z$/)) {
      start2 = start2 + "Z";
    }
    if (!stop2.match(/Z$/)) {
      stop2 = stop2 + "Z";
    }
    var start2 = moment(is.trailingZfix(start2)).add(1,'ms').toISOString();
    var stop2 = moment(is.trailingZfix(start2)).add(2,'ms').toISOString();
    if (!start.match(/Z$/)) {
      // If start did not have trailing Z, remove it from new start.
      start2 = start2.slice(0,-1);
    }
    if (!stop.match(/Z$/)) {
      // If stop did not have trailing Z, remove it from new stop.
      stop2 = stop2.slice(0,-1);
    }

    let url = encodeURI(opts["url"] + '/data?id='+ id + '&time.min=' + start2 + '&time.max=' + stop2);

    report(r,url);
    let reqOpts = requestOptions(url,opts,timeoutString,true);
    request(reqOpts,function (err,res,body) {

      if (err) {
        if (dataAll_1201.tries === 0) {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
          dataAll_1201(); // Try again
        } else {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true,"stop":true});
          // Start next check
          datar();
        }
        return;
      }

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      if (!report(r,url,is.HTTP200(res),{"stop":true})) {
        datar();
        return;
      }
      // End similar code.

      report(r,url,is.FileStructureOK(body,"empty",res.statusMessage,true),{"warn": true});
      datar();
    });
  }

  function datar(pn) {

    // Reduced data request. Request one parameter at a time.

    if (CLOSED) {return;}

    let datasets = r["datasetsToCheck"];
    let id = datasets[0].id;

    var start = r['catalog'][id]['startToUse'];
    var stop = r['catalog'][id]['stopToUse'];

    if (pn === undefined) pn = 0;

    if (pn === -1 || pn == r["infoAll"][id].parameters.length) {
      // All parameters for dataset have been checked.
      // -1 is case when one parameter given (opts["parameter"] === false)
      nextDataset(r,id);
      return; 
    }

    // TODO: This is contorted logic to check only one parameter. Need
    // to rewrite. Also allow opts["parameter"] to be list of parameters.
    var i = NaN;
    if (opts["parameter"]) {
      for (var i = 0; i < r["infoAll"][id].parameters.length; i++) {
        if (r["infoAll"][id].parameters[i].name === opts["parameter"]) {
          pn = i;
          break;
        }
      }
    }

    var parameter = r["infoAll"][id].parameters[pn].name;

    if (!parameter) {
      report(r,url,
            {
              "description": "Parameter #" + pn + " does not have a name.",
              "error": true,
              "got": "No name."
            },
            {"stop":true}
          );
      // Check next parameter
      datar(++pn);
      return;
    }

    let timeoutString = timeoutCondition(datar,"data");

    let url = encodeURI(opts["url"] 
            + '/data?id=' + datasets[0].id
            + '&parameters=' + parameter
            + '&time.min=' + start
            + '&time.max=' + stop);

    report(r,url);
    let reqOpts = requestOptions(url,opts,timeoutString,true);
    request(reqOpts,function (err,res,body) {

      if (err) {
        if (datar.tries === 0) {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true});
          datar(pn); // Try again
        } else {
          report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)),{"warn":true,"stop":true});
          // Start on next parameter
          datar(++pn);
        }
        return;
      }

      function next(pn) {
        if (!opts["parameter"]) {
          // Check next parameter
          datar(++pn);
        } else {
          // Case where one parameter given. See TODO above.
          datar(-1);
        }
      }

      plotLink(clientResponse,opts,url);

      report(r,url,is.RequestError(err,res,timeout(opts,timeoutString)));
      if (!report(r,url,is.HTTP200(res), {"stop": true})) {
        // Check next parameter
        next(pn);
        return;
      }

      var lines = body.split("\n");

      if (!report(r,url,is.FileStructureOK(body,"empty",res.statusMessage),{"stop": true})) {
        // Check next parameter
        next(pn);
        return;
      }
      if (!body || body.length === 0) {
        // Check next parameter
        next(pn);
        return;
      }

      report(r,url,is.CompressionAvailable(res.headers),{"warn":true});
      report(r,url,is.ContentType(/^text\/csv/,res.headers["content-type"]));
      report(r,url,is.CORSAvailable(res.headers),{"warn":true});

      report(r,url,is.FileStructureOK(body,"firstchar"));
      report(r,url,is.FileStructureOK(body,"lastchar"));
      report(r,url,is.FileStructureOK(body,"extranewline"));
      report(r,url,is.FileStructureOK(body,"numlines"));

      var line1 = lines[0].split(",");
      var time1 = line1[0].trim();
      if (lines[1]) {
        var line2 = lines[1].split(",")[0];
        var time2 = line2.trim();
      } else {
        var time2 = null;
      }
      versionCheckAndReport(r,url,opts,r["infoAll"][id].HAPI);
      let ret = is.HAPITime(lines,version(opts,r["infoAll"][id].HAPI));
      report(r,url,ret);
      if (ret.error === true) {
        next(pn);
        return;
      }

      report(r,url,is.CadenceOK(r["infoAll"][id]["cadence"],time1,time2,"consecsample"),{"warn":true});

      var timeLength = r["infoAll"][id].parameters[0].length;

      var warn = true;
      if (r['capabilities'] && r['capabilities']['outputFormats'].includes('binary')) {
        // If wrong length and server can serve binary, then error.
        warn = false;
      }
      report(r,url,is.CorrectLength(time1,timeLength,"Time",!warn),{"warn":warn});

      report(r,url,is.TimeIncreasing(lines,"CSV"));
      report(r,url,is.TimeInBounds(lines,start,stop));

      if (pn === 0) {
        // Time was requested parameter, no more columns to check
        report(r,url,is.SizeCorrect(line1.length-1,0,r["infoAll"][id].parameters[pn]),{"warn":false});
        // Check next parameter
        next(pn);
        return;
      }

      report(r,url,is.FileLineOK(r["infoAll"][id], body, pn, 'Ncolumns'));
      //report(r,url,is.FileLineOK(header, body, pn, 'fields'));
      //report(r,url,is.SizeCorrect(line1.length-1,nf-1,header.parameters[pn]),{"warn":true});

      report(r,url,is.FileContentSameOrConsistent(r["infoAll"][id],body,r['dataAll1Body'][id],'consistent',pn));

      next(pn);
    });
  }

}


// Helper functions

function setAndCheckOptions(argv, res) {
  const versions = require('./is.js').versions; // Array of implemented versions

  if (res === undefined) {
    output = argv["output"];
  } else {
    output = argv["output"] || "html";
  }

  let opts = {
    "url": argv["url"],
    "id": argv["id"] || argv["dataset"],
    "parameter": argv["parameter"] || argv["parameters"] || "",
    "start": argv["timemin"] || argv["start"],
    "stop": argv["timemax"] || argv["stop"],
    "version": argv["version"],
    "output": output,
    "datatimeout": parseInt(argv["datatimeout"]) || 5000,
    "metatimeout": parseInt(argv["metatimeout"]) || 1000,
    "plotserver": argv["plotserver"] || "http://hapi-server.org/plot",
  }

  if (opts.version && !versions().includes(opts.version)) {
    if (res) {
      res.status(400).end("<code>version</code> must be one of " + versions());
      return;
    }
    console.log("'version' must be one of ", versions());
    process.exit(1);
  }

  let parameter = opts["parameter"] || opts["parameters"] || "";
  if (opts["parameter"].trim() !== "") {
    if (opts["parameter"].split(",").length > 1) {
      if (res) {
        res.end("Only one parameter may be specified.");
        return;
      }
    }
  }

  return opts;
}

function versionParts(version) {
  let parts = version.split('.');
  return {"major": parseInt(parts[0]), "minor": parseInt(parts[1])};
}

function switchTimeFormat(timestr) {

  // Converts from YYYY-MM-DD to YYYY-DOY or vice-versa
  var timestrnew = timestr;
  if (/[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(timestr)) {
    timestrnew = moment(timestr.substring(0,10)).format("YYYY-DDDD");
    if (timestrnew === "Invalid date") {
      return timestrnew;
    } else {
      timestrnew = timestrnew + timestr.replace(/[0-9]{4}-[0-9]{2}-[0-9]{2}/,"");
    }
  } else if (/[0-9]{4}-[0-9]{3}/.test(timestr)) {
    timestrnew = moment(timestr.substring(0,8)).format("YYYY-MM-DD");
    if (timestrnew === "Invalid date") {
      return "";
    } else {
      timestrnew = timestrnew + timestr.replace(/[0-9]{4}-[0-9]{3}/,"");
    }
  }
  return timestrnew;

}

function versionCheckAndReport(r,url,opts,metaVersion) {

  let baseURL = opts['url'];
  if (versionCheckAndReport[baseURL] === undefined) {
    versionCheckAndReport[baseURL] = {};
  }
  if (versionCheckAndReport[baseURL].lastVersion !== undefined) {
    let obj = is.HAPIVersionSame(url, metaVersion,
                                versionCheckAndReport[baseURL].lastURL,
                                versionCheckAndReport[baseURL].lastVersion);
    report(r,url,obj,{"warn": true})
  }
  versionCheckAndReport[baseURL].lastVersion = metaVersion;
  versionCheckAndReport[baseURL].lastURL = url;

  if (!report(r,url,is.HAPIVersion(metaVersion),{"stop":false})) {
    return is.versions().pop(); // Use latest version
  } else {
    return metaVersion;
  }
}

function requestOptions(url,opts,timeoutType,gzip) {

  // "rejectUnauthorized": false because some servers return "Error:
  // certificate has expired" when testing from command line or localhost.
  return {
    "url": url,
    "timeout": timeout(opts,timeoutType)['value'],
    "time": true,
    "agentOptions": {"rejectUnauthorized": false},
    "gzip": gzip || false,
    "headers": {
            "User-Agent": "HAPI verifier; https://github.com/hapi-server/verifier-nodejs",
            "Origin": origin(url)
          }
  };
}

function version(opts,metaVersion) {
  if (opts["version"]) {
    return opts["version"]; // Use version given in URL
  } else {
    if (!is.HAPIVersion(metaVersion)) {
      return is.versions().pop(); // Use latest version
    } else {
      return metaVersion;
    }
  }
}

function timeoutCondition(func,reqType) {

  // TODO: Setting tries to 0 in function named timeoutCondition is opaque.
  if (func.tries === undefined) {
    func.tries = 0
  } else {
    func.tries += 1;
  }

  if (func.tries === 0) {
    if (reqType === 'metadata') {
      return "metadefault";
    }
    if (reqType === 'data') {
      return "datadefault";
    }
  } else {
    if (reqType === 'metadata') {
      return "metapreviousfail";
    }
    if (reqType === 'data') {
      return "datapreviousfail";
    }
  }

}

function timeout(opts, timeoutType) {

  let obj = {
    "datadefault": {
      "value": opts["datatimeout"],
      "when":"time.min/max not given to validator, sampleStart/Stop not given, and no cadence is in /info response and a default request is made for startDate to startDate + P1D."
    },
    "datapreviousfail": {
      "value": 2*opts["datatimeout"],
      "when": "a previous request for data failed or timed out."
    },
    "datasample10xcadence": {
      "value": opts["datatimeout"],
      "when":"time.min/max not given to validator, sampleStart/Stop not given, but cadence is in /info response."
    },
    "datasamplesuggested": {
      "value": opts["datatimeout"],
      "when":"time.min/max not given to validator but sampleStart/Stop is given in /info response."
    },
    "datasamplechosen": {
      "value": opts["datatimeout"],
      "when":"time.min/max given to validator"
    },
    "metadefault": {
      "value": opts["metatimeout"],
      "when":"request is for metadata."
    },
    "metapreviousfail": {
      "value": 2*opts["metatimeout"],
      "when":"a previous request for metadata failed or timed out."
    }
  };

  return obj[timeoutType]
}

function plotLink(clientResponse, opts, url) {

  if (clientResponse && opts["output"] === "html") {
    let localplotserver = /localhost/.test(opts["plotserver"]);
    let localtesturl = /localhost/.test(opts["url"]);
    if ((localplotserver && localtesturl) || localtesturl == false) {
    }
  }

  if (clientResponse && opts["output"] === "html") {
    let localplotserver = /localhost/.test(opts["plotserver"]);
    let localtesturl = /localhost/.test(opts["url"]);
    if ((localplotserver && localtesturl) || localtesturl == false) {
      if (url.startsWith('http')) {
        var link = opts["plotserver"]+"?usecache=false&usedatacache=false&server=" + url.replace("/data?","&");
        var note = "<a target='_blank' href='" + link + "'>Direct link for following plot.</a>. "
                 + "Please report any plotting issues at "
                 + "<a target='_blank' href='https://github.com/hapi-server/plot-python/issues'>the Python <code>hapiplot</code> GitHub page</a>.";
        clientResponse.write("&nbsp&nbsp;<font style='color:black'>☞</font>&nbsp" + note + "<br><img src='" + link + "'/><br>");
      } else {
        var link = opts["plotserver"]+"?server=" + opts["url"] + "&id=" + url + "&format=gallery";
        var note = "<a target='_blank' href='" + link + "'>Visually check data and test performance</a>";
        clientResponse.write("&thinsp;👁&nbsp;" + note + "<br>");
      }
    } else {
      clientResponse.write("&nbsp;&nbsp;&nbsp;&nbsp; <i>Cannot plot b/c server URL is localhost and no localhost plotserver given as command line argument when starting verifier server.</i><br>");
    }
  }
}

function origin(urlstr) {
  const urlc = new URL(urlstr);
  let url = urlc.protocol + "//" + ip.address();
  if (url.port) {
    url = url + ":" + url.port;
  }
  return url;
}

function errors(num) {

  var errs = 
    {
      "1400": {"status":{"code": 1400, "message": "HAPI error 1400: user input error"}},
      "1401": {"status":{"code": 1401, "message": "HAPI error 1401: unknown request field"}},
      "1402": {"status":{"code": 1402, "message": "HAPI error 1402: error in start time"}},
      "1403": {"status":{"code": 1403, "message": "HAPI error 1403: error in stop time"}},
      "1404": {"status":{"code": 1404, "message": "HAPI error 1404: start time equal to or after stop time"}},
      "1405": {"status":{"code": 1405, "message": "HAPI error 1405: time outside valid range"}},
      "1406": {"status":{"code": 1406, "message": "HAPI error 1406: unknown dataset id"}},
      "1407": {"status":{"code": 1407, "message": "HAPI error 1407: unknown dataset parameter"}},
      "1408": {"status":{"code": 1408, "message": "HAPI error 1408: too much time or data requested"}},
      "1409": {"status":{"code": 1409, "message": "HAPI error 1409: unsupported output format"}},
      "1410": {"status":{"code": 1410, "message": "HAPI error 1410: unsupported include value"}},
      "1500": {"status":{"code": 1500, "message": "HAPI error 1500: internal server error"}},
      "1501": {"status":{"code": 1501, "message": "HAPI error 1501: upstream request error"}}
    };

  return errs[num+""];
}

function uncaughtException(err, clientResponse) {
  if (clientResponse) {
    clientResponse.end('<br><br><div style="border:2px solid black"><b><font style="color:red"><b>Problem with verification server (Uncaught Exception). Aborting. Please report last URL shown above in report to the <a href="https://github.com/hapi-server/verifier-nodejs/issues">issue tracker</a>.</b></font></div>');
    console.log(err.stack);
  } else {
    console.log("Problem with verification server (Uncaught Exception). Aborting.");
    console.log(err.stack);
    process.exit(1);
  }
}

function removeDuplicates(arr,key) {

  // Remove array elements with objects having key value that that is not unique.
  // Keep first unique.

  // [{key: value}, ...] -> {value: {key: value}, ...}
  let obj = {};
  for (let i = 0; i < arr.length; i++) {
    obj[arr[i][key]] = arr[i];
  }

  arr = [];
  let keysr = Object.keys(obj).reverse();
  for (let i = 0; i < keysr.length; i++) {
    arr.push(obj[keysr[i]]);
  }

  return arr.reverse();
}

function selectOne(arr,key,value) {

  // Return first array element with an object that has a key with the given
  // value. TODO: Allow value to be an array.

  arr = JSON.parse(JSON.stringify(arr)); // Deep copy.
  let found = false;
  let ids = [];
  let k = 0;
  while (arr.length > 0) {
    found = arr[0][key] === value;
    ids[k] = arr[0][key];
    k = k + 1;
    if (found) {
      break;
    } else {
      arr.shift();
    }
  }

  if (found) {
    arr = [arr[0]];
  }

  return arr;
}

function selectDatasets(datasets,opts) {

  if (!opts["id"]) {
    return datasets;
  }

  // 'id' given in client request
  // Assume opts["id"] is a regular expression if starts with ^
  if (!opts["id"].startsWith("^")) {
    // Only check one dataset with id = opts["id"].
    datasets = selectOne(datasets,'id',opts["id"]);
  } else {
    let datasetsr = []; // reduced dataset list
    for (let i = 0; i < datasets.length; i++) {
        let re = new RegExp(opts["id"]);
        if (re.test(datasets[i]["id"])) {
          datasetsr.push(datasets[i]);
          continue;
        }
    }
    datasets = datasetsr;
  }
  return datasets;
}
