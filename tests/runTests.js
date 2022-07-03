let path = require("node:path");
let Mocha = require("mocha");
let glob = require("fast-glob");

async function run() {
  let mocha = new Mocha({
    color: true,
    timeout: 15000,
  });

  let root = __dirname;
  let files = await glob("**/*.test.js", { cwd: root });

  for (let file of files) {
    mocha.addFile(path.resolve(root, file));
  }

  return new Promise((resolve, reject) => {
    mocha.run(failures => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed`));
      } else {
        resolve(null);
      }
    });
  });
}

module.exports = { run };
