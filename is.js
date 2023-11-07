var fs        = require('fs');
var moment    = require('moment');
var Validator = require('jsonschema').Validator;
var diff      = require('deep-diff').diff;

let schemaURL = "https://github.com/hapi-server/verifier-nodejs/tree/master/schemas";
let wikiURL   = 'https://github.com/hapi-server/verifier-nodejs/wiki';
let requestURL   = 'https://github.com/request/request#requestoptions-callback';
let jsonLintLink = "<a href='http://jsonlint.org/'>http://jsonlint.org/</a>";
let unitsAndLabels = "https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#369-unit-and-label-arrays";

// TODO: Get this list by reading directory.
let base = "./data-specification-schema/HAPI-data-access-schema";
var schemas = {};
schemas["1.1"] = require(base + "-1.1.json");
schemas["2.0"] = require(base + "-2.0-1.json");
schemas["2.1"] = require(base + "-2.1.json");
schemas["3.0"] = require(base + "-3.0.json");
schemas["3.1"] = require(base + "-3.1.json");

function sameSize(size1, size2) {
  if (!Array.isArray(size1)) size1 = [size1];
  if (!Array.isArray(size2)) size2 = [size2];
  if (size1.length != size2.length) return false;
  for (let i in size1) {
    if (size1[i] !== size2[i]) {
      return false;
    }
  }
  return true;
}

function prod(arr) {
  // TODO: Also in tests.js. Move to lib.js (and create lib.js)
  // Compute product of array elements.
  return arr.reduce(function(a,b){return a*b;})
}

function callerName() {
  return "is." + callerName.caller.name + "(): ";
}

function isinteger(str) {
  return parseInt(str) < 2^31 - 1 &&
         parseInt(str) > -2^31 && 
         parseInt(str) == parseFloat(str) &&
         /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim());
}

function isfloat(str) {
  return Math.abs(parseFloat(str)) < Number.MAX_VALUE &&
         /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim())
}

function nFields(header, pn) {

  if (pn !== undefined && pn !== null) {
    // One parameter
    // nf = number of fields (columns) counter (start at 1 since time checked already)
    var nf = 1; 
    if (!header.parameters[pn]["size"]) {
      nf = nf + 1; // Width of field (number of columns of field)
    } else {
      nf = nf + prod(header.parameters[pn]["size"]);
    }
  } else {
    // All parameters
    var nf = 0; // Number of fields (columns) counter
    for (var i = 0;i < header.parameters.length;i++) {
      if (!header.parameters[i]["size"]) {
        nf = nf + 1; // Width of field (number of columns of field)
      } else {
        nf = nf + prod(header.parameters[i]["size"]);
      }   
    }
  }
  return nf;  
}

function csvToArray(text) {
  // https://stackoverflow.com/a/41563966/1491619
  let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
  for (l of text) {
    if ('"' === l) {
      if (s && l === p) row[i] += l;
      s = !s;
    } else if (',' === l && s) l = row[++i] = '';
    else if ('\n' === l && s) {
      if ('\r' === p) row[i] = row[i].slice(0, -1);
      row = ret[++r] = [l = '']; i = 0;
    } else row[i] += l;
    p = l;
  }
  return ret;
}

function splitCSV(bodyString) {

  let headerString = "";
  let bodyLines = bodyString.split(/\r?\n/);
  for (var i = 0; i < bodyLines.length; i++) {
    if (bodyLines[i][0] === "#") {
      headerString = headerString + bodyLines[i].slice(1);
    } else {
      break;
    }
  }
  let dataString = bodyLines.slice(i).join("\n");
  return {
    "header": headerString,
    "data": dataString
  };
}

function versionWarning(version) {
  if (parseFloat(version) >= 3.0) {
    return `; <span style="background-color: yellow">Warning: HAPI schema version ${version} is in development. Some errors reported by schema check may not actually be errors and not all features are checked.</span>`;
  }
  return "";
}

function versions() {
  let arr = [];
  for (key in schemas) {
    arr.push(key);
  }
  return arr.sort();
}
exports.versions = versions;

function HAPIVersionSame(url, version, urlLast, versionLast) {
  let des = "Expect HAPI version to match that from last requests where found.";
  let got = `Current: '<code>${version}</code>' and Last: '<code>${versionLast}</code>'`;
  let err = false;
  if (version !== versionLast) {
    got = `<code>${version}</code> for ${url}\n<code>${versionLast}</code> for ${urlLast}`;
    err = true;
  }
  return {
    "description": callerName() + des,
    "error": err,
    "got": got
  };
}
exports.HAPIVersionSame = HAPIVersionSame;

function HAPIVersion(version, ignoreVersionError) {

  let got = "<code>" + version + "</code>";
  let err = false;
  if (!versions().includes(version)) {
    err = true;
    got = "'<code>" + version + "</code>', which is not valid or not implemented by verifier.";
    if (ignoreVersionError) {
      got += " Will use latest version implemented by verifier: " + versions().pop();
    }
  }

  let des = "Expect HAPI version in JSON response to be one of "
          + "<code>"
          + JSON.stringify(versions())
          + "</code>";
  return {
    "description": callerName() + des,
    "error": err,
    "got": got
  };
}
exports.HAPIVersion = HAPIVersion;

function schema(version) {
  let json = schemas[version];
  if (!json) {
    return false;
  } else {
    return schemas[version];
  }
}
exports.schema = schema;

function JSONParsable(text) {

  let ret = {
    "description": callerName() + "Expect <code>JSON.parse(response)</code> to not throw error",
    "error": false,
    "got": ""
  };

  try {
    let json = JSON.parse(text);
    ret['json'] = json;
    return ret;
  } catch (error) {
    ret.got = "JSON.parse of:\n\n" + text + "\n\nresulted in " + error 
            + ". Use " + jsonLintURL
            + " for a more detailed error report. ";
    ret.error = true;
    return ret;
  }
}
exports.JSONParsable = JSONParsable;

function HAPIJSON(text, version, part, ignoreVersionError) {

  let s = schema(version);

  if (s == false) {
    let known = JSON.stringify(Object.keys(schemas));
    let desc = "Expect HAPI version to be one of <code>" + known + "</code>"; 
    let got = `Schema version '<code>${version}</code>' is not one of <code>${known}</code>`;
    return {
        "description": callerName() + desc,
        "error": true,
        "got": got
      };
  }

  if (typeof(text) === "object") {
    var json = text;
  } else {
    var json = JSON.parse(text);
  }

  var v = new Validator();
  // Look for all top-level elements that have an id starting with a /.
  // These are subschemas that are used.
  for (key in s) {
    if (s[key]["id"] && s[key]["id"][0] === "/") {
      //console.log("Adding schema " + s[key]["id"]);
      v.addSchema(s[key], s[key]["id"]);
    }
  }

  try {
    var vr = v.validate(json, s[part]);
  } catch (e) {
    console.log(e)
    return {
        "description": callerName() + "Call to JSON validator failed.",
        "error": true,
        "got": "Schema error: " + e
      };
  }

  let ve = vr.errors;
  let got = "JSON is valid with respect to JSON schema."
  let err = [];
  if (ve.length != 0) {
    for (let i = 0; i < ve.length; i++) {
      if (ignoreVersionError && ve[i].property == "instance.HAPI") {
        continue;
      }
      err[i] = ve[i].property.replace("instance.","") 
             + " " + ve[i].message.replace(/\"/g,"'");
    }
    if (err.length > 0) {
      got = "\n  " + JSON.stringify(err,null,4).replace(/\n/g,"\n  ");
    }
  }

  let url = schemaURL + "/HAPI-data-access-schema-" + version + ".json";
  let desc = "Expect body to be valid "
           + "<a href='" + url + "'>HAPI " 
           + version + " '" + part + "' schema</a>."
           + versionWarning(version);

  return {
    "description": callerName() + desc,
    "error": err.length != 0,
    "got": got
  };
}
exports.HAPIJSON = HAPIJSON;

function timeregexes(version) {
  let json = schemas[version];
  if (!json) {
    return false;
  }
  let tmp = json.HAPIDateTime.anyOf;
  let regexes = [];
  for (let i = 0; i < tmp.length; i++) {
    regexes[i] = tmp[i].pattern;
  }
  return regexes;
}
exports.timeregexes = timeregexes;

function trailingZfix(str) {
  // moment.js does not consider date only with trailing Z to be valid ISO8601
  if (/^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]Z$|^[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]Z$/.test(str)) {
    str = str.slice(0, -1) + "T00Z";
  } 
  return str;
}
exports.trailingZfix = trailingZfix;

