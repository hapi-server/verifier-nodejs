function cli() {
  argv = require('yargs')
          .help()
          .default({
              "server1": "https://cottagesystems.com/server/cdaweb/hapi",
              "server2": "https://cdaweb.gsfc.nasa.gov/hapi",
              "name1": "jf",
              "name2": "nl",
              "dataset": "AC_H0_MFI",
              "parameters": "",
              "start": "2021-03-12T00:00:42.000000000Z",
              "stop": "2021-03-12T00:20:42.000000000Z",
              "maxrecs": 2,
              "data": true,
              "namesonly": true,
              "simulate": false,
              "showpasses": false,
              "timefraction": "0.5"
          })
          .option('simulate',{'type': 'boolean'})
          .argv;
  delete argv['$0'];
  delete argv['_'];
  return argv;
}
module.exports.cli = cli;