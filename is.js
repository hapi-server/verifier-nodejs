const fs = require('fs')
const path = require('path')
const diff = require('deep-diff').diff
const moment = require('moment')
const Validator = require('jsonschema').Validator

const schemaURL = 'https://github.com/hapi-server/verifier-nodejs/tree/master/schemas'
const wikiURL = 'https://github.com/hapi-server/verifier-nodejs/wiki'
const requestURL = 'https://github.com/request/request#requestoptions-callback'
const jsonLintLink = "<a href='http://jsonlint.org/'>http://jsonlint.org/</a>"
const unitsAndLabels = 'https://github.com/hapi-server/data-specification/blob/master/hapi-dev/HAPI-data-access-spec-dev.md#369-unit-and-label-arrays'
const deepDiffLink = '<a href="https://www.npmjs.com/package/deep-diff">deep-diff</a>'

const base = path.join(__dirname, 'data-specification-schema/')
const schemas = {}
fs.readdirSync(base).forEach(file => {
  if (file.startsWith('HAPI-data-access-schema') && path.extname(file) === '.json') {
    const version = path.basename(file, '.json').split('schema-').pop();
    schemas[version] = require(path.join(base, file))
  }
})

const schemaVersions = Object.keys(schemas).sort()
exports.schemaVersions = schemaVersions

function schema (version) {
  const json = schemas[version]
  if (!json) {
    return false
  } else {
    return schemas[version]
  }
}

function prod (arr) {
  // TODO: Also in tests.js. Move to lib.js (and create lib.js)
  // Compute product of array elements.
  return arr.reduce(function (a, b) { return a * b })
}

function callerName () {
  return 'is.' + callerName.caller.name + '(): '
}

function isinteger (str) {
  return parseInt(str) < 2 ^ 31 - 1 &&
         parseInt(str) > -2 ^ 31 &&
         parseInt(str) === parseFloat(str) &&
         /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim())
}

function isfloat (str) {
  return Math.abs(parseFloat(str)) < Number.MAX_VALUE &&
         /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test(str.trim())
}

function nFields (header, pn) {
  let nf = 1
  if (pn === 0) {
    // Primary time parameter
    return nf
  }
  if (pn !== undefined && pn !== null) {
    // One parameter
    // nf = number of fields (columns) counter (start at 1 since time checked already)
    if (!header.parameters[pn].size) {
      nf = nf + 1 // Width of field (number of columns of field)
    } else {
      nf = nf + prod(header.parameters[pn].size)
    }
  } else {
    // All parameters
    nf = 0 // Number of fields (columns) counter
    for (let i = 0; i < header.parameters.length; i++) {
      if (!header.parameters[i].size) {
        nf = nf + 1 // Width of field (number of columns of field)
      } else {
        nf = nf + prod(header.parameters[i].size)
      }
    }
  }
  return nf
}

function csvToArray (text) {
  // https://stackoverflow.com/a/41563966/1491619
  let p = ''; let row = ['']; const ret = [row]; let i = 0; let r = 0; let s = !0; let l
  for (l of text) {
    if (l === '"') {
      if (s && l === p) row[i] += l
      s = !s
    } else if (l === ',' && s) l = row[++i] = ''
    else if (l === '\n' && s) {
      if (p === '\r') row[i] = row[i].slice(0, -1)
      row = ret[++r] = [l = '']; i = 0
    } else row[i] += l
    p = l
  }
  return ret
}

function versionWarning (version) {
  if (parseFloat(version) >= 3.2) {
    // GitHub does not allow link to milestone string. Instead, it uses the milestone number.
    // To link directly, would need to create a label that is same as milestone string.
    const verifierMileStone = `<a href="https://github.com/hapi-server/verifier-nodejs/issues?q=is%3Aissue+is%3Aopen+label%3A3.2">verifier ${version} milestone issues</a>`
    const schemaMileStone = `<a href="https://github.com/hapi-server/data-specification-schema/issues?q=is%3Aissue+is%3Aopen+label%3A3.2">schema ${version}  milestone issues</a>`
    return `; <span style="background-color: yellow">Warning: HAPI schema version ${version} is in development. ` +
           `See ${verifierMileStone} and ${schemaMileStone}</span>`
  }
  return ''
}

function HAPIVersionSame (url, version, urlLast, versionLast) {
  const des = 'Expect HAPI version to match that from previous requests when given.'
  let got = `Current: '<code>${version}</code>' and Last: '<code>${versionLast}</code>'`
  let err = false
  if (version !== versionLast) {
    got = `<code>${version}</code> for ${url}\n<code>${versionLast}</code> for ${urlLast}`
    err = true
  }
  return {
    description: callerName() + des,
    error: err,
    got
  }
}
exports.HAPIVersionSame = HAPIVersionSame

function HAPIVersion (version, ignoreVersionError) {
  let got = '<code>' + version + '</code>'
  let err = false
  if (!schemaVersions.includes(version)) {
    err = true
    got = "'<code>" + version + "</code>', which is not valid or not implemented by verifier."
    if (ignoreVersionError) {
      got += ' Will use latest version implemented by verifier: ' + schemaVersions.pop()
    }
  }

  const des = 'Expect HAPI version in JSON response to be one of ' +
          '<code>' +
          JSON.stringify(schemaVersions) +
          '</code>'
  return {
    description: callerName() + des,
    error: err,
    got
  }
}
exports.HAPIVersion = HAPIVersion

function JSONParsable (text) {
  const ret = {
    description: callerName() + 'Expect <code>JSON.parse(response)</code> to not throw error',
    error: false,
    got: ''
  }

  try {
    const json = JSON.parse(text)
    ret.json = json
    return ret
  } catch (error) {
    ret.got = 'JSON.parse of:\n\n' + text + '\n\nresulted in ' + error +
            '. Use ' + jsonLintLink +
            ' for a more detailed error report. '
    ret.error = true
    return ret
  }
}
exports.JSONParsable = JSONParsable

function HAPIJSON (text, version, part, ignoreVersionError) {
  const s = schema(version)

  if (s === false) {
    const known = JSON.stringify(Object.keys(schemas))
    const desc = 'Expect HAPI version to be one of <code>' + known + '</code>'
    const got = `Schema version '<code>${version}</code>' is not one of <code>${known}</code>`
    return {
      description: callerName() + desc,
      error: true,
      got
    }
  }

  let json = text
  if (typeof (text) !== 'object') {
    json = JSON.parse(text)
  }

  const v = new Validator()
  // Look for all top-level elements that have an id starting with a /.
  // These are subschemas that are used.
  for (const key in s) {
    if (s[key].id && s[key].id[0] === '/') {
      // console.log("Adding schema " + s[key]["id"]);
      v.addSchema(s[key], s[key].id)
    }
  }

  if (part === 'error' && parseInt(version.split('.')) < 3) {
    // In version 3+, error is a top-level element.
    part = 'HAPIStatus'
  }

  if (ignoreVersionError && !s[part]) {
    return
  }
  if (!s[part]) {
    const desc = `Expect HAPI JSON schema to have a element named '${part}'.`
    const got = `No element named '${part}' in HAPI schema. Is HAPI schema version '${version}' correct?`
    return {
      description: callerName() + desc,
      error: true,
      got
    }
  }

  let vr
  try {
    vr = v.validate(json, s[part])
  } catch (e) {
    console.log(json)
    console.log(part)
    console.log(e)
    return {
      description: callerName() + 'Call to JSON validator failed.',
      error: true,
      got: e.toString()
    }
  }

  const ve = vr.errors
  let got = 'JSON is valid with respect to JSON schema.'
  const err = []
  if (ve.length !== 0) {
    for (let i = 0; i < ve.length; i++) {
      if (ignoreVersionError && ve[i].property === 'instance.HAPI') {
        continue
      }
      err[i] = ve[i].property.replace('instance.', '') +
             ' ' + ve[i].message.replace(/"/g, "'")
    }
    if (err.length > 0) {
      got = '\n  <pre>' + JSON.stringify(err, null, 4) + '</pre>'
    }
  }

  const url = schemaURL + '/HAPI-data-access-schema-' + version + '.json'
  const desc = 'Expect body to be valid ' +
           "<a href='" + url + "'>HAPI " +
           version + " '" + part + "' schema</a>." +
           versionWarning(version)

  return {
    description: callerName() + desc,
    error: err.length !== 0,
    got
  }
}
exports.HAPIJSON = HAPIJSON

function timeregexes (version) {
  const json = schemas[version]
  if (!json) {
    return false
  }
  const tmp = json.HAPIDateTime.anyOf
  const regexes = []
  for (let i = 0; i < tmp.length; i++) {
    regexes[i] = tmp[i].pattern
  }
  return regexes
}
exports.timeregexes = timeregexes

function trailingZfix (str) {
  // moment.js does not consider date only with trailing Z to be valid ISO8601
  if (/^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]Z$|^[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]Z$/.test(str)) {
    str = str.slice(0, -1) + 'T00Z'
  }
  return str
}
exports.trailingZfix = trailingZfix