function RequestError(err, res, timeoutType, timeoutObj) {

  var tout = timeoutObj[timeoutType]["timeout"];
  var when = timeoutObj[timeoutType]["when"];

  if (!err) {
    // Remove extra precision on timings.
    var timings = res.timings;
    for (var key in timings) {
      timings[key] = timings[key].toFixed(1);
    }
    var timingPhases = res.timingPhases;
    for (var key in timingPhases) {
      timingPhases[key] = timingPhases[key].toFixed(1);
    }

    let timeInfo = "";
    if (timingPhases && timings) {
      timeInfo = JSON.stringify(timings) + ", " + JSON.stringify(timingPhases);
      timeInfo = ` <a href='${requestURL}'>Timing info [ms]</a>: ${timeInfo}`;
    }
    return {
      "description": callerName() + "Expect no request error for timeout of " + tout + " ms used when " + when,
      "error": false,
      "got": timeInfo
    };
  }

  if (err.code === "ETIMEDOUT") {
    // https://github.com/request/request/blob/master/request.js#L846
    return {
      "description": callerName() + "Expect HTTP headers and start of response body in less than " + tout + " ms when " + when,
      "error": true,
      "got": err.code
    };
  } else if (err.code === "ESOCKETTIMEDOUT") {
    //https://github.com/request/request/blob/master/request.js#L811
    return {
      "description": callerName() + "Expect time interval between bytes sent to be less than " + tout + " ms when " + when,
      "error": true,
      "got": err.code
    };
  } else if (err.code === "ECONNRESET") {
    return {
      "description": callerName() + "Expect connection to not be reset by server",
      "error": true,
      "got": "ECONNRESET"
    };
  } else if (err.code === "ECONNREFUSED") {
    return {
      "description": callerName() + "Expect connection to not be refused by server",
      "error": true,
      "got": err.code
    };
  } else {
    return {
      "description": callerName() + "Probably URL is malformed.",
      "error": true,
      "got": err
    };
  }
}
exports.RequestError = RequestError;

function CadenceGiven(cadence) {
  let base = "https://github.com/hapi-server/data-specification/";
  let url = base + "blob/master/hapi-dev/HAPI-data-access-spec-dev.md";
  let desc = "Expect the nominal cadence to be given "
           + `(see <a href='${url}'>`
           + "the HAPI spec for definition</a>). A nominal cadence is useful "
           + "for clients and obviates the need for it to be inferred programatically."
  return {
    "description": callerName() + desc,
    "error": typeof(cadence) !== "string",
    "got": cadence || "no cadence"
  };
}
exports.CadenceGiven = CadenceGiven;

function CadenceValid(cadence) {
  // https://stackoverflow.com/a/53140944/1491619
  // TODO: Move to JSON schema.
  var re = /^P(?!$)((\d+Y)|(\d+\.\d+Y$))?((\d+M)|(\d+\.\d+M$))?((\d+W)|(\d+\.\d+W$))?((\d+D)|(\d+\.\d+D$))?(T(?=\d)((\d+H)|(\d+\.\d+H$))?((\d+M)|(\d+\.\d+M$))?(\d+(\.\d+)?S)?)??$/;
  var t = re.test(cadence) == true;
  var got = cadence + " valid.";
  if (t == false) {
    var got = cadence + " is invalid.";
    if (typeof(cadence) === "string" && cadence.toUpperCase() === cadence) {
      got = got + " (Letters in cadence should be uppercase.)";
    }
  }

  if (0) {
    // Old code. moment.js is too permissive.
    var md = moment.duration(cadence);
    // moment.js claims duration with lowercase if valid
    //var md2 = moment.duration(cadence.toUpperCase()); 
    var t = md._isValid;
    var got = cadence;
    if (t == true && cadence.toUpperCase() !== cadence) {
      t = false;
    }
    // moment.duration("PT720") gives md._isValid = true and
    // md._milliseconds = 0. (Need H, M, S at end)
    if (md._milliseconds == 0 && md._days == 0 && md._months == 0) {
      t = false;
    }
  }
  let desc = "Expect cadence to be a valid ISO8601 duration "
           + "(regular expression tested: " + re.toString() + ").";
  return {
          "description": callerName() + desc,
          "error": t == false,
          "got": got
        };
}
exports.CadenceValid = CadenceValid;

function CadenceOK(cadence, start, stop, what) {

  if (!cadence) return; // Don't do test; no cadence given.

  if (!stop) {
    let desc = "Need more than two lines to do cadence "
             + "comparison with consecutive samples.";
    return {
      "description": callerName() + desc,
      "error": true,
      "got":"One line."
    };
  }
  //console.log(start)
  //console.log(stop)
  start = trailingZfix(start);
  stop = trailingZfix(stop);
  var startms = moment(start).valueOf();
  var stopms = moment(stop).valueOf();
  var md = moment.duration(cadence);
  var R = (stopms-startms)/md._milliseconds;
  if (what === "start/stop") {
    t = R > 1;
    var got = "(stopDate-startDate)/cadence = " + (stopms-startms)/md._milliseconds;
    return {
      "description": callerName() + "Expect (stopDate-startDate)/cadence > 1",
      "error": t != true,
      "got": got
    };
  }
  if (what === "sampleStart/sampleStop") {
    t = R > 10;
    var got = "(sampleStartDate-sampleStopDate)/cadence = "
            + (stopms-startms)/md._milliseconds;
    let desc = "Expect (sampleStopDate-sampleStartDate)/cadence &gt; 10";
    return {
      "description": callerName() + desc,
      "error": t != true,
      "got": got
    };
  }
  if (what === "consecsamples") {
    t = R > 10;
    var got = "Cadence/(time[i+1]-time[i]) = " + (stopms-startms)/md._milliseconds;
    return {
      "description": callerName() + "Expect (t[i+1]-t[i])/cadence &gt; 10",
      "error": t != true,
      "got":got
    };
  }
}
exports.CadenceOK = CadenceOK;

