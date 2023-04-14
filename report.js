const fs = require('fs');
const clc = require('chalk');

function report(r,url,obj,opts) {

  let reqOpts = r.opts;
  let res = r.res;

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
    summary(r);
    return;
  }

  if (!url || !r.stats) {

    // First call to report(). Initialize and attach arrays to report object.

    if (!r.stats) {
      r.stats = {};
    }
    r.stats = {"fails": [], "passes": [], "warns": []};

    if (reqOpts["output"] === "html") {
      res.write("<html><body>");
    }

    if (reqOpts["version"]) {
      let msg = "Using HAPI schema version " + reqOpts["version"];
      if (reqOpts["output"] === "html") {
        let url = "https://github.com/hapi-server/verifier-nodejs";
        url = url + "/tree/master/schemas/HAPI-data-access-schema-";
        var linkopen = "<a href='" + url + reqOpts["version"] + ".json'>";
        res.write("Using " + linkopen + msg + "</a><br>");
      } else if (reqOpts["output"] === "console") {
        console.log(msg);
      }
    }

    // Parse is.js to get line numbers for test functions.
    var istext = fs.readFileSync(__dirname + '/is.js').toString();
    istext = istext.split("\n");
    report.lineobj = {};
    // Store locations in report.lineobj array.
    // TODO: This should happen on server start not here.
    for (var i = 0;i < istext.length; i++) {
      if (istext[i].match(/^function/)) {
        key = istext[i].replace(/^function (.*)?\(.*/,"$1");
        report.lineobj[key] = i+1;
      }
    }
  }

  let stats = r.stats;

  if (report.url !== url) { 
    // Display URL only if not the same as last one seen or requested to
    // be displayed when report() was called.
    writeURL(url, res);
  }

  report.url = url;
  if (!obj) {
    // If report(url) was called, only print URL.
    return;
  }; 

  obj.url = url;
  if (obj.error == true && warn == false) {
    r.stats.fails.push(obj)
    writeResult(obj, "error", res);
  } else if (obj.error == true && warn == true) {
    r.stats.warns.push(obj)
    writeResult(obj, "warn", res);
  } else {
    r.stats.passes.push(obj);
    if (firstshush) {
      writeNote("Passes are being suppressed.","", res);
    }
    if (report.shushon == false) {
      writeResult(obj, 'pass', res)
    }
  }

  if (obj.error && stop) {
    if (abort) {
      let msg = "Cannot continue any validation tests due to last failure.";
      if (reqOpts["output"] === "html") {
        res.end(`<br><font style='color:red'>${msg}</font></body></html>`);
      } else if (reqOpts["output"] === "console") {
        console.log("\n" + clc.red(msg + " Exiting with signal 1."));
        process.exit(1);
      }
    } else {
      let msg = "Cannot continue tests on URL due to last failure.";
      if (reqOpts["output"] === "html") {
        res.write(`<br><font style='color:red'>${msg}</font><br>`);
      } else if (reqOpts["output"] === "console") {
        console.log("\n" + clc.red(msg));
      }
    }
  }

  // If no error, return true.  If stopping error, return false
  return !(obj.error && stop) 
}
exports.report = report;

function writeURL(url, res) {

  if (!res) {
    console.log("\n" + clc.blue(url));
    return;
  }

  res.write("<br>" 
            + "<font style='color:blue'><a href='" + url + "'>" 
            + url.replace(/\&parameters/,"&amp;parameters") 
            + "</a></font></br>");
}

function writeNote(msg, style, res) {
  if (res) {
    res.write(msg + "<br>");
  } else {
    console.log(msg + "Passes are being suppressed.");        
  }
}