function RequestError (err, res, timeoutInfo) {
  const tout = timeoutInfo.value
  const when = timeoutInfo.when

  if (!err) {
    // Remove extra precision on timings.
    const timings = res.timings
    for (const key in timings) {
      timings[key] = timings[key].toFixed(1)
    }
    const timingPhases = res.timingPhases
    for (const key in timingPhases) {
      timingPhases[key] = timingPhases[key].toFixed(1)
    }

    let timeInfo = ''
    if (timingPhases && timings) {
      timeInfo = JSON.stringify(timings) + ', ' + JSON.stringify(timingPhases)
      timeInfo = ` <a href='${requestURL}'>Timing info [ms]</a>: ${timeInfo}`
    }
    return {
      description: callerName() + 'Expect no request error for timeout of ' + tout + ' ms when ' + when,
      error: false,
      got: timeInfo
    }
  }

  if (err.code === 'ETIMEDOUT') {
    // https://github.com/request/request/blob/master/request.js#L846
    return {
      description: callerName() + 'Expect HTTP headers and start of response body in less than ' + tout + ' ms when ' + when,
      error: true,
      got: err.code
    }
  } else if (err.code === 'ESOCKETTIMEDOUT') {
    // https://github.com/request/request/blob/master/request.js#L811
    return {
      description: callerName() + 'Expect time interval between bytes sent to be less than ' + tout + ' ms when ' + when,
      error: true,
      got: err.code
    }
  } else if (err.code === 'ECONNRESET') {
    return {
      description: callerName() + 'Expect connection to not be reset by server',
      error: true,
      got: 'ECONNRESET'
    }
  } else if (err.code === 'ECONNREFUSED') {
    return {
      description: callerName() + 'Expect connection to not be refused by server',
      error: true,
      got: err.code
    }
  } else {
    return {
      description: callerName() + 'URL is malformed?',
      error: true,
      got: err
    }
  }
}
exports.RequestError = RequestError

function CadenceGiven (cadence) {
  const base = 'https://github.com/hapi-server/data-specification/'
  const url = base + 'blob/master/hapi-dev/HAPI-data-access-spec-dev.md'
  const desc = 'Expect the nominal cadence to be given ' +
           `(see <a href='${url}'>` +
           'the HAPI spec for definition</a>). A nominal cadence is useful ' +
           'for clients and obviates the need for it to be inferred programatically.'
  return {
    description: callerName() + desc,
    error: typeof (cadence) !== 'string',
    got: cadence || 'no cadence'
  }
}
exports.CadenceGiven = CadenceGiven

function CadenceValid (cadence) {
  // https://stackoverflow.com/a/53140944/1491619
  // TODO: Move to JSON schema.
  const re = /^P(?!$)((\d+Y)|(\d+\.\d+Y$))?((\d+M)|(\d+\.\d+M$))?((\d+W)|(\d+\.\d+W$))?((\d+D)|(\d+\.\d+D$))?(T(?=\d)((\d+H)|(\d+\.\d+H$))?((\d+M)|(\d+\.\d+M$))?(\d+(\.\d+)?S)?)??$/
  const t = re.test(cadence) === true
  let got = cadence + ' valid.'
  if (t === false) {
    got = cadence + ' is invalid.'
    if (typeof (cadence) === 'string' && cadence.toUpperCase() === cadence) {
      got = got + ' (Letters in cadence should be uppercase.)'
    }
  }
  const desc = 'Expect cadence to be a valid ISO8601 duration ' +
               '(regular expression tested: ' + re.toString() + ').'
  return {
    description: callerName() + desc,
    error: t === false,
    got
  }
}
exports.CadenceValid = CadenceValid

function CadenceOK (cadence, start, stop, what) {
  if (!cadence) return // Don't do test; no cadence given.

  if (!stop) {
    const desc = 'Need more than two lines to do cadence ' +
             'comparison with consecutive samples.'
    return {
      description: callerName() + desc,
      error: true,
      got: 'One line.'
    }
  }
  // console.log(start)
  // console.log(stop)
  start = trailingZfix(start)
  stop = trailingZfix(stop)
  const t1 = moment(trailingZfix(start), moment.ISO_8601).isValid()
  const t2 = moment(trailingZfix(stop), moment.ISO_8601).isValid()
  if (!t1 || !t2) {
    return {
      description: callerName() + `Could not parse start = '${start}' or stop = '${stop}'`,
      error: true,
      got: `start = '${start}' and stop = '${stop}'`
    }
  }

  const startms = moment(start).valueOf()
  const stopms = moment(stop).valueOf()

  const md = moment.duration(cadence)
  const R = (stopms - startms) / md._milliseconds
  if (what === 'start/stop') {
    const t = R > 1
    const got = '(stopDate-startDate)/cadence = ' + (stopms - startms) / md._milliseconds
    return {
      description: callerName() + 'Expect (stopDate-startDate)/cadence > 1',
      error: t !== true,
      got
    }
  }
  if (what === 'sampleStart/sampleStop') {
    const t = R > 10
    const got = '(sampleStartDate-sampleStopDate)/cadence = ' + (stopms - startms) / md._milliseconds
    const desc = 'Expect (sampleStopDate-sampleStartDate)/cadence &gt; 10'
    return {
      description: callerName() + desc,
      error: t !== true,
      got
    }
  }
  if (what === 'consecsamples') {
    const t = R > 10
    const got = 'Cadence/(time[i+1]-time[i]) = ' + (stopms - startms) / md._milliseconds
    return {
      description: callerName() + 'Expect (t[i+1]-t[i])/cadence &gt; 10',
      error: t !== true,
      got
    }
  }
}
exports.CadenceOK = CadenceOK

function CIdentifier (arr, type) {
  // https://stackoverflow.com/questions/14953861/
  // representing-identifiers-using-regular-expression
  const reString = '[_a-zA-Z][_a-zA-Z0-9]{1,30}'

  let arrayFail = []
  const re = new RegExp(reString)
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i].id.match(re)
    if (m) {
      const t = m[0] === m.input
      if (!t) {
        arrayFail.push(arr[i].id)
      }
    } else {
      // Happens with Unicode in id.
      arrayFail.push(arr[i].id)
    }
  }
  let got = 'All ' + type + '(s) match.'
  if (arrayFail.length > 0) {
    const No = arrayFail.length
    if (arrayFail.length > 10) {
      arrayFail = arrayFail.slice(0, 10)
      arrayFail.push('\n ... (' + (No - 10) + ') more.')
    }
    got = No + ' datasets ids that are not c identfiers:\n\n' + arrayFail.join('\n')
  }

  const desc = `Prefer ${type} to match c identifier regex '<code>${reString}</code>'.`
  return {
    description: callerName() + desc,
    error: arrayFail.length > 0,
    got
  }
}
exports.CIdentifier = CIdentifier

function ErrorCorrect (code, wanted, what) {
  if (what === 'httpcode') {
    const desc = 'Expect HTTP code in JSON to be <code>' + wanted + '</code>'
    return {
      description: callerName() + desc,
      error: code !== wanted,
      got: code !== wanted ? code : ''
    }
  }
  if (what === 'hapicode') {
    const t = code === wanted
    const got = `<code>${code}</code>`
    const desc = 'Expect HAPI code in JSON to be <code>' + wanted + '</code>'
    return {
      description: callerName() + desc,
      error: t !== true,
      got
    }
  }
}
exports.ErrorCorrect = ErrorCorrect

