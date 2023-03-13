const fs = require('fs');
const clc = require('chalk');

function report(url,obj,opts) {

  let reqOpts = report.reqOpts;
  let RES = report.RES;
  let CATALOG = report.CATALOG;

  // Returns !(obj.error && (stop || abort))
  // stop means processing can't continue on current URL
  // Abort means can't move to testing next URL.
  // Note that abort = true implies stop = true.
  if (obj == false) return false; // Case where test was not appropriate.

  if (opts) {
    var warn  = opts["warn"]  || false; // Warn not fail message on error
    var stop  = opts["stop"]  || false; // Need to stop tests on current URL
    var abort = opts["abort"] || false; // Stop and send abort all processing
    var shush = opts["shush"] || false; // Don't print unless warning, error, or url changed
  } else {
    var warn  = false;
    var stop  = false;
    var abort = false;
    var shush = false;
  }

  var shush = false;
  var stop = stop || abort; // Make stop true when abort true.

  let firstshush = false; 
  if (shush && report.shushon == false) {
    // Don't print pass results for long list of similar tests.
    firstshush = true
  }
  report.shushon = shush;

  if (!url) {
    // Print summary when report() called.
    summary(RES, reqOpts, CATALOG);
    return;
  }

  if (typeof(report.url) === "undefined") {

    // First call to report().
    // Initialize and attach arrays to report object.

    if (reqOpts["output"] === "html") {
      RES.write("<html><body>");
    }

    if (reqOpts["version"]) {
      let msg = "Using HAPI schema version " + reqOpts["version"];
      if (reqOpts["output"] === "html") {
        let url = "https://github.com/hapi-server/verifier-nodejs";
        url = url + "/tree/master/schemas/HAPI-data-access-schema-";
        var linkopen = "<a href='" + url + reqOpts["version"] + ".json'>";
        RES.write("Using " + linkopen + msg + "</a><br>");
      } else if (reqOpts["output"] === "console") {
        console.log(msg);
      }
    }

    report.fails = [];  // Initalize failure array
    report.passes = []; // Initalize passes array     
    report.warns = [];  // Initalize warning array  

    // Parse is.js to get line numbers for test functions.
    var istext = fs.readFileSync(__dirname + '/is.js').toString();
    istext = istext.split("\n");
    report.lineobj = {};
    // Store locations in report.lineobj array.
    // TODO: This should happen on server start not here.
    for (var i = 0;i<istext.length;i++) {
      if (istext[i].match(/^function/)) {
        key = istext[i].replace(/^function (.*)?\(.*/,"$1");
        report.lineobj[key] = i+1;
      }
    }
  }

  var indentcons = ""; // Indent console
  var indenthtml = ""; // Indent html
  if (/\/hapi\/data/.test(url)) {
    // Indent extra amount when testing data url
    var indentcons = "  ";
    var indenthtml = "&nbsp;&nbsp;"
  }

  if (report.url !== url) { 
    // Display URL only if not the same as last one seen or requested to
    // be displayed when report() was called.
    if (reqOpts["output"] === "html") {
      RES.write("<br>" 
                  + indenthtml 
                  + "<font style='color:blue'><a href='" + url + "'>" 
                  + url.replace(/\&parameters/,"&amp;parameters") 
                  + "</a></font></br>");
    } else if (reqOpts["output"] === "console") {
      console.log("\n" + indentcons + clc.blue(url));      
    }
  }

  report.url = url;
  if (!obj) {
    // If report(url) was called, only print URL so user knows
    // it is being requested.
    return;
  }; 

  obj.url = url;
  if (reqOpts["output"] === "html") {
    // Get function name from description in obj and replace it
    // with a link to GitHub code.
    var key = obj.description.replace(/^is\.(.*?)\(.*/,"$1");
    obj.description = obj.description.replace(/^(is.*?):/,"<a href='https://github.com/hapi-server/verifier-nodejs/blob/master/is.js#L__LINE__'>$1</a>");
    obj.description = obj.description.replace(/__LINE__/,report.lineobj[key]);
  }
  if (obj.error == true && warn == false) {
    report.fails.push(obj)
    if (reqOpts["output"] === "html") {
      RES.write(indenthtml 
                + "&nbsp&nbsp;<font style='background-color:red'><b>&#x2715;</b></font>:&nbsp" 
                + obj.description + ";&nbsp;Got: <b><pre>" 
                + obj.got.toString().replace(/</g,"&lt;").replace(/>/g,"&gt;") 
                + "</pre></b><br>");
    } else if (reqOpts["output"] === "console") {
      console.log(indentcons 
                  + "  " 
                  + clc.inverse.red("Fail") 
                  + ": " 
                  + obj.description 
                  + "; Got: " 
                  + clc.bold(obj.got));      
    }
  } else if (obj.error == true && warn == true) {
    report.warns.push(obj)

    var msg = obj.got.toString().replace(/</g,"&lt;").replace(/>/g,"&gt;");
    if (reqOpts["output"] === "html") {
      RES.write(indenthtml 
                + "&nbsp&nbsp;<font style='background-color:yellow'><b>&#x26a0;</b></font>:&nbsp;" 
                + obj.description 
                + ";&nbsp;Got:&nbsp<b><pre>" 
                + msg 
                + "</pre></b><br>");
    } else if (reqOpts["output"] === "console") {
      console.log(indentcons 
                + "  " 
                + clc.yellowBright.inverse("Warn") 
                + ": " 
                + obj.description 
                + "; Got: " 
                + clc.bold(obj.got));      
    }
  } else {
    report.passes.push(obj);
    if (firstshush) {
      if (reqOpts["output"] === "html") {
        RES.write(indenthtml + "&nbsp&nbsp;Passes are being suppressed.<br>");
      } else if (reqOpts["output"] === "console") {
        console.log(indentcons + "  " + "Passes are being suppressed.");        
      }
    }
    if (report.shushon == false) {
      if (reqOpts["output"] === "html") {
        RES.write(indenthtml 
                      + "&nbsp&nbsp;<font style='background-color:green;'><b>&#x2713;</b></font>:&nbsp;" 
                      + obj.description 
                      + ";&nbsp;Got:&nbsp<b>" 
                      + obj.got.toString().replace(/\n/g,"<br>") 
                      + "</b><br>");
      } else if (reqOpts["output"] === "console") {
        console.log(indentcons 
                      + "  " 
                      + clc.green.inverse("Pass") 
                      + ": " 
                      + obj.description 
                      + "; Got: " 
                      + clc.bold(obj.got));        
      }
    }
  }

  if (obj.error && stop) {
    if (abort) {
      if (reqOpts["output"] === "html") {
        RES.end("<font style='color:red'>Cannot continue validation tests due to last failure.</font></body></html>");
        //RES.end();
      } else if (reqOpts["output"] === "console") {
        console.log(clc.red("\nCannot continue validation tests due to last failure. Exiting with signal 1."));
        process.exit(1);
      }
    } else {
      if (reqOpts["output"] === "html") {
        RES.write("<br>&nbsp&nbsp;<font style='color:red'>Cannot continue tests on URL due to last failure.</font><br>");
      } else if (reqOpts["output"] === "console") {
        console.log(clc.red("\nCannot continue tests on URL due to last failure."));        
      }
    }
  }

  // If no error, return true.  If stopping error, return false
  return !(obj.error && stop) 
}
exports.report = report;

function summary(RES, reqOpts, CATALOG) {

  if (reqOpts["output"] === "html") {
    RES.write("<p>End of validation tests.</p><p>Summary: <font style='color:black;background:green'>Passes</font>:&nbsp;" + report.passes.length + ". <font style='color:black;background:yellow'>Warnings</font>:&nbsp;" + report.warns.length + ". <font style='background:red;color:black'>Failures</font>:&nbsp;" + report.fails.length + ".");
  } else if (reqOpts["output"] === "console") {
    console.log("End of validation tests.");
  }
  if (report.warns.length + report.fails.length > 0) {
    if (reqOpts["output"] === "html") {
      RES.write("Warnings and failures repeated below.</p>");
    } else if (reqOpts["output"] === "console") {
      console.log("\nWarnings and failures repeated below.");
    }
  }

  if (reqOpts["output"] === "console") {
    console.log("*".repeat(80));
    console.log("Summary: " 
                  + clc.green.inverse('Passes') 
                  + ": " 
                  + report.passes.length 
                  + ". " 
                  + clc.yellowBright.inverse('Warnings') 
                  + ": " 
                  + report.warns.length 
                  + ". " 
                  + clc.inverse.red('Failures') 
                  + ": " + report.fails.length 
                  + ".");
    if (report.warns.length + report.fails.length > 0) {
      console.log("Warnings and failures repeated below.");
    } 
    console.log("*".repeat(80));
  }
  if (reqOpts["output"] !== "json") {
    for (var i = 0;i < report.warns.length; i++) {
      if (reqOpts["output"] === "html") {
        RES.write("<br><a href='" 
                  + report.warns[i].url.replace(/\&parameters/,"&amp;parameters") 
                  + "'>" 
                  + report.warns[i].url.replace(/\&parameters/,"&amp;parameters") 
                  + "</a><br>");
      } else {
        console.log("|" + clc.blue(report.warns[i].url));
      }
      if (reqOpts["output"] === "html") {
        RES.write("&nbsp;&nbsp;<font style='color:black;background:yellow'>Warn:</font>&nbsp;" 
                  + report.warns[i].description 
                  + "; Got: <b>" 
                  + report.warns[i].got.toString().replace(/\n/g,"<br>") 
                  + "</b><br>");
      } else {
        console.log("|  " 
                    + clc.yellowBright.inverse("Warn") 
                    + " " 
                    + report.warns[i].description 
                    + "; Got: " 
                    + clc.bold(report.warns[i].got));        
      }
    }
    for (var i = 0; i < report.fails.length; i++) {
      if (reqOpts["output"] === "html") {
        RES.write("<br><a href='" 
                  + report.fails[i].url.replace(/\&parameters/,"&amp;parameters") 
                  + "'>" 
                  + report.fails[i].url.replace(/\&parameters/,"&amp;parameters") 
                  + "</a><br>");
      } else {
        console.log("|" + clc.blue(report.fails[i].url));
      }
      if (reqOpts["output"] === "html") {
        RES.write("&nbsp;&nbsp;<font style='color:black;background:red'>Fail</font>&nbsp;" 
                  + report.fails[i].description 
                  + "; Got: <b><pre>" 
                  + report.fails[i].got.toString().replace(/</g,"&lt;").replace(/>/g,"&gt;") 
                  + "</pre></b><br>");
      } else {
        console.log("|  " 
                    + clc.red.inverse("Fail") 
                    + " " + report.fails[i].description 
                    + "; Got: " 
                    + clc.bold(report.fails[i].got));
      }
    }
  }

  if (reqOpts["output"] === "html") {
    RES.write("<br><br>");
    RES.write("<b>Use the following links for visual checks of data and stress testing server.</b><br><br>")
    for (var i = 0;i < CATALOG["catalog"].length;i++) {
      var link = report.reqOpts["plotserver"] 
                  + "?server=" 
                  + report.reqOpts["url"] 
                  + "&id=" 
                  + CATALOG["catalog"][i]["id"] 
                  + "&format=gallery";
      RES.write("<a target='_blank' href='" + link + "'>" + link + "</a><br>");
    }
    RES.end("</body></html>");
  } else if (reqOpts["output"] === "console") {
    if (report.fails.length == 0) {
      console.log("\nEnd of summary. Exiting with signal 0.");
      process.exit(0); // Normal exit.
    } else {
      console.log("\nEnd of summary. Exiting with signal 1 due to failure(s).");
      process.exit(1);
    }
  } else if (reqOpts["output"] === "json") {
    let obj = { 
                "pass": report.fails.length == 0,
                "warns": report.warns,
                "fails": report.fails,
              }
    if (RES) {
      RES.end(JSON.stringify(obj, null, 2));
    } else {
      console.log(JSON.stringify(obj, null, 2));
      if (report.fails.length == 0) {
        process.exit(0); // Normal exit.
      } else {
        process.exit(1);
      }
    }
  }

}
