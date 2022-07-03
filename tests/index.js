let path = require("node:path");
let { runTests } = require("@vscode/test-electron");

let extensionDevelopmentPath = path.resolve(__dirname, "../");

async function main() {
  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath: path.resolve(__dirname, "./runTests.js"),
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
