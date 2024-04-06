function checkArray (units, size, name, allowedValues, allowedElements, debug) {
  // Implements
  // HAPI-data-access-spec-3.1.0.md#369-unit-and-label-arrays
  // at
  // https://github.com/hapi-server/data-specification/tree/master/hapi-3.1.0
  //
  // Usage:
  //   Check HAPI JSON units element given size array.
  //     checkArray(units, size)
  //   Same checks as on units, but error messages reference "label" instead of "unit"
  //    checkArray(label, size, 'label')
  //
  //   See checkArrayTest.js for usage examples.

  // allowedValues means values when not in array, e.g.,
  //   'units': 'm'
  //   'units': undefined
  // allowedElements means values in array when array, e.g.,
  //   'units': ['m']
  //   'units': [null]

  debug = debug || false

  if (!name) {
    name = 'units'
  }

  if (!Array.isArray(size)) {
    // Fail type 0.
    return 'size must be an array'
  }

  if (!Array.isArray(units)) {
    allowedValues = defaultAllowed(allowedValues, name, 'values', debug)
    if (validElements([units], allowedValues, debug)) {
      if (debug) console.log(`  ${name} is one of: ${allowedValues}`)
      // Pass type 1.
      return ''
    }
    // Fail type 1.
    return `'${name}' must be one of: ${allowedValues}`
  }

  if (debug) {
    console.log('  units is an array')
  }

  allowedElements = defaultAllowed(allowedElements, name, 'elements', debug)
  if (units.length === 1 && !Array.isArray(units[0])) {
    if (debug) {
      console.log(`  ${name}.length == 1`)
    }
    if (validElements(units, allowedElements, debug) === false) {
      // Fail type 2.
      return `${name}[0] must be one of: ${allowedElements}`
    }
    // Pass type 2.
    return ''
  }

  if (units.length !== size[0]) {
    // Fail type 4b
    return `${name}.length != size[0]`
  }

  if (size.length === 1) {
    if (debug) console.log('  size.length == 1')
    if (units.length !== size[0]) {
      // Fail type 3a
      return `${name}.length != size[0]`
    }
    if (validElements(units, allowedElements, debug) === false) {
      // Fail type 3b
      return `All elements of ${name} must be one of: ${allowedElements}`
    }
    // Pass type 3.
    return ''
  }

  if (size.length === 2) {
    // e.g.,
    // units = [["m","m","m"], ["s","s","s"]]
    // size = [2,3]
    return check2D(units, size, name, allowedElements, debug)
  }

  // e.g.,
  // units = [[ ["m","m"],["m","m"],["m","m"] ] , [ ["m","m"],["m","m"],["m","m"] ] ];
  // size = [2, 3, 2]
  if (debug) console.log(`  size.length = ${size.length}`)

  if (allArrays(units) === false) {
    // Fail type 4a
    return `Found and element in ${name} that is not an array`
  }

  // sizer = reduced size = [size[1], size[2]]
  const sizer = size.slice(1)
  // Loop over outermost elements of units
  for (let s = 0; s < size[0]; s++) {
    let err = ''
    if (size.length === 3) {
      err = check2D(units[s], sizer, name, allowedElements, debug)
    } else {
      err = checkArray(units[s], sizer, name, allowedElements, debug)
    }
    if (err !== '') {
      // Fail type 5c and 6a
      return `Error in ${name}[${s}]`
    }
  }
  // Pass type 5 and 6.
  return ''

  function check2D (units, size, name, allowedElements, debug) {
    if (allArrays(units) === false) {
      // Fail type 4a
      return `Found and element in ${name} that is not an array`
    }

    if (units.length !== size[0]) {
      // Fail type 4b
      return `${name}.length != size[0]`
    }
    if (debug) {
      const unitsJSON = JSON.stringify(units)
      const sizeJSON = JSON.stringify(size)
      console.log(`Checking ${name} = ${unitsJSON}, size = ${sizeJSON}`)
    }
    // Pass type 4.
    // e.g.,
    // size = [2, 3]
    // arr = [["m","m","m"],["m","m","m"]];
    if (debug) console.log('  size.length = 2')
    for (const u in units) {
      // Fail type 4c
      if (units[u].length != size[1]) {
        return `${name}[${u}].length != size[1]`
      }
      // Fail type 4d
      if (debug) {
        console.log(`units[${u}]: ${units[u]}`)
        console.log('allowedElements: ' + allowedElements)
        console.log(units[u])
        console.log(allowedElements)
      }
      if (validElements(units[u], allowedElements, debug) == false) {
        return `Elements of ${name}[${u}] must be strings or nulls`
      }
    }
    return ''
  }

  function allArrays (arr) {
    for (const el of arr) {
      if (!Array.isArray(el)) {
        return false
      }
    }
    return true
  }
}
module.exports.checkArray = checkArray

function defaultAllowed (allowed, name, _type, debug) {
  const _Type = _type.charAt(0).toUpperCase() + _type.slice(1)
  if (type(allowed) === 'string') {
    return `allowed${_Type} must be an array`
  }

  if (!allowed) {
    if (_type === 'values') {
      if (debug) console.log(`  Using default allowedValues for ${name}`)
      if (name === 'label') {
        allowed = ['undefined', 'string+', 'array']
      }
      if (name === 'units') {
        allowed = ['null', 'string+', 'array']
      }
    } else {
      if (debug) console.log(`  Using default allowedElements for ${name}`)
      allowed = ['string+']
      if (name === 'units') {
        allowed = ['string+', 'null']
      }
      if (name === 'label') {
        allowed = ['string+']
      }
    }
  }

  if (allowed.length > 1) {
    // Silently remove duplicates.
    allowed = [...new Set(allowed)]
  }

  if (debug) {
    const unitsJSON = JSON.stringify(units)
    const sizeJSON = JSON.stringify(size)
    console.log(`Checking ${name} = ${unitsJSON}, size = ${sizeJSON}`)
    console.log(`  allowed${_Type}: ${allowed}`)
  }

  const possibleElements = [
    'array', 'object', 'string', 'string+', 'date', 'regexp',
    'function', 'boolean', 'number', 'null', 'undefined'
  ]
  if (allowed) {
    for (let el of allowed) {
      el = el.toLowerCase()
      if (!possibleElements.includes(el)) {
        return `allowed${_Type} has element (${allowed}) that is not a subset of ${possibleElements}`
      }
    }
  }
  return allowed
}

function validElements (units, allowedElements, debug) {
  for (const unit of units) {
    const unitType = type(unit)
    if (debug) {
      console.log(`  Checking unit = '${unit}'`)
      console.log(`  unitType = ${unitType}`)
    }
    if (!allowedElements.includes(unitType)) {
      return false
    }
  }

  return true
}
module.exports.validElements = validElements

function type (val) {
  // Object.prototype.toString.call(val) returns
  // [object X]
  // Where X is one of
  // Array Object String Date RegExp Function Boolean Number Null Undefined
  let _type = Object.prototype.toString.call(val).slice(8, -1).toLowerCase()
  if (_type === 'string' && val.length > 0) {
    _type = 'string+'
  }
  return _type
}
