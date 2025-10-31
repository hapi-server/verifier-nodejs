const fs = require('fs')
const clc = require('chalk')
const path = require('path')
const request = require('request')

const is = require('./is.js')
const writeURL = require('./report.js').writeURL
const writeResult = require('./report.js').writeResult

const argv =
  require('yargs')
    .usage('$0 <url|file> [options]')
    .version(false) // Disable default version meaning
    .options({ version: { string: true, alias: 'v' } })
    .default({
      test: false
    })
    .choices('version', is.schemaVersions)
    .demandCommand()
    .help()
    .argv

let arg = argv._[0]

// Remove cwd from beginning of path so full path not in logs in repo
const cwd = process.cwd()
if (arg && arg.indexOf(cwd) === 0) {
  arg = arg.slice(cwd.length)
  if (arg.startsWith(path.sep)) {
    arg = './' + arg.slice(1)
  }
}

writeURL(arg)

if (arg.startsWith('http')) {
  request(arg, (err, res, body) => {
    if (!err) {
      validate(body)
      return
    }
    console.error(`Request failure for ${arg}:`)
    console.log(err)
    process.exit(1)
  })
} else {
  fs.readFile(arg, (err, buff) => {
    if (!err) {
      validate(buff.toString())
      return
    }
    console.error(`Read failure for ${arg}:`)
    console.log(err.message)
    process.exit(1)
  })
}

function validate (str) {
  const parseResult = is.JSONParsable(str)
  if (parseResult.error === true) {
    writeResult(parseResult)
    process.exit(1)
  }
  const json = parseResult.json

  const version = getVersion(argv, json)
  const subSchema = inferSubSchema(json)
  if (subSchema === undefined) {
    const msg = 'Could not infer subschema from JSON.'
    const obj = { error: true, description: msg, got: undefined }
    writeResult(obj)
    process.exit(1)
  }
  const ignoreVersionError = Boolean(argv.version)
  if (ignoreVersionError) {
    let msg = '  ' + clc.yellowBright.inverse('⚠')
    msg += ' Ignoring version in JSON b/c version given on command line.'
    console.log(msg)
  }
  const jsonResult = is.HAPIJSON(json, version, subSchema, ignoreVersionError)
  writeResult(jsonResult)
  process.exit(0)
}

function getVersion (argv, json) {
  let version
  if (argv.version) {
    const versionResult = is.HAPIVersion(argv.version)
    if (versionResult.error === true) {
      writeResult(versionResult, 'warn')
      process.exit(1)
    }
    version = argv.version
  }

  if (version === undefined) {
    const versionResult = is.HAPIVersion(json.HAPI)
    writeResult(versionResult)
    if (versionResult.error === true) {
      process.exit(1)
    } else {
      version = json.HAPI
    }
  }

  return version
}

function inferSubSchema (json) {
  if (json.id) {
    return 'about'
  }
  if (json.outputFormats) {
    return 'capabilities'
  }
  if (json.catalog) {
    return 'catalog'
  }
  if (json.parameters) {
    if (json.data) {
      return 'data'
    } else {
      return 'info'
    }
  }
  if (json.status && json.status.code >= 1400) {
    return 'error'
  }
}