function StatusInformative (message, wanted, what) {
  const re = new RegExp(wanted)
  const err = re.test(message) === false
  const got = `'${message}'.`

  const link = `<a href='${wikiURL}#status-informative'>(Explanation.)</a>`
  const post = `to contain the string '${wanted}' (default HAPI error message). ${link}`
  let desc = 'Want HAPI status message in JSON response' + post
  if (what === 'httpstatus') {
    desc = 'Want HTTP status message ' + post
  }
  return {
    description: callerName() + desc,
    error: err,
    got
  }
}
exports.StatusInformative = StatusInformative

function HeaderParsable (body) {
  const desc = 'Expect header lines in data stream to' +
           ' be JSON parsable after removal of leading #s.'
  const ret = {
    description: callerName() + desc,
    error: false,
    got: ''
  }

  let csvparts
  try {
    csvparts = splitCSV(body)
  } catch (error) {
    ret.got = 'Could not split CSV into header and data parts.'
    ret.error = true
    return ret
  }
  ret.csvparts = csvparts

  try {
    ret.csvparts.header = JSON.parse(csvparts.header)
    return ret
  } catch (error) {
    ret.got = '<code>JSON.parse()</code> of \n\n' + csvparts.header + '\n\nresulted in ' +
            error + `. Use ${jsonLintLink} for a more detailed error report.`
    ret.error = true
    return ret
  }

  function splitCSV (bodyString) {
    let headerString = ''
    const bodyLines = bodyString.split(/\r?\n/)
    let i
    for (i = 0; i < bodyLines.length; i++) {
      if (bodyLines[i][0] === '#') {
        headerString = headerString + bodyLines[i].slice(1)
      } else {
        break
      }
    }
    const dataString = bodyLines.slice(i).join('\n')
    return {
      header: headerString,
      data: dataString
    }
  }
}
exports.HeaderParsable = HeaderParsable

function TypeCorrect (header, body, pn) {
  const nf = nFields(header, pn)
  const lines = csvToArray(body)

  // TODO: Check all lines?
  const line1 = lines[0]

  let err = false
  let got = ''
  let rObj = {}
  for (let j = 0; j < nf; j++) {
    const extra = ' in column ' + j + ' on first line'

    let type = header.parameters[pn].type
    if (j === 0) {
      type = header.parameters[0].type
    }
    if (type === 'isotime') {
      rObj = ISO8601(line1[j].trim(), extra)
      if (rObj.error) {
        got = rObj.description + `\ngave '<code>${rObj.got}'</code>\n`
        err = rObj.error
      }
    }
    if (type === 'integer') {
      rObj = Integer(line1[j], extra)
      if (rObj.error) {
        got = rObj.description + `\ngave '<code>${rObj.got}'</code>\n`
        err = rObj.error
      }
    }
    if (type === 'double') {
      rObj = Float(line1[j], extra)
      if (rObj.error) {
        got = rObj.description + '\ngave <code>' + rObj.got + '<code>\n'
        err = rObj.error
      }
    }
  }

  if (got !== '') {
    got = got + 'Line 1: <code>' + line1 + '</code>'
  }

  return {
    description: callerName() + 'Expect values on first line of CSV to have correct type.',
    error: err,
    got: got || 'Correct length and type.'
  }
}
exports.TypeCorrect = TypeCorrect

function NumberOfColumnsCorrect (header, body, pn) {
  const nf = nFields(header, pn)
  const lines = csvToArray(body)

  let t = false
  let got = '<code>(' + nf + ')' + ' - (' + nf + ')</code>'
  if (lines.length === 0) {
    got = '<code>(0)' + ' - (' + nf + ')</code>'
  }
  for (let i = 0; i < lines.length - 1; i++) {
    t = nf !== lines[i].length
    if (t) {
      got = '<code>(' + lines[i].length + ')' + ' - (' + nf + ')</code>'
      got = got + ' on line <code>' + (i + 1) + '</code>'
      break
    }
  }
  const desc = 'Expect (# of columns in CSV) - ' +
            '(# computed from length and size metadata) = 0.'
  return {
    description: callerName() + desc,
    error: t,
    got
  }
}
exports.NumberOfColumnsCorrect = NumberOfColumnsCorrect

function FileContentSameOrConsistent (header, body, bodyAll, what, pn) {
  if (bodyAll === undefined && body !== undefined) {
    return {
      description: callerName() + 'Consistency with empty response.',
      error: true,
      got: 'Content differs. One is empty and other is not.'
    }
  }
  if (bodyAll !== undefined && body === undefined) {
    return {
      description: callerName() + 'Consistency with empty response.',
      error: true,
      got: 'Content differs. One is empty and other is not.'
    }
  }

  const nf = nFields(header, pn)
  const lines = csvToArray(body)
  const linesAll = csvToArray(bodyAll)
  // var lines = body.split("\n");
  // var linesAll = bodyAll.split("\n");

  if (what === 'same') {
    const desc = 'Expect data response for to be same as previous request with different but equivalent request URL.'

    if (bodyAll !== body) { // byte equivalent
      if (lines.length !== linesAll.length) {
        const got = '<code>' + lines.length + '</code> rows here vs. <code>' +
                    linesAll.length + '</code> rows previously.'
        return {
          description: callerName() + desc,
          error: true,
          got
        }
      }

      // Look for location of difference.
      let line = ''
      let lineAll = ''
      let e1 = false
      let e2 = false
      let i
      for (i = 0; i < lines.length - 1; i++) {
        // line = lines[i].split(",");
        // lineAll = linesAll[i].split(",");
        line = lines[i]
        lineAll = linesAll[i]

        if (line.length !== lineAll.length) {
          e1 = true
          break
        }

        for (let j = 0; j < line.length - 1; j++) {
          if (line[j].trim() !== lineAll[j].trim()) {
            e2 = true
            break
          }
        }
        if (e2) { break }
      }
      if (e1) {
        const got = line.length + ' columns vs. ' +
                    lineAll.length + ' columns on line ' + (i + 1) + '.'
        return {
          description: callerName() + desc,
          error: true,
          got
        }
      }
      if (e2) {
        const got = 'Difference on line ' + (i + 1) + ' column ' + (nf + 1) + '.'
        return {
          description: callerName() + desc,
          error: true,
          got
        }
      }
      // TODO: Can e1 and e2 be false?
    }
    return {
      description: callerName() + desc,
      error: false,
      got: 'Match'
    }
  }

  if (what === 'consistent') {
    if (lines.length !== linesAll.length) {
      const desc = 'Expect number of rows from one parameter request to' +
                   ' match data from all parameter request.'
      const got = ' # rows in single parameter request = <code>' + lines.length + '</code>' +
                  ' # in all parameter request = <code>' + linesAll.length + '</code>'
      return {
        description: callerName() + desc,
        error: true,
        got
      }
    }

    // Find first column of parameter being checked.
    let fc = 0 // First column of parameter.
    for (let i = 0; i < header.parameters.length; i++) {
      if (header.parameters[i].name === header.parameters[pn].name) {
        break
      }
      if (!header.parameters[i].size) {
        fc = fc + 1
      } else {
        fc = fc + prod(header.parameters[i].size)
      }
    }

    const desc = 'Expect content from one parameter request to' +
                 ' match content from all parameter request.'
    let t = false
    let got = 'Consistent content'
    let gotCount=0
    let gotLimit=4

    for (let i = 0; i < lines.length - 1; i++) {
      // let line = lines[i].split(",");
      // let lineAll = linesAll[i].split(",");
      const line = lines[i]
      const lineAll = linesAll[i]

      // Time
      if (line[0].trim() !== lineAll[0].trim()) {
        t = true
        got += '\nTime column  does not match at time ' +
               line[0] + ": Single parameter request: '" + line[1] +
               "'; All parameter request: '" + lineAll[0] + "'."
      }

      if (pn === 0) {
        continue
      }

      // Number of columns
      if (line.length > lineAll.length) {
        const desc = 'Expect number of columns from one parameter request to be' +
             ' equal to or less than number of columns in all parameter request.'
        got += '\n# columns in single parameter request = ' + line.length +
             ' # in all parameter request = <code>' + lineAll.length +
             '</code>.'
        return {
          description: callerName() + desc,
          error: true,
          got
        }
      }

      // Parameter
      // nf = number of fields for parameter
      // fc = first column of field for parameter
      for (let j = 0; j < nf - 1; j++) {
        if (!line[1 + j] || !lineAll[fc + j]) {
          t = true
          if ( gotCount<gotLimit ) {
            got += '\nProblem with line <code>' + (i) + '</code>:\n' +
              'Single parameter request: <code>' + line[1 + j] +
              '</code>; All parameter request: <code>' + lineAll[fc + j] +
              '</code>.'
          }
          gotCount++
          break
        }

        if (line[1 + j].trim() !== lineAll[fc + j].trim()) {
          let name = '#' + header.parameters[pn].name
          if (header.parameters[pn].name) {
            name = "'" + header.parameters[pn].name + "'"
          }
          if (nf === 2) {
            t = true
            if ( gotCount<gotLimit ) {
                got += '\nParameter <code>' + name + '</code> does not match at time ' +
                    line[0] + ': Single parameter request: <code>' + line[1] +
                    '</code>; All parameter request: <code>' + lineAll[fc + j] +
                    '</code>.\n'
            }
            gotCount++
          } else {
            if ( gotCount<gotLimit ) {
                got += '\nParameter <code>' + name + '</code> field #<code>' + j +
                    '</code> does not match at time <code>' + line[0] +
                    '</code>: Single parameter request: <code>' + line[1 + j] +
                    '</code>; All parameter request: <code>' + lineAll[fc + j] +
                    '</code>.\n'
            }
            gotCount++
          }
        }
      } 
    }
    if ( gotCount>gotLimit ) {
      got += "\n("+(gotCount-gotLimit)+" additional messages suppressed.)\n"
    }

    return {
      description: callerName() + desc,
      error: t,
      got
    }
  }
}
exports.FileContentSameOrConsistent = FileContentSameOrConsistent