function CIdentifier(arr, type) {
  // https://stackoverflow.com/questions/14953861/
  // representing-identifiers-using-regular-expression
  var re_str = "[_a-zA-Z][_a-zA-Z0-9]{1,30}";

  var arr_fail = [];
  var re = new RegExp(re_str);
  for (var i = 0; i < arr.length;i++) {
    var m = arr[i]["id"].match(re);
    if (m) {
      var t = m[0] == m["input"];
      if (!t) {
        arr_fail.push(arr[i]["id"]);
      }
    } else {
      // Happens with Unicode in id.
      arr_fail.push(arr[i]["id"]);
    }
  }
  var got = "All " + type + "(s) match.";
  if (arr_fail.length > 0) {
    let No = arr_fail.length;
    if (arr_fail.length > 10) {
      arr_fail = arr_fail.slice(0, 10);
      arr_fail.push("\n ... (" + (No - 10) + ") more.");
    }
    got = No + " datasets ids that are not c identfiers:\n\n" + arr_fail.join("\n");
  }

  let desc = `Prefer ${type} to match c identifier regex '<code>${re_str}</code>'.`;
  return {
    "description": callerName() + desc,
    "error": arr_fail.length > 0,
    "got": got
  };
}
exports.CIdentifier = CIdentifier;

function ErrorCorrect(code, wanted, what) {

  if (what === "httpcode") {
    let desc = "Expect HTTP code in JSON to be <code>" + wanted + "</code>";
    return {
      "description": callerName() + desc,
      "error": code != wanted,
      "got": code != wanted ? code : ""
    };
  }
  if (what === "hapicode") {
    t = code == wanted
    var got = code;
    if (t != true) {got = code + "."}
    let desc = "Expect HAPI code in JSON to be <code>" + wanted + "</code>";
    return {
      "description": callerName() + desc,
      "error": t != true,
      "got": code != wanted ? code : ""
    };
  }
}
exports.ErrorCorrect = ErrorCorrect;

function StatusInformative(message, wanted, what) {

  let re = new RegExp(wanted);
  let err = re.test(message) == false;
  let got = `'${message}'.`;

  let link = `<a href='${wikiURL}#status-informative'>(Explanation.)</a>`;
  let post = `to contain the string '${wanted}' (default HAPI error message). ${link}`;
  let desc = "Want HAPI status message in JSON response" + post;
  if (what === "httpstatus") {
    desc = "Want HTTP status message " + post;
  }
  return {
    "description": callerName() + desc,
    "error": err,
    "got": "'" + message + "'"
  };
}
exports.StatusInformative = StatusInformative;

function HeaderParsable(body) {
  let desc = "Expect header lines in data stream to"
           + " be JSON parsable after removal of leading #s.";
  let ret = {
    "description": callerName() + desc,
    "error": false,
    "got": ""
  };

  let csvparts;
  try {
    csvparts = splitCSV(body)
  } catch (error) {
    ret.got = "Could not split CSV into header and data parts.";
    ret.error = true;
    return ret;
  }
  ret.csvparts = csvparts;

  try {
    JSON.parse(csvparts.header);
    return ret;
  } catch (error) {
    ret.got = "<code>JSON.parse()</code> of \n\n" + csvparts.header + "\n\nresulted in "
            + error + `. Use ${jsonLintLink} for a more detailed error report.`;
    ret.error = true;
    return ret;
  }

  return ret;
}
exports.HeaderParsable = HeaderParsable;

function FileLineOK(header, body, pn, what) {

  var nf = nFields(header, pn);

  var lines = csvToArray(body);

  if (what === "Ncolumns") {
    let t = false;
    let got = "<code>(" + nf + ")" + " - (" + nf + ")</code>";
    if (lines.length == 0) {
      got = "<code>(0)" + " - (" + nf + ")</code>";
    }
    for (var i = 0;i<lines.length-1;i++) {
      t = nf != lines[i].length;
      if (t) {
        got = "<code>(" + lines[i].length + ")" + " - (" + nf + ")</code>";
        got = got + " on line <code>" + (i+1) + "</code>";
        break;
      }
    }
    let desc = "Expect (# of columns in CSV) - "
             + "(# computed from length and size metadata) = 0."
    return {
      "description": callerName() + desc,
      "error": t,
      "got": got
    };
  }


  if (what === "fields") {
    if (type === "string") {
      line1 = csvToArray(lines[0])[0];
    }

    var len  = header.parameters[pn]["length"];
    var type = header.parameters[pn]["type"];
    var name = header.parameters[pn]["name"];
    var size = header.parameters[pn]["size"];

    var nf = 1; // Number of fields (columns) counter
          // (start at 1 since time checked already)
    if (!size) {
      nf = nf + 1; // Width of field (number of columns of field)
    } else {
      nf = nf + prod(size);
    }

    // TODO: Check all lines?
    for (var j = 1;j < nf; j++) {
      if (j == 1 || j == nf-1) {var shush = false} else {shush = true}
      var extra = ' in column ' + j + ' on first line.'
      if (type === "string") {
        report(url,
          is.CorrectLength(line1[j], len, name, extra),
          {"warn": true, "shush": shush});
      }
      if (type === "isotime") {
        report(url, is.ISO8601(line1[j].trim(), extra));
        report(url,
          is.CorrectLength(line1[j], len,name, extra),
          {"warn": true, "shush": shush});
      }
      if (type === "integer") {
        report(url, is.Integer(line1[j],extra), {"shush":shush});
      }
      if (type === "double") {
        report(url, is.Float(line1[j],extra), {"shush":shush});
      }
    }

    //report(url,is.FileLineOK(header,body,bodyAll,pn,'Ncolumns'));

    // Note line.length - 1 = because split() adds extra empty
    // element at end if trailing newline.
  }
}
exports.FileLineOK = FileLineOK;

