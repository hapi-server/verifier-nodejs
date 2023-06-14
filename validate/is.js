let util = {
  "code": (str) => {
    if (Array.isArray(str)) {
      str = str.join(", ")
    }
    return `<code>${str}</code>`
  }
}

export function HAPIJSON(json, subSchema) {

  let result = {
    "description": `Expect JSON to be ${util.code("/"+subSchema)} valid`,
    "error": false,
    "got": "No error"
  };

  return result;
}

export function JSONParsable(text) {

  let ret = {
    "description": "Expect <code>JSON.parse()</code> to not throw error",
    "error": false,
    "got": "No error"
  };

  try {
    JSON.parse(text);
    return ret;
  } catch (error) {
    ret.got = "JSON.parse of:\n\n" + text + "\n\nresulted in " + error 
            + ". Use " + jsonLintURL
            + " for a more detailed error report. ";
    ret.error = true;
    return ret;
  }
}

export function HAPIVersion(version) {

  const versions = ["2.0", "2.1", "3.0", "3.1", "3.2"];

  let got = `${util.code(version)}`;
  let err = false;
  if (!versions.includes(version)) {
    err = true;
    got = got + ", which is not valid or not implemented by verifier. "
        + "Will use latest version implemented by verifier: " + util.code(versions.pop());
  }

  let des = "Expect HAPI version in JSON response to be one of " + util.code(versions);
  return {
    "description": des,
    "error": err,
    "got": got
  };
}