function FileStructureOK (body, what, statusMessage, emptyExpected) {
  if (what === 'empty') {
    const link = `<a href='${wikiURL}#empty-body'> (Details.)</a>`

    const emptyIndicated = /HAPI 1201/.test(statusMessage)
    if (!body || body.length === 0) {
      if (emptyExpected) {
        const desc = "If data part of response has zero length, prefer '<code>HAPI 1201</code>'" +
                ' (no data in time range) in HTTP header status message' +
                ' (if possible).' + link
        return {
          description: callerName() + desc,
          error: emptyIndicated === false,
          got: "Zero bytes and HTTP header status message of '<code>" + statusMessage + "</code>'"
        }
      } else {
        const desc = 'The verifier should have enough information to make a' +
                ' request that returns data. Avoid this error by adding or' +
                ' modifying sample{Start,Stop} in /info response (preferred)' +
                ' or set a start/stop where there are data in the verifier' +
                ' query parameters (or command-line arguments). ' + link
        return {
          description: callerName() + desc,
          error: true,
          got: 'Zero bytes.'
        }
      }
    }
    if (body && body.length !== 0 && emptyIndicated) {
      const desc = 'A data part of response with zero bytes was expected' +
              " because '<code>HAPI 1201</code>' (no data in time range) in HTTP header" +
              ' status message.' + link
      return {
        description: callerName() + desc,
        error: false,
        got: "'<code>HAPI 1201</code>' in HTTP header status message and <code>" + body.length + '</code> bytes.'
      }
    }
    return {
      description: callerName() + 'Expect nonzero length for data part of response.',
      error: false,
      got: `<code>${body.length}</code> bytes.`
    }
  }

  let desc, t, got
  if (what === 'firstchar') {
    desc = 'Expect first character of CSV response to be an integer.'
    t = !/^[0-9]/.test(body.substring(0, 1))
    got = `<code>${body.substring(0, 1)}</code>`
  }

  if (what === 'lastchar') {
    desc = 'Expect last character of CSV response be a newline.'
    t = !/\n$/.test(body.slice(-1))
    got = body.slice(-1).replace(/\n/g, '\\n')
    if (t) {
      got = "The character '<code>" + got + "'</code>"
    } else {
      got = ''
    }
  }

  if (what === 'extranewline') {
    desc = 'Expect last two characters of CSV response to not be newlines.'
    t = /\n\n$/.test(body.slice(-2))
    got = body.slice(-2).replace(/\n/g, '\\n')
    if (t) {
      got = ''
    } else {
      got = "The characters '<code>" + got + "</code>'"
    }
  }

  if (what === 'numlines') {
    const lines = body.split('\n')
    got = lines.length + ' newlines'
    if (lines.length === 0) {
      got = 'No lines.'
    } else {
      got = lines.length + ' newlines'
    }
    desc = 'Expect at least one newline in CSV response.'
    t = lines.length === 0
  }

  return {
    description: callerName() + desc,
    error: t,
    got
  }
}
exports.FileStructureOK = FileStructureOK

function LengthOK (header, body, pn) {
  const nf = nFields(header, pn)
  const lines = csvToArray(body)

  // TODO: Check all lines?
  const line1 = lines[0]

  if (pn === 0) {
    const len = header.parameters[0].length
    const name = header.parameters[0].name
    const desc = `Expect (length of '<code>${name}</code>' in CSV) == (<code>parameters['${name}'].length</code>).`
    const err = len !== line1[0].length
    return {
      description: callerName() + desc,
      error: err,
      got: err ? `${len} != ${line1[0].length}` : `${len} == ${line1[0].length}`
    }
  }

  const type = header.parameters[pn].type
  if (!(type === 'string' || type === 'isotime')) {
    return
  }
  const len = header.parameters[pn].length
  const name = header.parameters[pn].name

  let desc = `Expect (length of '<code>${name}</code>' in CSV) ≤ (<code>parameters['name'].length</code>).`
  if (nf > 1) {
    desc = `Expect (length of '<code>${name}</code>' components in CSV) ≤ (<code>parameters['name'].length</code>).`
  }
  let got = ''
  let err = false
  for (let j = 1; j < nf; j++) {
    const extra = ' in column ' + j + ' on first line'
    err = Buffer.byteLength(line1[j], 'utf8') > len
    if (err) {
      got = '(' + (line1[j].length) + ') &gt; (' + (len) + ') ' + extra + '\n'
    }
  }
  return {
    description: callerName() + desc,
    error: err,
    got: got === '' ? 'All values meet expectation.' : got
  }
}
exports.LengthOK = LengthOK

function SizeCorrect (nc, nf, header) {
  const t = nc === nf
  let got, extra
  if (header.size) {
    extra = 'product of elements in size array ' + JSON.stringify(header.size)
    got = nc + ' commas and ' + extra + ' = ' + nf
  } else {
    if (nf === 0) {
      extra = '0 because only first parameter (time) requested.'
    } else {
      extra = '1 because no size given.'
    }
    got = nc + ' commas'
  }
  return {
    description: callerName() + 'Expect number of commas on first line to be ' + extra,
    error: t !== true,
    got
  }
}
exports.SizeCorrect = SizeCorrect

function LengthAppropriate (len, type, name) {
  const got = 'Type = <code>' + type + '</code> and length = <code>' +
          len + "</code> for parameter '<code>" + name + "</code>'"
  let desc = 'If <code>type = string</code> or <code>isotime</code>, length must be given'
  let obj
  if (/isotime|string/.test(type) && !len) {
    obj = {
      description: desc,
      error: true,
      got
    }
  } else if (!/isotime|string/.test(type) && len) {
    obj = {
      description: desc,
      error: true,
      got
    }
  } else {
    desc = 'Length may only be given for types <code>string</code> and <code>isotime</code>'
    obj = {
      description: desc,
      error: false,
      got
    }
  }
  obj.description = callerName() + obj.description
  return obj
}
exports.LengthAppropriate = LengthAppropriate

function DefinitionsOK (json) {
  const desc = 'Expect no <code>definitions</code> element in JSON response unless ' +
               " request URL has '<code>resolve_references=false</code>'"
  const got = '<code>definitions</code> element in JSON response.'
  const error = json.definitions !== undefined
  const obj = {
    description: callerName() + desc,
    error,
    got: error ? got : 'No ' + got
  }
  return obj
}
exports.DefinitionsOK = DefinitionsOK