function FileContentSame(header, body, bodyAll, pn, what) {

  var nf = nFields(header, pn);

  var lines = csvToArray(body);
  var linesAll = csvToArray(bodyAll);
  //var lines = body.split("\n");
  //var linesAll = bodyAll.split("\n");

  if (what === "contentsame") {
    var e = false;
    var got = "";
    var desc = "Expect data response to be same as previous request given differing request URLs.";

    if (bodyAll !== body) { // byte equivalent

      if (lines.length != linesAll.length) {
        e = true;
        got = "<code>" + lines.length + "</code> rows here vs. <code>" 
            + linesAll.length + "</code> rows previously.";
        return {
          "description": callerName() + desc,
          "error": e,
          "got": got
        };
      }

      // Look for location of difference.
      var line = "";
      var lineAll = "";
      var e1 = false;
      var e2 = false;
      for (var i = 0;i < lines.length - 1; i++) {

        //line = lines[i].split(",");
        //lineAll = linesAll[i].split(",");
        line = lines[i];
        lineAll = linesAll[i];

        if (line.length != lineAll.length) {
          e1 = true;
          break;
        }

        for (var j = 0; j < line.length - 1; j++) {
          if (line[j].trim() !== lineAll[j].trim()) {
            e2 = true;
            break;
          }
        }
        if (e2) {break;}
      }
      if (e1) {
        got = line.length + " columns vs. " 
            + lineAll.length + " columns on line " + (i+1) + ".";
        e = true;
        return {
          "description": callerName() + desc,
          "error": e,
          "got": got
        };
      }
      if (e2) {
        got = "Difference on line " + (i+1) + " column " + (nf+1) + ".";
        e = true;
        return {
          "description": callerName() + desc,
          "error": e,
          "got": got
        };
      }
      // TODO: Can e1 and e2 be false?
    }
    return {
      "description": callerName() + desc,
      "error": e,
      "got": got
    };
  }

  if (what === "subsetsame") {

    if (lines.length != linesAll.length) {
      let desc = "Expect number of rows from one parameter request to"
               + " match data from all parameter request.";
      let got = " # rows in single parameter request = <code>" + lines.length + "</code>"
              + " # in all parameter request = <code>" + linesAll.length + "</code>";
      return {
        "description": callerName() + desc,
        "error": true,
        "got": got
      };
    }

    // Find first column of parameter being checked.
    var fc = 0; // First column of parameter.
    for (let i = 0;i < header.parameters.length;i++) {
      if (header.parameters[i]["name"] === header.parameters[pn]["name"]) {
        break;
      }
      if (!header.parameters[i]["size"]) {
        fc = fc + 1;
      } else {
        fc = fc + prod(header.parameters[i]["size"]);
      }
    }

    let desc = "Expect content from one parameter request to"
             + " match content from all parameter request.";
    let t = false;
    let got = "";
    for (let i = 0;i < lines.length-1;i++) {

      //let line = lines[i].split(",");
      //let lineAll = linesAll[i].split(",");
      let line = lines[i];
      let lineAll = linesAll[i];

      // Time
      if (line[0].trim() !== lineAll[0].trim()) {
        t = true;
        got += "\nTime column for parameter " + name + " does not match at time "
            + line[0] + ": Single parameter request: " + line[1]
            + "; All parameter request: " + lineAll[0]
            + ".";
      }

      if (pn == 0) {
        continue;
      }

      // Number of columns
      if (line.length > lineAll.length) {
        desc = "Expect number of columns from one parameter request to be"
             + " equal to or less than number of columns in all parameter request.";
        got += "\n# columns in single parameter request = " + line.length 
             + " # in all parameter request = <code>" + lineAll.length
             + "</code>.";
        return {
          "description": callerName() + desc,
          "error": true,
          "got": got
        };
      }

      // Parameter
      // nf = number of fields for parameter
      // fc = first column of field for parameter
      for (let j = 0;j < nf - 1; j++) {

        if (!line[1+j] || !lineAll[fc+j]) {
          t = true;
          got += "\nProblem with line <code>" + (j) + "</code>:\n"
              +  "Single parameter request: <code>" + line[1+j]
              +  "</code>; All parameter request: <code>" + lineAll[fc+j]
              +  "</code>.";
          break;
        }

        if (line[1+j].trim() !== lineAll[fc+j].trim()) {

          if (header.parameters[pn].name) {
            var name = "'" + header.parameters[pn].name + "'";
          } else {
            var name = "#" + header.parameters[pn].name;
          }

          if (nf == 2) {
            t = true;
            got += "\nParameter <code>" + name + "</code> does not match at time " 
                +  line[0] + ": Single parameter request: <code>" + line[1] 
                +  "</code>; All parameter request: <code>" + lineAll[fc+j]
                +  "</code>.\n";
          } else {
            got += "\nParameter <code>" + name + "</code> field #<code>" + j 
                +  "</code> does not match at time <code>" + line[0] 
                +  "</code>: Single parameter request: <code>" + line[1+j] 
                +  "</code>; All parameter request: <code>" + lineAll[fc+j]
                +  "</code>.\n";
          }

        }
      }

    }

    return {
      "description": callerName() + desc,
      "error": t,
      "got": got
    };
  }
}
exports.FileContentSame = FileContentSame;

function FileStructureOK(body, what, other, emptyExpected) {
  
  var desc,t,got;

  if (what === "emptyconsistent") {
    if (body === null || other === null) {
      return; // Can't do test due to previous failure.
    }
    if (body.length == 0 || other.length == 0) {
      if (body.length == 0 && other.length != 0) {
        let msg = 'If empty response for single parameter, expect empty'
                + ' response for all parameters.';
        let got = "Single parameter body: <code>" + body.length + "</code> bytes."
                + " All parameter body: <code>" + other.length + "</code> bytes.";
        return {
          "description": callerName() + msg,
          "error": true,
          "got": got
        };
      } else {
        let msg = 'If empty response for single parameter, expect empty'
                  ' response for all parameters.';
        return {
          "description": callerName() + msg,
          "error": false,
          "got": "Both empty."
        };
      }
    } else {
      return; // Test is not relevant.
    } 
  }

  if (what === "empty") {

    let link = `<a href='${wikiURL}#empty-body'> (Details.)</a>`;

    let emptyIndicated = /HAPI 1201/.test(other);
    if (!body || body.length === 0) {
      if (emptyExpected) {
        let msg = "If data part of response has zero length, prefer '<code>HAPI 1201</code>'"
                + " (no data in time range) in HTTP header status message"
                + " (if possible)." + link;
        return {
          "description": callerName() + msg,
          "error": emptyIndicated == false,
          "got": "Zero bytes and HTTP header status message of '<code>" + other + "</code>'"
        };
      } else {
        let msg = "The verifier should have enough information to make a"
                + " request that returns data. Avoid this error by adding or"
                + " modifying sample{Start,Stop} in /info response (preferred)"
                + " or set a start/stop where there are data in the verifier"
                + " query parameters (or command-line arguments). " + link;
        return {
          "description": callerName() + msg,
          "error": true,
          "got": "Zero bytes."
        };
      }
    }
    if (body && body.length != 0 && emptyIndicated) {
      let msg = "A data part of response with zero bytes was expected"
              + " because '<code>HAPI 1201</code>' (no data in time range) in HTTP header"
              + " status messsage." + link;
      return {
        "description": callerName() + msg,
        "error": false,
        "got": "'<code>HAPI 1201</code>' in HTTP header status message and <code>" + body.length + "</code> bytes."
      };
    }
    return {
      "description": callerName() + "Expect nonzero length for data part of response.",
      "error": false,
      "got": `<code>${body.length}</code> bytes.`
    };   
  }

  if (what === "firstchar") {
    desc = "Expect first character of CSV response to be an integer.";
    t    = !/^[0-9]/.test(body.substring(0,1));
    got  = `<code>${body.substring(0,1)}</code>`;
  }

  if (what === "lastchar") {
    desc = "Expect last character of CSV response be a newline.";
    t = !/\n$/.test(body.slice(-1));
    got = body.slice(-1).replace(/\n/g,"\\n");
    if (t) {
      got = "The character '<code>" + got + "'</code>";
    } else {
      got = "";
    }
  }

  if (what === "extranewline") {  
    desc = "Expect last two characters of CSV response to not be newlines.";
    t    = /\n\n$/.test(body.slice(-2));
    got  = body.slice(-2).replace(/\n/g,"\\n");
    if (t) {
      got = "";
    } else {
      got = "The characters '<code>" + got + "</code>'";
    }
  }

  if (what === "numlines") {
    var lines = body.split("\n");
    got = lines.length + " newlines";
    if (lines.length == 0) {
      got = "No lines.";
    } else {
      got = lines.length + " newlines";
    }
    desc = "Expect at least one newline in CSV response.";
    t = lines.length == 0
  }

  return {
    "description": callerName() + desc,
    "error": t,
    "got": got
  };
}
exports.FileStructureOK = FileStructureOK;

function LengthAppropriate(len, type, name) {
  var got = "Type = <code>" + type + "</code> and length = <code>" 
          + len + "</code> for parameter '<code>" + name + "</code>'";
  let desc = "If <code>type = string</code> or <code>isotime</code>, length must be given";
  if (/isotime|string/.test(type) && !len) {
    obj = {
            "description": desc,
            "error":true,
            "got": got
          };
  } else if (!/isotime|string/.test(type) && len) {
    obj = {
            "description": desc,
            "error":true,
            "got": got
          };
  } else {
    desc = "Length may only be given for types <code>string</code> and <code>isotime</code>";
    obj = {
            "description": desc,
            "error":false,
            "got": got
          };
  }
  obj["description"] = callerName() + obj["description"];
  return obj;
}
exports.LengthAppropriate = LengthAppropriate;

