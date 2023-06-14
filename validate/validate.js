import * as is from "./is.js";
import pkg from 'ajv';
const {Ajv} = pkg;
console.log(Ajv)

if (typeof window === 'undefined') {
  // Node.js command line
  await import('./cli.js').then(
    (res) => {
      res.cli((str, version) => validate(str, version))
    });
}

function writeResult(result) {
  if (writeResult.results === undefined) {
    writeResult.results = [];
  }
  writeResult.results.push(result);
  console.log(result);
}

export default function validate(input, useVersion) {

  let parseResult = is.JSONParsable(input);
  writeResult(parseResult,'error');
  if (parseResult['error'] === true) {
    return writeResult.results;
  } 

  let json = JSON.parse(input);
  if (useVersion) {
    json["HAPI"] = useVersion;
  }
  let versionResult = is.HAPIVersion(json["HAPI"]);
  writeResult(versionResult);

  let subSchema = inferSubSchema(json);
  let hapiJsonResult = is.HAPIJSON(json, subSchema);
  writeResult(hapiJsonResult);

  return writeResult.results;
}

function getVersion(json, useVersion) {

  let versionResult;
  if (useVersion === undefined) {
    versionResult = is.HAPIVersion(useVersion);
  } else {
    versionResult = is.HAPIVersion(json['HAPI']);
  }
  return versionResult;
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
      return "data";
    } else {
      return "info";
    }
  }
}