function InfoSame (headerInfo, headerBody, whatCompared) {
  // If whatCompared === 'infoVsHeader',
  // compares /info response with info header in data response.

  // If whatCompared === 'APIvsAPI',
  // compare /info?id= response with /info?dataset= response.

  // If whatCompared === 'infoVsDepthAll',
  // compare /catalog?depth=all response with all /info?id=... responses.

  const differences = diff(headerInfo, headerBody)
  const keptDiffs = []

  let lhs = ''
  let rhs = ''
  if (whatCompared === 'infoVsHeader') {
    lhs = '/info'
    rhs = 'info in header of data response'
  }
  if (whatCompared === 'APIvsAPI') {
    lhs = '/info?id='
    rhs = '/info?dataset='
  }
  if (whatCompared === 'infoVsDepthAll') {
    lhs = '/catalog?depth=all'
    rhs = 'Combined /info?id=... responses'
  }

  if (differences) {
    for (let i = 0; i < differences.length; i++) {
      let keep = true
      if (whatCompared === 'infoVsHeader' && differences[i].path) {
        if (differences[i].path[0] === 'format' || differences[i].path[0] === 'creationDate') {
          //console.log(`Ignoring path[0] = ${differences[i].path[0]}`)
          continue
        }
      }
      if (whatCompared === 'infoVsDepthAll' && differences[i].path) {
        if (differences[i].path[0] === 'HAPI' || differences[i].path[0] === 'status') {
          //console.log(`Ignoring path[0] = ${differences[i].path[0]}`)
          continue
        }
      }

      for (let j = 0; j < differences[i].path.length; j++) {
        if (typeof (differences[i].path[j]) === 'string' && differences[i].path[j].substring(0, 2) === 'x_') {
          //console.log(`Ignoring path[${j}] = ${differences[i].path[j]}`)
          keep = false
          break
        }
      }
      if (keep === true) {
        keptDiffs.push(differences[i])
      }
    }
  }
  let desc = ''
  if (whatCompared === 'infoVsHeader') {
    desc = 'Expect <code>/info</code> response to match header' +
           " in data response when '<code>include=header</code>' requested."
  }
  if (whatCompared === 'APIvsAPI') {
    desc = 'Expect <code>/info?id=</code> response to match <code>/info?dataset=</code>.'
  }
  if (whatCompared === 'infoVsDepthAll') {
    desc = 'Expect <code>/catalog?depth=all</code> content to match what' +
           ' obtained for <code>/info?dataset=...</code> for all datasets.'
  }

  if (keptDiffs.length === 0) {
    return {
      description: callerName() + desc,
      error: false,
      got: ''
    }
  } else {
    const got = `Differences:\n<pre>${JSON.stringify(keptDiffs, null, 2)}</pre>` +
                `where\nlhs = <code>${lhs}</code>\nrhs = <code>${rhs}</code>\n` +
                `See ${deepDiffLink} for notation explanation.\n`

    return {
      description: callerName() + desc,
      error: true,
      got
    }
  }
}
exports.InfoSame = InfoSame

function InfoEquivalent (infoAll, infoSingle) {
  const desc = 'Expect info response for one parameter to match content in response for all parameters'
  const robj = {
    description: callerName() + desc,
    error: false,
    got: 'Match'
  }

  const fullKeys = Object.keys(infoAll)
  const reducedKeys = Object.keys(infoSingle)

  // Check top-level of object
  if (fullKeys.length !== reducedKeys.length) {
    robj.got = `Full info response has ${fullKeys.length} keys; `
    robj.got += `reduced info response has ${reducedKeys.length} keys.`
    robj.error = true
    return robj
  }

  for (const key of reducedKeys) {
    if (key === 'parameters') {
      continue
    }
    if (!require('util').isDeepStrictEqual(infoAll[key], infoSingle[key])) {
      robj.got = `Full info response value of <code>${key}</code> does not match that in single parameter info response.`
      robj.error = true
      return robj
    }
  }

  for (const parameterReduced of infoSingle.parameters) {
    for (const parameterFull of infoAll.parameters) {
      if (parameterFull.name === parameterReduced.name) {
        if (!require('util').isDeepStrictEqual(parameterFull, parameterReduced)) {
          robj.got = `Parameter object for <code>${parameterFull.name}</code> in request for all parameters `
          robj.got += 'does not match corresponding parameter object in request for one parameter.'
          robj.error = true
          return robj
        }
      }
    }
  }

  return robj
}
exports.InfoEquivalent = InfoEquivalent

function FormatInHeader (header, type) {
  // https://github.com/hapi-server/data-specification/blob/master/
  // hapi-2.1.1/HAPI-data-access-spec-2.1.1.md#info
  if (type === 'nodata') {
    const t = 'format' in header
    let got = 'No format given.'
    if (t) {
      got = "Format of '<code>" + header.format + "</code>' specified."
    }
    const desc = "<code>/info</code> response should not have '<code>format</code>' specified for this type of request."
    return {
      description: callerName() + desc,
      error: t,
      got
    }
  }
  if (type === 'data') {
    const t = !('format' in header)
    let got = 'No format given.'
    if (!t) {
      got = "Format of '<code>" + header.format + "</code>' specified."
    }
    const desc = "JSON header in CSV response should have '<code>format: csv</code>' specified."
    return {
      description: callerName() + desc,
      error: t,
      got
    }
  }
}
exports.FormatInHeader = FormatInHeader

function FirstParameterOK (header, what) {
  if (what === 'name') {
    const desc = 'First parameter should (not must) be named' +
             " '<code>Time</code>' b/c clients will likely label first" +
             " parameter as '<code>Time</code>'" +
             ' on plot to protect against first parameter names that are' +
             ' not sensible.'
    return {
      description: callerName() + desc,
      error: header.parameters[0].name !== 'Time',
      got: '<code>header.parameters[0].name</code>'
    }
  }
  if (what === 'fill') {
    let t = false
    let got = 'null'
    if (!('fill' in header.parameters[0])) {
      got = 'No fill entry.'
    }
    if (header.parameters[0].fill != null) {
      t = true
      got = header.parameters[0].fill
    }
    const desc = 'First parameter must have a fill of null' +
             ' or it should not be specified.'
    return {
      description: callerName() + desc,
      error: t,
      got
    }
  }
}
exports.FirstParameterOK = FirstParameterOK

function LabelOrUnitsOK (name, array, size, which, version) {
  if (parseFloat(version) < 2.1) {
    return
  }

  let desc = `Expect <code>${which}</code> for parameter '<code>${name}</code>'`
  desc += ` to have a <a href="${unitsAndLabels}">valid structure</a>.`

  const checkArray = require('./lib/checkArray.js').checkArray

  const err = checkArray(array, size, which)

  return {
    description: callerName() + desc,
    error: err !== '',
    got: err || 'Valid structure'
  }
}
exports.LabelOrUnitsOK = LabelOrUnitsOK

function BinsLengthOK (name, bins, size, version) {
  if (!bins) return
  let got = 'Match'
  let err = false
  if (bins.length !== size.length) {
    got = `bins.length = ${bins.length} ≠ size.length = ${size.length}`
    err = true
  }
  return {
    description: 'Expect bins.length == size.length',
    got,
    error: err
  }
}
exports.BinsLengthOK = BinsLengthOK

function BinsLabelOrUnitsOK (name, bins, size, d, which, version) {
  if (parseFloat(version) < 2.1) {
    return
  }

  if (!bins) return
  if (Array.isArray(bins[which]) && bins[which].length > 1) {
    const msg = `${name}[${which}]["units"] is an array with length > 1, so expect ` +
            `${name}[${which}]["units"].length == ${name}["size"][${d}]`
    if (bins[which].length === size[d]) {
      return {
        description: callerName() + msg,
        got: 'Match',
        error: false
      }
    } else {
      return {
        description: callerName() + msg,
        got: `bins[${which}].length ≠ ${name}["size"][${d}]`,
        error: true
      }
    }
  }
  // No check needed. Schema checks types.
}
exports.BinsLabelOrUnitsOK = BinsLabelOrUnitsOK