function HeaderSame(headerInfo, headerBody) {
  // Compare header from info response with header in data response

  var differences = diff(headerInfo, headerBody); 
  var keptDiffs = [];

  //console.log(headerInfo);
  //console.log(headerBody);
  //console.log(differences);
  if (differences) {
    for (var i = 0; i < differences.length; i++) {
      if (differences[i].path[0] !== 'format' && differences[i].path[0] !== 'creationDate') {
        //console.log('path: ' + differences[i].path);
        var keep = true;
        for (j = 0; j < differences[i].path.length; j++) {
          //console.log("path[" + j + "] = " + differences[i].path[j]);
          if (typeof(differences[i].path[j]) === 'string' && differences[i].path[j].substring(0,2) === 'x_') {
            keep = false;
            break;
          }
        }
        if (keep) {
          keptDiffs.push(differences[i]);
        }
      }
    }
  }
  var desc = "Expect <code>/info</code> response to match header"
           + " in data response when '<code>include=header</code>' requested.";
  if (keptDiffs.length == 0) {
    return {
      "description": callerName() + desc,
      "error": false,
      "got": ""
    };
  } else {
    var got = "Differences:\n" + JSON.stringify(keptDiffs, null, 2);
    return {
      "description": callerName() + desc,
      "error": true,
      "got": got
    };
  }
}
exports.HeaderSame = HeaderSame;

function FormatInHeader(header, type) {

  // https://github.com/hapi-server/data-specification/blob/master/
  // hapi-2.1.1/HAPI-data-access-spec-2.1.1.md#info
  if (type == "nodata") {
    var t = 'format' in header;
    var got = 'No format given.'
    if (t) {
      got = "Format of '<code>" + header.format + "</code>' specified."
    }
    let desc = "<code>/info</code> response should not have '<code>format</code>' specified.";
    return {
      "description": callerName() + desc,
      "error": t,
      "got": got
    };
  }
  if (type == "data") {
    var t = !('format' in header);
    var got = 'No format given.'
    if (!t) {
      got = "Format of '<code>" + header.format + "</code>' specified."
    }
    let desc = "Header in CSV response should have"
             + " '<code>format: csv</code>' specified.";
    return {
      "description": callerName() + desc,
      "error": t,
      "got": got
    };
  }
}
exports.FormatInHeader = FormatInHeader;

function FirstParameterOK(header, what) {
  if (what == "name") {
    let desc = "First parameter should (not must) be named"
             + " '<code>Time</code>' b/c clients will likely label first"
             + " parameter as '<code>Time</code>'"
             + " on plot to protect against first parameter names that are"
             + " not sensible."
    return {
      "description": callerName() + desc,
      "error": header.parameters[0].name !== "Time",
      "got": "<code>header.parameters[0].name</code>"
    };
  }
  if (what == "fill") {
    var t = false;
    var got = 'null';
    if (!('fill' in header.parameters[0])) {
      got = 'No fill entry.'
    }
    if (header.parameters[0].fill != null) {
      t = true;
      got = header.parameters[0].fill;
    }
    let desc = "First parameter must have a fill of null"
             + " or it should not be specified.";
    return {
      "description": callerName() + desc,
      "error": t,
      "got": got
    };
  }
}
exports.FirstParameterOK = FirstParameterOK;

function LabelOrUnitsOK(name, array, size, which, version) {

  if (parseFloat(version) < 2.1) {
    return;
  }

  let desc = `Expect <code>${which}</code> for parameter '<code>${name}</code>'`;
  desc += ` to have a <a href="${unitsAndLabels}">valid structure</a>.`;

  var checkArray = require('./lib/checkArray.js').checkArray;

  let err = checkArray(array, size, which);

  return {
    "description": callerName() + desc,
    "error": err !== '',
    "got": err || "Valid structure"
  };
}
exports.LabelOrUnitsOK = LabelOrUnitsOK;

function BinsLengthOK(name, bins, size, version) {
  if (!bins) return;
  let got = "Match";
  let err = false;
  if (bins.length != size.length) {
    got = `bins.length = ${bins.length} ≠ size.length = ${size.length}`;
    err = true;
  }
  return {
          "description": "Expect bins.length == size.length",
          "got": got,
          "error": err
        };
}
exports.BinsLengthOK = BinsLengthOK;

function BinsLabelOrUnitsOK(name, bins, size, d, which, version) {

  if (parseFloat(version) < 2.1) {
    return;
  }

  if (!bins) return;
  if (Array.isArray(bins[which]) && bins[which].length > 1) {
    let msg = `${name}[${which}]["units"] is an array with length > 1, so expect `
            + `${name}[${which}]["units"].length == ${name}["size"][${d}]`;
    if (bins[which].length == size[d]) {
      return {
                "description": callerName() + msg,
                "got": "Match",
                "error": false
              };
      } else {
        return {
          "description": callerName() + msg,
          "got": `bins[${which}].length ≠ ${name}["size"][${d}]`,
          "error": true
        };
      }
  }
  return; // No check needed. Schema checks types.
}
exports.BinsLabelOrUnitsOK = BinsLabelOrUnitsOK;

