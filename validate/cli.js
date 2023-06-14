import { readFile } from 'node:fs';

export function cli(cb) {
  const fileOrUrl = process.argv[2];
  const version = process.argv[3];
  if (fileOrUrl.startsWith('http')) {
    request(arg0, (err, res, body) => {
      if (!err) {
        cb(body, argv["version"]);
        return;
      }
      console.error("Request failure for " + arg0 + ":");
      console.log(err);
      process.exit(1);
    });
  } else {
    readFile(fileOrUrl, (err, buff) => {
      if (!err) {
        cb(buff.toString(), version);
        return;
      }
      console.error("Read failure for " + arg0 + ":");
      console.log(err);
      process.exit(1);      
    });
  }
}