function BinsCentersOrRangesOK (parameters, pn, d, which, version) {
  const param = parameters[pn]
  const name = parameters[pn].name
  const bins = parameters[pn].bins

  if (!bins || !bins[d] || !bins[d][which]) return

  if (typeof bins[d][which] === 'string') {
    const rname = bins[d][which] // referenced parameter name

    let rpn // referenced parameter number
    for (const pidx in parameters) {
      if (parameters[pidx].name === rname) {
        rpn = pidx
        break
      }
    }

    const msgo = `${name}["bins"][${d}]["${which}"] is a string that references ` +
                 'another parameter, so expect'

    if (!rpn) {
      return {
        description: callerName() + msgo + ' referenced parameter to be in dataset.',
        got: `No parameter named '${rname}'`,
        error: true
      }
    }

    if (rpn === pn) {
      return {
        description: callerName() + msgo + ' referenced parameter to have a different name than bins parent parameter.',
        got: 'Self reference',
        error: true
      }
    }

    const rparam = parameters[rpn]

    if (rparam.bins) {
      return {
        description: callerName() + msgo + ' referenced parameter to not have a bins element.',
        got: `Parameter ${rname}["bins"] may not be given.`,
        error: true
      }
    }

    if (rparam.units && Array.isArray(rparam.units)) {
      // TODO: Check for consistency?
      return {
        description: callerName() + msgo + ' units to not be an array.',
        got: `Parameter ${rname}["units"] may not be an array.`,
        error: true
      }
    }
    if (rparam.label && Array.isArray(rparam.label)) {
      return {
        description: callerName() + msgo + ' label to not be an array.',
        got: `Parameter ${rname}["label"] may not be an array.`,
        error: true
      }
    }
    if (!['integer', 'double'].includes(rparam.type)) {
      return {
        description: callerName() + msgo + ' to be an integer or double.',
        got: `Parameter ${rname}["type"] = ${rparam.type}`,
        error: true
      }
    }
    if (!rparam.size) {
      return {
        description: callerName() + msgo + ' to have a size element.',
        got: `Parameter '${rname}' does not have a size element.`,
        error: true
      }
    }

    if (!Array.isArray(rparam.size)) {
      // size = 10 => size = [10]
      rparam.size = [rparam.size]
    }

    if (which === 'centers') {
      if (rparam.size.length > 1) {
        return {
          description: callerName() + msgo + ` ${rname}["size"].length = 1`,
          got: `Parameter ${rname}["size"].length = ${rparam.size.length}`,
          error: true
        }
      }
      if (rparam.size[0] !== param.size[d]) {
        return {
          description: callerName() + msgo + ` ${rname}["size"][0] = ${name}["size"][${d}]`,
          got: `Parameter ${rname}["size"][0] = ${rparam.size[0]} and ${name}["size"][${d}] = ${param.size[d]}`,
          error: true
        }
      }
    }

    if (which === 'ranges') {
      if (rparam.size.length !== 2) {
        return {
          description: callerName() + msgo + ` ${rname}["size"].length = 2`,
          got: `Parameter ${rname}["size"].length = ${rparam.size.length}`,
          error: true
        }
      }
      if (rparam.size[1] !== 2) {
        return {
          description: callerName() + msgo + ` ${rname}["size"][1] = 2.`,
          got: `Parameter ${rname}["size"][1] = ${rparam.size[1]}`,
          error: true
        }
      }
      if (rparam.size[0] !== param.size[d]) {
        return {
          description: callerName() + msgo + ` ${rname}["size"][0] = ${name}["size"][${d}].`,
          got: `Parameter ${rname}["size"][0] = ${rparam.size[0]} and ${name}["size"][${d}] = ${param.size[d]}`,
          error: true
        }
      }
    }
    // TODO: Check values are numbers?
    return {
      description: callerName() + msgo + ' referenced parameter to exist, have correct size, and statisfy other constraints.',
      got: 'Referenced parameter found is an acceptable reference.',
      error: false
    }
  }

  if (bins[d][which]) {
    if (bins[d][which].length === param.size[d]) {
      const msg = callerName() + `Expect bins[${d}]["${which}"].length = ${name}["size"][${d}]`
      return {
        description: callerName() + msg,
        got: `bins[${d}][${which}].length = ${bins[d][which].length} and ${name}["size"][${d}] = ${param.size[d]}`,
        error: bins[d][which].length !== param.size[d]
      }
    }
    if (which === 'ranges') {
      // TODO: Check that all elements of bins[${d}]["ranges"] have length of 2.
    }
  }

  if (which === 'ranges') {
    if (bins[d].centers === null && bins[d].ranges !== undefined) {
      // "Each dimension must be described in the bins object,
      // but any dimension not representing binned data should indicate this
      // by using '"centers": null' and not including the 'ranges' attribute."
      // Could be written into schema, but is complex.
      // What about case where ranges are known, but centers are not known?
      const msg = callerName() + `If ${name}["bins"][${d}]["centers"] = null, ` +
              `no ${name}["bins"][${d}]["ranges"] allowed.`
      return {
        description: callerName() + msg,
        got: `${name}["bins"][${d}]["ranges"] ≠ null`,
        error: true
      }
    }
  }

  return {
    description: callerName() + `Expect ${name}["bins"][${d}]["${which}"] to have correct size and if "centers" = null, no "ranges" given.`,
    got: '',
    error: false
  }
}
exports.BinsCentersOrRangesOK = BinsCentersOrRangesOK

function AllowedOutputFormat (json) {
  // Existence of 'csv' can't be checked easily with schema using enum.
  // (Could be done using oneOf for outputFormats and have csv be in emum
  // array for each of the objects in oneOf.)
  // Possible solution?: https://stackoverflow.com/a/17940765
  const outputFormats = json.outputFormats || 'No outputFormats element.'
  return {
    description: "Expect <code>outputFormats</code> to have '<code>csv</code>'",
    error: outputFormats.indexOf('csv') === -1,
    got: '<code>' + outputFormats.join(', ') + '</code>'
  }
}
exports.AllowedOutputFormat = AllowedOutputFormat

function FillOK (fill, type, len, name, what) {
  if (!fill) { return } // No fill or fill=null so no test needed.

  let t = false
  let got = 'fill = ' + fill + ' for parameter ' + name + '.'
  if (typeof (fill) === 'string') {
    got = "fill = '" + fill + "' for parameter " + name + '.'
  }
  let desc = ''
  if (what === 'nullstring') {
    desc = "Expect fill value to not be the string '<code>null</code>'."
    if (fill === 'null') {
      t = true
      got = " The string 'null'; Probably fill=null and not fill='null' was intended."
    }
  }
  if (what === 'isotime') {
    desc = 'Expect length of fill value for a isotime parameter to be equal to length of the string parameter'
    if (len === fill.length && name !== 'Time') {
      t = true
    }
  }
  if (what === 'string') {
    desc = 'Expect length of fill value for a string parameter to be &lt;= length of the string parameter'
    if (len < fill.length) {
      t = true
      got = got + ' string length = ' + len + '; fill length = ' + fill.length
    }
  }
  if (what === 'stringparse') {
    desc = 'Expect fill value for a string parameter to not parse to an integer or float'
    if (isinteger(fill) || isfloat(fill)) {
      t = true
      got = got + ' This was probably not intended.'
    }
  }
  // TODO: Check integer is not NaN.
  //       Check isinteger(fill)
  if (what === 'integer-decimal') {
    desc = "Expect fill value for a parameter with type='<code>integer</code>' to not have a decimal point"
    if (/\./.test(fill)) {
      t = true
      got = got + ' This was probably not intended. '
    }
  }

  if (what === 'double' || what === 'integer') {
    desc += `Expect fill value for a parameter with type='<code>${what}</code>' to be 'NaN' or parse to a ${what}`
    if (fill.toLowerCase() === 'nan') {
      got = got + ' fill.toLowerCase() == "nan"'
    } else {
      if (what === 'integer') {
        if (!isinteger(fill)) {
          t = true
        }
        got = got + ` isinteger(fill) = ${isinteger(fill)}`
      }
      if (what === 'double') {
        if (!isfloat(fill)) {
          t = true
        }
        got = got + ` isfloat(fill) = ${isfloat(fill)}`
      }
    }
  }
  return {
    description: callerName() + desc,
    error: t,
    got
  }
}
exports.FillOK = FillOK

