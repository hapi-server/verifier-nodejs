function checkArray(units, size, name, allowedElements, debug) {

  // Implements
  // HAPI-data-access-spec-3.1.0.md#369-unit-and-label-arrays
  // at
  // https://github.com/hapi-server/data-specification/tree/master/hapi-3.1.0
  //
  // Usage:
  //   Check HAPI JSON units element given size array.
  //     checkArray(units, size)
  //   Same checks as on units, but error message reference "label" instead of "unit"
  //    checkArray(label, size, 'label')
  //
  //   See checkArray_test.js for usage examples.

  debug = debug || false;

  if (!name) {
    name = "units";
  }

  if (!Array.isArray(size)) {
    size = [size];
  }

  if (type(allowedElements).startsWith("string")) {
    allowedElements = [allowedElements];
  }
  if (!allowedElements) {
    allowedElements = ['string+'];
    if (name === 'units') {
      allowedElements = ['string+','null'];
    }
    if (name === 'label') {
      allowedElements = ['string+'];
    }
  }
  let unique = allowedElements;
  if (unique.length > 1) {
    unique = [... new Set(allowedElements)];
  }

  if (debug) {
    unitsJSON = JSON.stringify(units);
    sizeJSON = JSON.stringify(size);
    console.log(`Checking ${name} = ${unitsJSON}, size = ${sizeJSON}`);
    console.log(`  Allowed elements: ${allowedElements}`);
  }

  let possibleElements = ["array","object","string","string+","date","regexp","function","boolean","number","null"];
  if (allowedElements) {
    for (let el of allowedElements) {
      el = el.toLowerCase();
      if (!possibleElements.includes(el)) {
        console.error(`checkArray: allowedElements (${allowedElements}) is not a subset of ${possibleElements}`);
        process.exit(0);
      }
    }
  }

  if (units === undefined) {
    // Pass type 0.
    if (debug) console.log(`  ${name} is undefined`);
    return "";
  }

  if (!Array.isArray(units)) {
    if (validElements([units], allowedElements, debug)) {
      if (debug) console.log(`  ${name} is one of: ${allowedElements}`);
      // Pass type 1.
      return "";
    }
    // Fail type 1.
    return `If not an array, '${name}' must be one of: ${unique}`;
  }

  if (debug) {
    console.log("  units is an array");
  }

  if (units.length == 1 && !Array.isArray(units[0])) {
    if (debug) {
      console.log(`  ${name}.length == 1`);
    }
    if (validElements(units, allowedElements, debug) == false) {
      // Fail type 2.
      return `${name}[0] must be one of: ${allowedElements}`;
    }
    // Pass type 2.
    return "";
  }

  if (units.length != size[0]) {
    // Fail type 4b
    return `${name}.length != size[0]`;
  }

  if (size.length === 1) {
    if (debug) console.log("  size.length == 1");
    if (units.length != size[0]) {
      // Fail type 3a
      return `${name}.length != size[0]`;
    }
    if (validElements(units, allowedElements, debug) == false) {
      // Fail type 3b
      return `All elements of units must be strings or nulls`;
    }
    // Pass type 3.
    return "";
  }

  if (size.length == 2) {
    // e.g.,
    // units = [["m","m","m"], ["s","s","s"]]
    // size = [2,3]
    return check2D(units, size, name, allowedElements, debug);
  }

  // e.g.,
  // units = [[ ["m","m"],["m","m"],["m","m"] ] , [ ["m","m"],["m","m"],["m","m"] ] ];
  // size = [2, 3, 2]
  if (debug) console.log(`  size.length = ${size.length}`);

  if (allArrays(units) == false) {
    // Fail type 4a
    return `Found and element in ${name} that is not an array`;
  }

  // sizer = reduced size = [size[1], size[2]]
  let sizer = size.slice(1);
  // Loop over outermost elements of units
  for (let s = 0; s < size[0]; s++) {
    let err = "";
    if (size.length == 3) {
      err = check2D(units[s], sizer, name, allowedElements, debug);
    } else {
      err = checkArray(units[s], sizer, name, allowedElements, debug);
    }
    if (err !== "") {
      // Fail type 5c and 6a
      return `Error in ${name}[${s}]`
    }
  }
  // Pass type 5 and 6.
  return "";

  function check2D(units, size, name, allowedElements, debug) {

    if (allArrays(units) == false) {
      // Fail type 4a
      return `Found and element in ${name} that is not an array`;
    }

    if (units.length != size[0]) {
      // Fail type 4b
      return `${name}.length != size[0]`;
    }
    if (debug) {
      unitsJSON = JSON.stringify(units);
      sizeJSON = JSON.stringify(size);
      console.log(`Checking ${name} = ${unitsJSON}, size = ${sizeJSON}`);
    }
    // Pass type 4.
    // e.g.,
    // size = [2, 3]
    // arr = [["m","m","m"],["m","m","m"]];
    if (debug) console.log("  size.length = 2");
    for (u in units) {
      // Fail type 4c
      if (units[u].length != size[1]) {
        return `${name}[${u}].length != size[1]`;
      }
      // Fail type 4d
      if (debug) {
        console.log(`units[${u}]: ${units[u]}`);
        console.log("allowedElements: " + allowedElements);
        console.log(units[u]);
        console.log(allowedElements);
      }
      if (validElements(units[u], allowedElements, debug) == false) {
        return `Elements of ${name}[${u}] must be strings or nulls`;
      }
    }
    return "";
  }

  function allArrays(arr) {
    for (el of arr) {
      if (!Array.isArray(el)) {
        return false;
      }
    }
    return true;
  }

}
module.exports.checkArray = checkArray;

function validElements(units, allowedElements, debug) {

  for (let unit of units) {
    unitType = type(unit);
    if (debug) {
      console.log(`  Checking unit = '${unit}'`);
      console.log(`  unitType = ${unitType}`);
    }
    if (!allowedElements.includes(unitType)) {
      return false;
    }
  }

  return true;
}
module.exports.validElements = validElements;

function type(val) {
  // Object.prototype.toString.call(val) returns
  // [object X]
  // Where X is one of
  // Array Object String Date RegExp Function Boolean Number Null Undefined
  _type = Object.prototype.toString.call(val).slice(8,-1).toLowerCase();
  if (_type == "string" && val.length > 0) {
    _type = "string+";
  }
  return _type;
}