function BinsCentersOrRangesOK(parameters, pn, d, which, version) {

  let param = parameters[pn];
  let name = parameters[pn]["name"];
  let bins = parameters[pn]["bins"];
  if (!bins) return;

  if (typeof bins[d][which] === 'string') {

    let rname = bins[d][which]; // referenced parameter name

    let rpn; // referenced parameter number
    for (let pidx in parameters) {
      if (parameters[pidx]['name'] === rname) {
        rpn = pidx;
        break;
      }
    }

    let msgo = `${name}["bins"][${d}]["${which}"] is a string that references `
             + `another parameter, so expect`;

    if (!rpn) {
      return {
        "description": callerName() + msgo + " referenced parameter to be in dataset.",
        "got": `No parameter named '${rname}'`,
        "error": true
      };
    }

    if (rpn == pn) {
      return {
        "description": callerName() + msgo + " referenced parameter to have a different name than bins parent parameter.",
        "got": `Self reference`,
        "error": true
      };
    }

    let rparam = parameters[rpn];

    if (rparam['bins']) {
      return {
        "description": callerName() + msg,
        "got": `Parameter ${rname}["bins"] may not be given.`,
        "error": true
      };
    }

    if (rparam['units'] && Array.isArray(rparam['units'])) {
      // TODO: Check for consistency?
      return {
        "description": callerName() + msgo + " units to not be an array.",
        "got": `Parameter ${rname}["units"] may not be an array.`,
        "error": true
      };
    }
    if (rparam['label'] && Array.isArray(rparam['label'])) {
      return {
        "description": callerName() + msgo + " label to not be an array.",
        "got": `Parameter ${rname}["label"] may not be an array.`,
        "error": true
      };
    }
    if (!["integer","double"].includes(rparam['type'])) {
      return {
        "description": callerName() + msgo + " to be an integer or double.",
        "got": `Parameter ${rname}["type"] = ${rparam['type']}`,
        "error": true
      };
    }
    if (!rparam['size']) {
      return {
        "description": callerName() + msgo + " to have a size element.",
        "got": `Parameter '${rname}' does not have a size element.`,
        "error": true
      };
    }

    if (!Array.isArray(rparam['size'])) {
      // size = 10 => size = [10]
      rparam['size'] = [rparam['size']];
    }

    if (which === 'centers') {
      if (rparam['size'].length > 1) {
        return {
          "description": callerName() + msgo + ` ${rname}["size"].length = 1`,
          "got": `Parameter ${rname}["size"].length = ${rparam["size"].length}`,
          "error": true
        };
      }
      if (rparam['size'][0] != param['size'][d]) {
        return {
          "description": callerName() + msgo + ` ${rname}["size"][0] = ${name}["size"][${d}]`,
          "got": `Parameter ${rname}["size"][0] = ${rparam['size'][0]} and ${name}["size"][${d}] = ${param['size'][d]}`,
          "error": true
        };
      }
    }

    if (which === 'ranges') {
      if (rparam['size'].length != 2) {
        return {
          "description": callerName() + msgo + ` ${rname}["size"].length = 2`,
          "got": `Parameter ${rname}["size"].length = ${rparam['size'].length}`,
          "error": true
        };
      }
      if (rparam['size'][1] != 2) {
        return {
          "description": callerName() + msgo + ` ${rname}["size"][1] = 2.`,
          "got": `Parameter ${rname}["size"][1] = ${rparam['size'][1]}`,
          "error": true
        };
      }
      if (rparam['size'][0] != param['size'][d]) {
        return {
          "description": callerName() + msgo + ` ${rname}["size"][0] = ${name}["size"][${d}].`,
          "got": `Parameter ${rname}["size"][0] = ${rparam['size'][0]} and ${name}["size"][${d}] = ${param['size'][d]}`,
          "error": true
        };
      }
    }
    // TODO: Check values are numbers?
    return {
      "description": callerName() + msgo + " referenced parameter to exist, have correct size, and statisfy other constraints.",
      "got": `Referenced parameter found is an acceptable reference.`,
      "error": false
    };
  }

  if (bins[d][which]) {
    if (bins[d][which].length == param["size"][d]) {
      let msg = callerName() + `Expect bins[${d}]["${which}"].length = ${name}["size"][${d}]`;
      return {
              "description": callerName() + msg,
              "got": `bins[${d}][${which}].length = ${bins[d][which].length} and ${name}["size"][${d}] = ${param["size"][d]}`,
              "error": bins[d][which].length != param["size"][d]
            }
    }
    if (which === "ranges") {
      // TODO: Check that all elements of bins[${d}]["ranges"] have length of 2.
    }
  }

  if (which === "ranges") {
    if (bins[d]["centers"] === null && bins[d]["ranges"] !== undefined) {
      // "Each dimension must be described in the bins object, 
      // but any dimension not representing binned data should indicate this
      // by using '"centers": null' and not including the 'ranges' attribute."
      // Could be written into schema, but is complex.
      // What about case where ranges are known, but centers are not known?
      let msg = callerName() + `If ${name}["bins"][${d}]["centers"] = null, `
              + `no ${name}["bins"][${d}]["ranges"] allowed.`;
      return {
              "description": callerName() + msg,
              "got": `${name}["bins"][${d}]["ranges"] ≠ null`,
              "error": true
            }
    }
  }

  return {
    "description": callerName() + `Expect ${name}["bins"][${d}]["${which}"] to have correct size and if "centers" = null, no "ranges" given.`,
    "got": ``,
    "error": false
  }
}
exports.BinsCentersOrRangesOK = BinsCentersOrRangesOK;

function AllowedOutputFormat(json) {
  // Existence of 'csv' can't be checked easily with schema using enum.
  // (Could be done using oneOf for outputFormats and have csv be in emum
  // array for each of the objects in oneOf.)
  // Possible solution?: https://stackoverflow.com/a/17940765
  let outputFormats = json.outputFormats || "No outputFormats element."
  return {
        "description": "Expect <code>outputFormats</code> to have '<code>csv</code>'",
        "error": outputFormats.indexOf("csv") == -1,
        "got": "<code>" + outputFormats.join(", ") + "</code>"
  };
}
exports.AllowedOutputFormat = AllowedOutputFormat;

function TimeParameterUnitsOK(name, units, type, size) {

  if (type === 'isotime') {
    var err = false;
    if (typeof(units) === 'object') {
      for (var i = 0; i < units.length; i++) {
        for (var j = 0; j < units[i].length; j++) {
          if (units[i][j] !== "UTC") {
            err = true;
            break;
          }
        }
      }
    } else {
      var got = "type = '" + type + "' and units = '" + units 
              + "' for parameter " + name + ".";
      if (units !== "UTC") {
        err = true;
      }
    }

    return {
      "description": callerName() + "Expect parameter of type <code>isotime</code> to have units of '<code>UTC</code>'.",
      "error": err,
      "got": got
    };
  }
}
exports.TimeParameterUnitsOK = TimeParameterUnitsOK;

function FillOK(fill, type, len, name, what) {

  if (!fill) {return;} // No fill or fill=null so no test needed.

  var t = false;
  if (typeof(fill) === 'string') {
    var got = "fill = '" + fill + "' for parameter " + name + ".";
  } else {
    var got = "fill = " + fill + " for parameter " + name + ".";
  }
  var desc = "";
  if (what === "nullstring") {
    desc = "Expect fill value to not be the string 'null'.";
    if (fill === "null") {
      t = true;
      got  = " The string 'null'; Probably fill=null and not fill='null' was intended.";
    }
  }
  if (what === "isotime") {
    desc = "Expect length of fill value for a isotime parameter to be equal to length of the string parameter";
    if (len === fill.length && name !== "Time") {
      t = true;
      got  = got;
    }
  }
  if (what === "string") {
    desc = "Expect length of fill value for a string parameter to be &lt;= length of the string parameter";
    if (len < fill.length) {
      t = true;
      got  = got + " string length = " + len + "; fill length = " + fill.length;
    }
  }
  if (what === "stringparse") {
    desc = "Expect fill value for a string parameter to not parse to an integer or float";
    if (isinteger(fill) || isfloat(fill)) {
      t = true;
      got  = got + " This was probably not intended.";
    }
  }
  if (what === "integer") {
    desc = "Expect fill value for a integer parameter to not have a decimal point";
    if (/\./.test(fill)) {
      t = true;
      got  = got + " This was probably not intended.";
    }
  }
  if (what === "double") {
    desc = "Expect fill value for a double parameter to not have a two"
         + " or more non-zero decimal places.";
    if (/\.[1-9][1-9]/.test(fill)) {
      t = true;
      got  = got + " This is uncommon and was probably not intended.";
    }
  }
  return {
    "description": callerName() + desc,
    "error": t,
    "got": got
  };
}
exports.FillOK = FillOK;

function SizeCorrect(nc, nf, header) {
  var t = nc == nf
  if (header.size) {
    var extra = "product of elements in size array " + JSON.stringify(header.size);
    var got = nc + " commas and " + extra + " = " + nf;
  } else {
    if (nf == 0) {
      var extra = "0 because only first parameter (time) requested.";
    } else {
      var extra = "1 because no size given.";
    }
    var got = nc + " commas";
  }
  return {
    "description": callerName() + "Expect number of commas on first line to be " + extra,
    "error": t != true,
    "got": got
  };
}
exports.SizeCorrect = SizeCorrect;

function HTTP200(res){
  var body = "";
  let got = "";
  if (res.statusCode != 200) {
    got = "HTTP status code <code>" + res.statusCode + "</code>" + body;
    try {
      var json = JSON.parse(res.body);
      var body = " and JSON body\n\t" + JSON.stringify(body,null,4).replace(/\n/g,"\n\t");
    } catch (error) {
    }

    if (!body) {
      var body = " and non JSON.parse()-able body:\n" + res.body.replace(/\n/g,"\n\t");
    } else {
      var body = "";
    }
  }
  return {
    "description": callerName() + "Expect HTTP status code to be <code>200</code>",
    "error": 200 != res.statusCode,
    "got": got
  };
}
exports.HTTP200 = HTTP200;