function LastModifiedGiven (headers) {
  return {
    description: callerName() + 'Prefer <code>Last-Modified</code> header to be given for responses that return only metadata.',
    error: headers['last-modified'] === undefined,
    got: 'Last-Modified: ' + headers['last-modified']
  }
}
exports.LastModifiedGiven = LastModifiedGiven

function HTTP302or200 (res) {
  const desc = 'Expect HTTP status code to be <code>200</code> or <code>302</code> and Location header to have URL that ends with <code>/hapi/</code>.'
  let got = `HTTP status code <code>${res.statusCode}</code> and Location header <code>${res.headers.location}</code>`
  let err = true
  if (res.statusCode === 200) {
    got = `HTTP status code <code>${res.statusCode}</code>.`
    err = false
  } else if (res.statusCode === 302 && /\/hapi\/$/.test(res.headers.location)) {
    err = false
  }
  return {
    description: callerName() + desc,
    error: err,
    got
  }
}
exports.HTTP302or200 = HTTP302or200

function HTTP200 (res) {
  let body = ''
  let got = ''
  if (res.statusCode !== 200) {
    got = 'HTTP status code <code>' + res.statusCode + '</code>' + body
    try {
      JSON.parse(res.body)
      body = ' and JSON body\n\t' + JSON.stringify(body, null, 4).replace(/\n/g, '\n\t')
    } catch (error) {
    }

    if (!body) {
      body = ' and non JSON.parse()-able body:\n' + res.body.replace(/\n/g, '\n\t')
    } else {
      body = ''
    }
  }
  return {
    description: callerName() + 'Expect HTTP status code to be <code>200</code>',
    error: res.statusCode !== 200,
    got
  }
}
exports.HTTP200 = HTTP200

function TimeParameterUnitsOK (name, units, type, size) {
  const got = "type = '" + type + "' and units = '" + units + "' for parameter " + name + '.'

  if (type === 'isotime') {
    let err = false
    if ( units===null ) {
        return {
            description: callerName() + "Expect parameter of type <code>isotime</code> to have non-null units of \"UTC\".",
            error: true,
            got
        };
    }
    if (typeof (units) === 'object') {
      for (let i = 0; i < units.length; i++) {
        for (let j = 0; j < units[i].length; j++) {
          if (units[i][j] !== 'UTC') {
            err = true
            break
          }
        }
      }
    } else {
      if (units !== 'UTC') {
        err = true
      }
    }

    return {
      description: callerName() + "Expect parameter of type <code>isotime</code> to have units of '<code>UTC</code>'.",
      error: err,
      got
    }
  }
}
exports.TimeParameterUnitsOK = TimeParameterUnitsOK

function TimeInBounds (lines, start, stop) {
  // Remove Z from all times so Date().getTime() gives local timezone time for all.
  // Javascript Date assumes all date/times are in local timezone.

  start = start.trim().replace(/Z$/, '')
  stop = stop.trim().replace(/Z$/, '')

  const firstTime = lines[0].split(',').shift().trim().replace(/Z$/, '')
  let lastTime = firstTime
  // Find the last line with content.
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[lines.length - i - 1] !== '') {
      lastTime = lines[lines.length - i - 1].split(',').shift().trim().replace(/Z$/, '')
      break
    }
  }
  const got = 'First time = <code>' + firstTime + '</code>; ' +
              'LastTime = <code>' + lastTime + '</code>'
  const a = moment(firstTime).valueOf() >= moment(start).valueOf()
  const b = moment(lastTime).valueOf() < moment(stop).valueOf()
  const t = a && b
  const desc = 'Expect first time in CSV ≥ <code>' +
           start + '</code> and last time in CSV &lt; <code>' +
           stop + '</code> (only checks to ms)'
  return {
    description: callerName() + desc,
    error: t !== true,
    got
  }
}
exports.TimeInBounds = TimeInBounds

function TimeIncreasing (header, what) {
  let got = 'Increasing time values'
  let t
  let ts = 'increasing first column time values.'
  if (what === 'CSV') {
    const starttest = new Date().getTime()
    // Remove blanks (caused by extra newlines)
    header = header.filter(function (n) { return n !== '' })
    // Don't run test if only one record.
    if (header.length === 1) { return }

    for (let i = 0; i < header.length - 1; i++) {
      const line = header[i].split(',')
      const linenext = header[i + 1].split(',')
      // var t = new Date(linenext[0].trim()).getTime() > new Date(line[0].trim()).getTime();
      if (!line || !linenext) {
        t = false
        got = 'Problem with line ' + (i) + ' or ' + (i + 1)
        break
      }
      try {
        const a = moment(trailingZfix(linenext[0].trim())).valueOf()
        const b = moment(trailingZfix(line[0].trim())).valueOf()
        t = a > b
      } catch (e) {
        t = false
        got = 'Was not able to parse either ' + linenext[0].trim() + ' or ' + line[0].trim()
        break
      }
      // console.log(linenext[0].trim())
      // console.log(moment.valueOf(linenext[0].trim()))
      if (!t) {
        got = 'line ' + (i + 1) + ' = ' + linenext[0] + '; line ' + (i) + ' = ' + line[0]
        break
      }
      if (new Date().getTime() - starttest > 10) {
        // Stop testing after 10 ms.
        got = got + ' in first ' + (i + 1) + ' lines.'
        break
      }
    }
  }

  let start, stop
  if (what === '{start,stop}Date') {
    start = trailingZfix(header.startDate)
    stop = trailingZfix(header.stopDate)
    ts = 'info.startDate &lt; info.stopDate'
    // var t = new Date(start).getTime() < new Date(stop).getTime();
    t = moment(start).valueOf() < moment(stop).valueOf()
    got = 'startDate = <code>' + start + '</code>; ' + 'stopDate = <code>' + stop + '</code>'
  }

  if (what === 'sample{Start,Stop}Date') {
    start = trailingZfix(header.sampleStartDate)
    stop = trailingZfix(header.sampleStopDate)
    if (!start && !stop) return false
    if (start && stop) {
      // var t = new Date(start).getTime() < new Date(stop).getTime();
      t = moment(start).valueOf() < moment(stop).valueOf()
      ts = 'info.sampleStartDate &lt; info.sampleStopDate'
      got = 'sampleStartDate = ' + start + '; sampleStopDate = ' + stop
    } else {
      if (!stop) {
        ts = 'info.sampleStartDate does not have a matching sampleStopDate'
        t = false
        got = 'a missing date'
      } else {
        ts = 'info.sampleStopDate does not have a matching sampleStartDate'
        t = false
        got = 'a missing date'
      }
    }
  }

  if (t) {
    got = got.replace('&gt;', '&lt;')
  }
  return {
    description: callerName() + 'Expect ' + ts,
    error: t !== true,
    got
  }
}
exports.TimeIncreasing = TimeIncreasing

function ISO8601 (str, extra) {
  // TODO: Change to HAPIISO8601.
  // https://github.com/hapi-server/data-specification/issues/54
  extra = extra || ''
  const t = moment(trailingZfix(str), moment.ISO_8601).isValid()
  const ts = "moment('" + trailingZfix(str) +
         "',moment.ISO_8601).isValid() == true" + extra
  return {
    description: callerName() + 'Expect ' + ts,
    error: t !== true,
    got: 'moment(' + trailingZfix(str) + ',moment.ISO_8601).isValid() = ' + t
  }
}
exports.ISO8601 = ISO8601