function writeResult(obj, status, res) {

  if (res === undefined) {
    let icon = clc.green.inverse("✓");
    if (status === "warn") {
      clc.yellowBright.inverse("⚠");
    }
    if (status === "error") {
      clc.inverse.red("✗");
    }
    let desc = obj.description;
    console.log("  " + icon + ": " + desc + "; Got: " + clc.bold(obj.got));
    return;
  }

  let icon = "<font style='background-color:green;'><b>&#x2713;</b></font>&nbsp;";
  if (status === "warn") {
    icon = "<font style='background-color:yellow'><b>&#x26a0;</b></font>";
  }
  if (status === "error") {
    icon = "<font style='background-color:red'><b>&#x2717;</b></font>";
  }

  // Get function name from description in obj and replace it
  // with a link to GitHub code.
  var key = obj.description.replace(/^is\.(.*?)\(.*/,"$1");
  let description = obj.description.replace(/^(is.*?):/,"<a href='https://github.com/hapi-server/verifier-nodejs/blob/master/is.js#L__LINE__'>$1</a>: ");
  description = description.replace(/__LINE__/,report.lineobj[key]);
  let got = obj.got.toString().replace(/</g,"&lt;").replace(/>/g,"&gt;");

  let line = `
              <table>
                <tr>
                  <th>${icon}</th>
                  <td>${description}</td>
                </tr>
                <tr>
                  <th></th>
                  <td><b>Got</b>: ${got}</td>
                </tr>
              </table>
            `;
  res.write(line);
}

function summary(r) {

  let res = r.res;
  let reqOpts = r.opts;
  let CATALOG = r.catalog;
  let stats = r.stats;

  if (reqOpts["output"] === "html") {
    res.write("<p>End of validation tests.</p>"
            + "<p>Summary: "
            + "<font style='color:black;background:green'>Pass</font>: "
            + stats.passes.length + ". "
            + "<font style='color:black;background:yellow'>Warns</font>:"
            + stats.warns.length + ". "
            + "<font style='background:red;color:black'>Fails</font>:"
            + stats.fails.length + ".");
  } else if (reqOpts["output"] === "console") {
    console.log("End of validation tests.");
  }
  if (stats.warns.length + stats.fails.length > 0) {
    if (reqOpts["output"] === "html") {
      res.write("Warnings and failures repeated below.</p>");
    } else if (reqOpts["output"] === "console") {
      console.log("\nWarnings and failures repeated below.");
    }
  }

  if (reqOpts["output"] === "console") {
    console.log("*".repeat(80));
    console.log("Summary: " 
                  + clc.green.inverse('Pass') 
                  + ": " 
                  + stats.passes.length 
                  + ". " 
                  + clc.yellowBright.inverse('Warn') 
                  + ": " 
                  + stats.warns.length 
                  + ". " 
                  + clc.inverse.red('Fail') 
                  + ": " + stats.fails.length 
                  + ".");
    if (stats.warns.length + stats.fails.length > 0) {
      console.log("Warnings and failures repeated below.");
    } 
    console.log("*".repeat(80));
  }

  if (reqOpts["output"] !== "json") {
    for (var i = 0;i < stats.warns.length; i++) {
      if (reqOpts["output"] === "html") {
        res.write("<br><a href='" 
                  + stats.warns[i].url.replace(/\&parameters/,"&amp;parameters") 
                  + "'>" 
                  + stats.warns[i].url.replace(/\&parameters/,"&amp;parameters") 
                  + "</a><br>");
      } else {
        console.log("|" + clc.blue(stats.warns[i].url));
      }
      if (reqOpts["output"] === "html") {
        res.write("&nbsp;&nbsp;<font style='color:black;background:yellow'>Warn:</font>&nbsp;" 
                  + stats.warns[i].description 
                  + "; Got: <b>" 
                  + stats.warns[i].got.toString().replace(/\n/g,"<br>") 
                  + "</b><br>");
      } else {
        console.log("|  " 
                    + clc.yellowBright.inverse("Warn") 
                    + " " 
                    + stats.warns[i].description 
                    + "; Got: " 
                    + clc.bold(stats.warns[i].got));        
      }
    }
    for (var i = 0; i < stats.fails.length; i++) {
      if (reqOpts["output"] === "html") {
        res.write("<br><a href='" 
                  + stats.fails[i].url.replace(/\&parameters/,"&amp;parameters") 
                  + "'>" 
                  + stats.fails[i].url.replace(/\&parameters/,"&amp;parameters") 
                  + "</a><br>");
      } else {
        console.log("|" + clc.blue(stats.fails[i].url));
      }
      if (reqOpts["output"] === "html") {
        res.write("&nbsp;&nbsp;<font style='color:black;background:red'>Fail</font>&nbsp;" 
                  + stats.fails[i].description 
                  + "; Got: <b><pre>" 
                  + stats.fails[i].got.toString().replace(/</g,"&lt;").replace(/>/g,"&gt;") 
                  + "</pre></b><br>");
      } else {
        console.log("|  " 
                    + clc.red.inverse("Fail") 
                    + " " + stats.fails[i].description 
                    + "; Got: " 
                    + clc.bold(stats.fails[i].got));
      }
    }
  }

  if (reqOpts["output"] === "html") {
    // TODO: Next three lines also appear in tests.js
    //let localplotserver = /localhost/.test(r.opts["plotserver"]); // r not defined when report() called.
    //let localtesturl = /localhost/.test(url);
    //if ((localplotserver && localtesturl) || !localtesturl) {
      res.write("<br><br>");
      res.write("<b>Use the following links for visual checks of data and stress testing server.</b><br><br>")
      for (var i = 0;i < CATALOG["catalog"].length;i++) {
        var link = reqOpts["plotserver"] 
                    + "?server=" 
                    + reqOpts["url"] 
                    + "&id=" 
                    + CATALOG["catalog"][i]["id"] 
                    + "&format=gallery";
        res.write("<a target='_blank' href='" + link + "'>" + link + "</a><br>");
      }
    //}
    res.end("</body></html>");
  } else if (reqOpts["output"] === "console") {
    if (stats.fails.length == 0) {
      console.log("\nEnd of summary. Exiting with signal 0.");
      process.exit(0); // Normal exit.
    } else {
      console.log("\nEnd of summary. Exiting with signal 1 due to failure(s).");
      process.exit(1);
    }
  } else if (reqOpts["output"] === "json") {
    let obj = { 
                "passes": stats.passes,
                "warns": stats.warns,
                "fails": stats.fails,
              }
    if (res) {
      res.end(JSON.stringify(obj, null, 2));
    } else {
      console.log(JSON.stringify(obj, null, 2));
      if (stats.fails.length == 0) {
        process.exit(0); // Normal exit.
      } else {
        process.exit(1);
      }
    }
  }
}