function CorrectLength(str, len, name, required) {
  var extra = extra || ""
  var required = required || false
  var got = "(" + (str.length) + ") - (" + (len) + ")"
  var t = str.length != len;
  if (t && !required) {
    got = got + extra + " Not an error for format=csv, but will "
        + " cause error for format=binary."
  }
  let desc = 'Expect (trimmed length of ' 
           + name + ' string parameter in CSV) - (parameters.'+ name + '.length) = 0.'
  return {
    "description": callerName() + desc,
    "error": t,
    "got": got
  };
}
exports.CorrectLength = CorrectLength;

function TimeInBounds(lines, start, stop) {
  // Remove Z from all times so Date().getTime() gives local timezone time for all.
  // Javascript Date assumes all date/times are in local timezone.

  var start = start.trim().replace(/Z$/,"");
  var stop = stop.trim().replace(/Z$/,"");

  var firstTime = lines[0].split(",").shift().trim().replace(/Z$/,"");
  var lastTime = firstTime;
  // Find the last line with content.
  for (var i = 0;i < lines.length-1; i++) {
    if (lines[lines.length-i-1] !== '') {
      lastTime = lines[lines.length-i-1].split(",").shift().trim().replace(/Z$/,"");
      break;
    }
  }
  let got = "First time = <code>" + firstTime + "</code>; "
          + "LastTime = <code>" + lastTime + "</code>";
  let a = moment(firstTime).valueOf() >= moment(start).valueOf();
  let b = moment(lastTime).valueOf()  <  moment(stop).valueOf();
  var t = a && b;
  let desc = "Expect first time in CSV ≥ " 
           + start + " and last time in CSV &lt; " 
           + stop + " (only checks to ms)";
  return {
    "description": callerName() + desc,
    "error": t != true,
    "got": got
  };
}
exports.TimeInBounds = TimeInBounds;

function TimeIncreasing(header, what) {

  if (what === "CSV") {
    var got = "";
    var starttest = new Date().getTime();
    var ts = got;
    // Remove blanks (caused by extra newlines)
    header = header.filter(function(n){ return n != '' });
    // Don't run test if only one record.
    if (header.length == 1) {return;} 
    
    for (i = 0;i < header.length-1;i++) {
      var line = header[i].split(",");
      var linenext = header[i+1].split(",");
      //var t = new Date(linenext[0].trim()).getTime() > new Date(line[0].trim()).getTime();
      if (!line || !linenext) {
        t = false;
        got = "Problem with line " + (i) + " or " + (i+1);
        break;
      }
      try {
        let a = moment( trailingZfix(linenext[0].trim()) ).valueOf();
        let b = moment( trailingZfix(line[0].trim()) ).valueOf();
        var t =  a > b;
      } catch (e) {
        t = false;
        got = "Was not able to parse either " + linenext[0].trim() 
            + " or " + line[0].trim();
        break;
      }
      //console.log(linenext[0].trim())
      //console.log(moment.valueOf(linenext[0].trim()))
      if (!t) {
        var ts = "Time(line="+(i+1)+") &gt; Time(line="+i+")";
        var got = "line " + (i+1) + " = "+ linenext[0] + "; line " 
                + (i) + " = " + line[0];
        break;
      }
      if (new Date().getTime() - starttest > 10) {
        // Stop testing after 10 ms.
        got = got + " in first " + (i+1) + " lines.";
        break;
      }
    }
  }

  if (what === "{start,stop}Date") {
    var start = trailingZfix(header.startDate);
    var stop  = trailingZfix(header.stopDate);
    var ts = "info.startDate &lt; info.stopDate";
    //var t = new Date(start).getTime() < new Date(stop).getTime();
    var t = moment(start).valueOf() < moment(stop).valueOf();
    var got = "startDate = <code>" + start + "</code>; "
            + "stopDate = <code>" + stop + "</code>";
  }

  if (what === "sample{Start,Stop}Date") {
    var start = trailingZfix(header.sampleStartDate);
    var stop  = trailingZfix(header.sampleStopDate);
    if (!start && !stop) return false;
    if (start && stop) {
      //var t = new Date(start).getTime() < new Date(stop).getTime();
      var t = moment(start).valueOf() < moment(stop).valueOf();
      var ts = "info.sampleStartDate &lt; info.sampleStopDate";
      var got = "sampleStartDate = " + start + "; sampleStopDate = " + stop;
    } else {
      if (!stop) {
        var ts = "info.sampleStartDate does not have a matching sampleStopDate";
        var t = false;
        var got = "a missing date";
      } else {
        var ts = "info.sampleStopDate does not have a matching sampleStartDate";
        var t = false;
        var got = "a missing date";
      }
    }
  }
  if (t) {
    got = got.replace("&gt;","&lt;");
  }
  return {
    "description": callerName() + "Expect " + ts,
    "error": t != true,
    "got":got
  };
}
exports.TimeIncreasing = TimeIncreasing;

function ISO8601(str, extra) {
  // TODO: Change to HAPIISO8601.
  // https://github.com/hapi-server/data-specification/issues/54
  var extra = extra || ""
  var t  = moment(trailingZfix(str),moment.ISO_8601).isValid();
  var ts = "moment('" + trailingZfix(str) 
         + "',moment.ISO_8601).isValid() == true" + extra;
  return {
    "description": callerName() + "Expect " + ts,
    "error": t != true,
    "got": "moment(" + trailingZfix(str) + ",moment.ISO_8601).isValid() = " + t
  };
}
exports.ISO8601 = ISO8601;

function HAPITime(isostr, version) {

  schemaregexes = timeregexes(version);
  // schemaregexes come from list in a schema file in ./schemas.
  var got,str,result;
  var t = true;
  if (typeof(isostr) === 'object') {
    var starttest = new Date().getTime();
    got = "";
    for (var i = 0; i < isostr.length; i++) {
      if (isostr[i] === '') {break};
      str = isostr[i].split(",")[0].trim();
      result = HAPITime(str,version);
      if (result.error == true) {
        t = false;
        got = "'" + str + "'" + " is not a valid HAPI Time string.";
        if (!/Z$/.test(str)) {
          got = got + " (Missing trailing Z.)";
        }
        if (!/^[0-9]$/.test(str)) {
          got = got + " (First character is not [0-9].)";
        }
        break;
      }
      if (new Date().getTime() - starttest > 10) {
        // Stop testing after 10 ms.
        got = got + " in first " + (i+1) + " lines.";
        break;
      }
      //console.log(isostr[i] + " " + t)
    }
    var url = schemaURL + "/HAPI-data-access-schema-" + version + ".json";
    let desc = "Expect time column to contain valid "
             + "<a href='"+url+"'>HAPI " + version + " HAPITime strings</a>";
    return {
      "description": callerName() + desc,
      "error": t != true,
      "got": got};
  }
  // Tests if a string is a valid HAPI time representation, which is a subset of ISO 8601.
  // Two tests are made: (1) A set of regular expressions in the JSON schema (see ./schemas)
  // and (2) A set of semantic tests.

  // The semantic tests are that:
  // (1) DOY can be no more than 365 on non-leap years, 366 on leap years,
  // (2) DOM must be valid

  function isleap(year) {
    return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0)
  }

  var regex_pass = false;
  var re;
  for (var i = 0;i < schemaregexes.length;i++) {
    re = new RegExp(schemaregexes[i]);
    regex_pass = re.test(isostr);
    if (regex_pass) {
      //console.log(' Passing pattern:' + schemaregexes[i])
      break;
    }
  }

  //console.log(" Regex pass: " + regex_pass);
  var semantic_pass = true;
  if (regex_pass) {

    // Only check semantic rules if regular expression test passed.
    var year = parseInt(isostr.slice(0,4));
    var isostr_split = isostr.split(/-|T/);

    if (isostr_split.length > 1) {
      if (isostr_split[1].length == 3) {
        var doy = parseInt(isostr_split[1]);
      } else {
        var mo = parseInt(isostr_split[1]);
        isostr_split = isostr.split(/-/);
        if (isostr_split.length > 2) {
          var day = parseInt(isostr_split[2]);
        }
      }
    }

    // DOY can be no more than 365 on non-leap years, 366 on leap years
    if (doy == 366 && isleap(year) == false) {
      semantic_pass = false;
    }
    if (doy > 366) {
      semantic_pass = false;
    }

    // DOM must be correct
    if (day) {
      if ([4,6,9,11].includes(mo) && day > 30) {
        semantic_pass = false;
      }
      if (mo == 2 && isleap(year) && day > 29) {
        semantic_pass = false;
      }
      if (mo == 2 && !isleap(year) && day > 28) {
        semantic_pass = false;
      }
    }
  }
  //console.log(" Semantic pass: " + regex_pass);

  var e = !(regex_pass && semantic_pass);
  //if (t==false) {console.log("x" + isostr)}
  return {
    "description": callerName() + "Expect time value to be a valid HAPI time string.",
    "error": e,
    "got": got
  };
}
exports.HAPITime = HAPITime;