function HAPITime (isostr, version) {
  const schemaregexes = timeregexes(version)
  // schemaregexes come from list in a schema file in ./schemas.
  let got, str, result
  let t = true
  if (typeof (isostr) === 'object') {
    const starttest = new Date().getTime()
    got = ''
    for (let i = 0; i < isostr.length; i++) {
      if (isostr[i] === '') { break };
      str = isostr[i].split(',')[0].trim()
      result = HAPITime(str, version)
      if (result.error === true) {
        t = false
        got = "'" + str + "'" + ' is not a valid HAPI Time string.'
        if (!/Z$/.test(str)) {
          got = got + ' (Missing trailing Z.)'
        }
        if (!/^[0-9]$/.test(str)) {
          got = got + ' (First character is not [0-9].)'
        }
        break
      }
      if (new Date().getTime() - starttest > 10) {
        // Stop testing after 10 ms.
        got = got + ' in first ' + (i + 1) + ' lines.'
        break
      }
      // console.log(isostr[i] + " " + t)
    }
    const url = schemaURL + '/HAPI-data-access-schema-' + version + '.json'
    const desc = 'Expect time column to contain valid ' +
                 "<a href='" + url + "'>HAPI " + version + ' HAPITime strings</a>'
    return {
      description: callerName() + desc,
      error: t !== true,
      got
    }
  }

  // Tests if a string is a valid HAPI time representation, which is a subset of ISO 8601.
  // Two tests are made: (1) A set of regular expressions in the JSON schema (see ./schemas)
  // and (2) A set of semantic tests.

  // The semantic tests are that:
  // (1) DOY can be no more than 365 on non-leap years, 366 on leap years,
  // (2) DOM must be valid

  function isleap (year) {
    return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0)
  }

  let regexPass = false
  let re
  for (let i = 0; i < schemaregexes.length; i++) {
    re = new RegExp(schemaregexes[i])
    regexPass = re.test(isostr)
    if (regexPass) {
      // console.log(' Passing pattern:' + schemaregexes[i])
      break
    }
  }

  // console.log(" Regex pass: " + regexPass);
  let semanticPass = true
  if (regexPass) {
    // Only check semantic rules if regular expression test passed.
    const year = parseInt(isostr.slice(0, 4))
    let isoStringSplit = isostr.split(/-|T/)

    let doy, mo, day
    if (isoStringSplit.length > 1) {
      if (isoStringSplit[1].length === 3) {
        doy = parseInt(isoStringSplit[1])
      } else {
        mo = parseInt(isoStringSplit[1])
        isoStringSplit = isostr.split(/-/)
        if (isoStringSplit.length > 2) {
          day = parseInt(isoStringSplit[2])
        }
      }
    }

    // DOY can be no more than 365 on non-leap years, 366 on leap years
    if (doy === 366 && isleap(year) === false) {
      semanticPass = false
    }
    if (doy > 366) {
      semanticPass = false
    }

    // DOM must be correct
    if (day) {
      if ([4, 6, 9, 11].includes(mo) && day > 30) {
        semanticPass = false
      }
      if (mo === 2 && isleap(year) && day > 29) {
        semanticPass = false
      }
      if (mo === 2 && !isleap(year) && day > 28) {
        semanticPass = false
      }
    }
  }
  // console.log(" Semantic pass: " + regexPass);

  const e = !(regexPass && semanticPass)
  // if (t==false) {console.log("x" + isostr)}
  return {
    description: callerName() + 'Expect time value to be a valid HAPI time string.',
    error: e,
    got
  }
}
exports.HAPITime = HAPITime

function Integer (str, extra) {
  extra = extra || ''
  const t = isinteger(str)
  let ts = `(parseInt("${str}") &lt; 2^31 - 1 || `
  ts += `parseInt("${str}") &lt; -2^31) && `
  ts += `parseInt(${str}) == parseFloat(${str})`
  ts += extra
  return {
    description: callerName() + 'Expect ' + ts,
    error: t !== true,
    got: 'parseInt(' + str + ') = ' + parseInt(str) + ' and ' + 'parseFloat(' + str + ') = ' + parseFloat(str)
  }
}
exports.Integer = Integer

function Float (str, extra) {
  extra = extra || ''
  const t = isfloat(str)
  const ts = "Math.abs(parseFloat('" + str + "')) &lt; " +
             Number.MAX_VALUE + ' && ' +
             "<code>/^[-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]{1,3})?$/.test('" + str + "'.trim()) == true</code>" +
         extra
  return {
    description: callerName() + 'Expect ' + ts,
    error: t !== true,
    got: t
  }
}
exports.Float = Float

function Unique (arr, arrstr, idstr) {
  if (!arr.length) {
    return {
      description: callerName() + 'Expect ' + arrstr + ' to be an array',
      error: true,
      got: typeof (arr)
    }
  }

  const ids = []
  const rids = []
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i][idstr]) continue
    if (ids.indexOf(arr[i][idstr]) > -1 && rids.indexOf(arr[i][idstr])) {
      rids.push(arr[i][idstr])
    }
    ids[i] = arr[i][idstr]
  }
  const uids = Array.from(new Set(ids)) // Unique values

  const e = !(uids.length === ids.length)
  let got = ''
  if (e) {
    got = 'Repeated at least once: ' + rids.join(',')
  }
  const desc = "Expect all '" + idstr + "' values in objects in " + arrstr + ' array to be unique'
  return {
    description: callerName() + desc,
    error: e,
    got
  }
}
exports.Unique = Unique

function TooLong (arr, arrstr, idstr, elstr, N) {
  // idstr = "id" for datasets and "name" for parameter.
  let ids = []
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i][elstr]) continue
    if (arr[i][elstr]) {
      if (arr[i][elstr].length > N) {
        ids.push("id: '<code>" + arr[i][idstr] + "</code>'; title: '" + arr[i][elstr] + "'")
      }
    }
  }
  let got = "All titles in '<code>" + arrstr + "</code>' ≤ " + N + ' characters'
  const No = ids.length
  if (ids.length > 0) {
    if (ids.length > 10) {
      ids = ids.slice(0, 10)
      ids.push('\n ... (' + (No - 10) + ') more.')
    }
    got = arrstr + ' has ' + No + ' datasets with a ' + elstr + ' &gt; ' +
        N + ' characters: \n\n' + ids.join('\n')
  }
  return {
    description: callerName() + 'Prefer ' + elstr + 's in objects to be ≤ 40 characters',
    error: ids.length !== 0,
    got
  }
}
exports.TooLong = TooLong

function CORSAvailable (head) {
  const ahead = 'Access-Control-Allow-Origin'
  const astr = head[ahead.toLowerCase()]
  const a = /\*/.test(astr)

  const bhead = 'Access-Control-Allow-Methods'
  const bstr = head[bhead.toLowerCase()] || ''
  let b = true
  // If not specified, Methods = GET, HEAD, and POST are allowed.
  // See links in https://stackoverflow.com/a/44385327
  if (bstr !== '') {
    b = /GET/.test(bstr)
  }

  const want = "<code>Access-Control-Allow-Origin = '*'</code> and, if given, " +
           "<code>Access-Control-Allow-Methods</code> to include <code>'GET'</code>"
  let got = `<code>Access-Control-Allow-Origin = '${astr}'</code> and `
  if (bstr) {
    got = got + `<code>Access-Control-Allow-Methods '${bstr}'</code>`
  } else {
    got = got + 'No <code>Access-Control-Allow-Methods</code> header.'
  }
  const e = !(a && b)
  const desc = 'To enable AJAX clients, want CORS HTTP Headers: ' + want
  return {
    description: callerName() + desc,
    error: e,
    got
  }
}
exports.CORSAvailable = CORSAvailable

function CompressionAvailable (headers) {
  let available = false
  // Note: request module used for http requests only allows gzip to
  // be specified in Accept-Encoding, so error here may be misleading
  // if server can use compress or deflate compression algorithms but
  // not gzip (should be a rare occurence).
  let got = 'No <code>gzip</code> in <code>Content-Encoding</code> header. ' +
          'Compression will usually speed up transfer of data.'
  const re = /gzip/
  if (headers['content-encoding']) {
    available = re.test(headers['content-encoding'])
    if (available) { got = headers['content-encoding'] }
  }
  const desc = 'Expect HTTP Accept-Encoding to match <code>' + re + '</code>.'
  return {
    description: callerName() + desc,
    error: !available,
    got: !available ? got : ''
  }
}
exports.CompressionAvailable = CompressionAvailable

function ContentType (re, given) {
  return {
    description: callerName() + 'Expect HTTP <code>Content-Type</code> to match <code>' + re + '</code>',
    error: !re.test(given),
    got: re.test(given) ? `<code>${given}</code>` : 'No match.'
  }
}
exports.ContentType = ContentType
