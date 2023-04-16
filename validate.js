const fs      = require('fs');
const clc     = require('chalk');
const request = require('request');

const is = require('./is.js');
const writeResult = require('./report.js').writeResult;

const argv = require('yargs')
              .usage("$0 <url|file> [options]")
              .version(false) // Disable default version meaning
              .options({ version: { string: true, alias: "v" } })
              .default({
                "test": false
              })
              .choices('version', is.versions())
              .demandCommand()
              .help()
              .argv;

const arg = argv['_'][0];

if (arg.startsWith('http')) {
  request(arg, (err, res, body) => {
    if (!err) validate(body); return;

    console.error("Request failure for " + arg + ":");
    console.log(err);
    process.exit(1);
  });
} else {
  fs.readFile(arg, (err, buff) => {
    if (!err) validate(buff.toString()); return;

    console.error("Read failure for " + arg + ":");
    console.log(err);
    process.exit(1);      
  });
}

function validate(str) {

  let parseResult = is.JSONParsable(str);
  if (parseResult['error'] == true) {
    writeResult(parseResult);
    process.exit(1);
  } 
  let json = parseResult['json'];

  let version = getVersion(argv, json);
  let subSchema = inferSubSchema(json);
  let ignoreVersionError = argv['version'] ? true : false;
  if (ignoreVersionError) {
    console.log("  " + clc.yellowBright.inverse("⚠") + " Ignoring version in JSON b/c version given on command line.");
  }
  let jsonResult = is.HAPIJSON(json, version, subSchema, ignoreVersionError);
  writeResult(jsonResult);
  process.exit(0);
}

function getVersion(argv, json) {

  let version = undefined;
  if (argv['version']) {
    versionResult = is.HAPIVersion(argv['version']);
    if (versionResult['error'] == true) {
      writeResult(versionResult, 'warn');
      process.exit(1);
    }
    version = argv['version'];
  }

  if (version === undefined) {
    versionResult = is.HAPIVersion(json['HAPI']);
    writeResult(versionResult);
    if (versionResult['error'] == true) {
      process.exit(1);
    } else {
      version = json['HAPI'];        
    }
  }

  return version;
}

function inferSubSchema(json) {
  if (json['id']) {
    return "about";
  }
  if (json['outputFormats']) {
    return "capabilities";
  }
  if (json['catalog']) {
    return "catalog";
  }
  if (json['parameters']) {
    if (json['data']) {
      return "info";
    } else {
      return "data";
    }
  }
}