function Integer(str, extra) {
  extra = extra || ""
  let t  = isinteger(str);
  let ts = `(parseInt("${str}") &lt; 2^31 - 1 || `
      ts += `parseInt("${str}") &lt; -2^31) && `
      ts += `parseInt(${str}) == parseFloat(${str})`
      ts += extra;
  return {
    "description": callerName() + "Expect " + ts,
    "error": t != true,
    "got": "parseInt(" + str + ") = " + parseInt(str) + " and " + "parseFloat(" + str + ") = " + parseFloat(str)
  };
}
exports.Integer = Integer;

function Float(str, extra) {
  extra = extra || ""
  let t  = isfloat(str);
  let ts = "Math.abs(parseFloat('"+str+"')) &lt; " 
         + Number.MAX_VALUE + " && "
         + "/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test('" + str + "'.trim()) == true"
         + extra;
  return {
    "description": callerName() + "Expect " + ts,
    "error": t != true,
    "got": t
  };
}
exports.Float = Float;

function NaN(str, extra) {
  var extra = extra || ""
  t = str.trim().toLowerCase();
  ts = "'" + str + "'.trim().toLowerCase() === 'nan'"+extra;
  return {
    "description": callerName() + "Expect " + ts,
    "error": t !== "nan",
    "got":"'" + str + "'.trim().toLowerCase() = " + t
  };
}
exports.NaN = NaN;

function Unique(arr, arrstr, idstr){
  if (!arr.length) {
    return {
      "description": callerName() + "Expect " + arrstr + " to be an array",
      "error":true,
      "got": typeof(arr)
    };
  }

  var ids = [];
  var rids = [];
  for (var i = 0;i < arr.length; i++) {
    if (!arr[i][idstr]) continue;
    if (ids.indexOf(arr[i][idstr]) > -1 && rids.indexOf(arr[i][idstr])) {
      rids.push(arr[i][idstr]);
    }
    ids[i] = arr[i][idstr];
  }
  var uids = Array.from(new Set(ids)); // Unique values
  
  var e = !(uids.length == ids.length);
  if (e) {
    var got ="Repeated at least once: " + rids.join(",");
  } else {
    var got ="";
  }
  let desc = "Expect all '" + idstr 
           + "' values in objects in " + arrstr + " array to be unique";
  return {
    "description": callerName() + desc,
    "error": e,
    "got": got
  };
}
exports.Unique = Unique;

function TooLong(arr, arrstr, idstr, elstr, N){
  // idstr = "id" for datasets and "name" for parameter.
  var ids = [];
  for (var i = 0;i < arr.length; i++) {
    if (!arr[i][elstr]) continue;
    if (arr[i][elstr]) {
      if (arr[i][elstr].length > N) {
        ids.push("id: '<code>" + arr[i][idstr] + "</code>'; title: '" + arr[i][elstr] + "'");
      }
    }
  }
  var got = "All titles in '<code>" + arrstr + "</code>' ≤ " + N + " characters"
  let No = ids.length;
  if (ids.length > 0) {
    if (ids.length > 10) {
      ids = ids.slice(0, 10);
      ids.push("\n ... (" + (No - 10) + ") more.");
    }
    got = arrstr + " has " + No + " datasets with a " + elstr + " &gt; " 
        + N + " characters: \n\n" + ids.join("\n");
  }
  return {
    "description": callerName() + "Prefer " + elstr + "s in objects to be ≤ 40 characters",
    "error": ids.length != 0,
    "got": got
  };
}
exports.TooLong = TooLong;

function CORSAvailable(head) {

  var ahead = "Access-Control-Allow-Origin";
  var astr  = head[ahead.toLowerCase()];
  var a     = /\*/.test(astr);

  var bhead = "Access-Control-Allow-Methods";
  var bstr  = head[bhead.toLowerCase()] || "";
  var b = true; 
  // If not specified, Methods = GET, HEAD, and POST are allowed.
  // See links in https://stackoverflow.com/a/44385327
  if (bstr !== "") {
    b = /GET/.test(bstr);
  }

  var want = "<code>Access-Control-Allow-Origin = '*'</code> and, if given, "
           + "<code>Access-Control-Allow-Methods</code> to include <code>'GET'</code>";
  var got = `<code>Access-Control-Allow-Origin = '${astr}'</code> and, `;
  if (bstr) {
    got = got + `<code>Access-Control-Allow-Methods '${bstr}'</code>`;
  } else {
    got = got + "No <code>Access-Control-Allow-Methods</code> header.";
  }
  var e = !(a && b);
  let desc = "To enable AJAX clients, want CORS HTTP Headers: " + want;
  return {
    "description": callerName() + desc,
    "error": e,
    "got": got
  };
}
exports.CORSAvailable = CORSAvailable;

function CompressionAvailable(headers){
  var available = false;
  // Note: request module used for http requests only allows gzip to
  // be specified in Accept-Encoding, so error here may be misleading
  // if server can use compress or deflate compression algorithms but
  // not gzip (should be a rare occurence).
  var got = "No <code>gzip</code> in <code>Content-Encoding</code> header. "
          + "Compression will usually speed up transfer of data."
  var re = /gzip/;
  if (headers["content-encoding"]) {
    var available = re.test(headers["content-encoding"]);
    if (available) {got = headers["content-encoding"]}
  }
  let desc = "Expect HTTP Accept-Encoding to match <code>" + re + "</code>.";
  return {
    "description": callerName() + desc,
    "error": !available,
    "got": !available ? got : ""
  };
}
exports.CompressionAvailable = CompressionAvailable;

function ContentType(re, given){
  return {
    "description": callerName() + "Expect HTTP <code>Content-Type</code> to match <code>" + re + "</code>",
    "error": !re.test(given),
    "got": re.test(given) ? `<code>${given}</code>` : "No match."
  };
}
exports.ContentType = ContentType;
