let fs = require("node:fs/promises");
let path = require("node:path");
let assert = require("node:assert");
let vscode = require("vscode");

let tempWorkspacesRoot = "/tmp/workspaces";

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * @param {string} file
 */
async function fileExists(file) {
  try {
    await fs.stat(file);
    return true;
  } catch (err) {
    if (/ENOENT/.test(err.message)) {
      return false;
    }
    throw err;
  }
}

async function cleanTempWorkspaces() {
  if (await fileExists(tempWorkspacesRoot)) {
    await fs.rm(tempWorkspacesRoot, { recursive: true });
  }

  await fs.mkdir(tempWorkspacesRoot, { recursive: true });
}

/**
 * @param  {string[]} files
 */
async function createTempWorkspace(files) {
  let id = Math.random().toString(16).slice(4);
  let baseDir = path.join(tempWorkspacesRoot, id);

  await fs.mkdir(baseDir, { recursive: true });

  await Promise.all(files.map(async name => {
    let fileName = path.join(baseDir, name);

    if (name.endsWith("/")) {
      await fs.mkdir(fileName, { recursive: true });
    } else {
      let dirName = path.dirname(fileName);
      await fs.mkdir(dirName, { recursive: true });
      await fs.writeFile(fileName, name);
    }
  }));

  // Change to the new baseDir to allow for relative paths in tests
  process.chdir(baseDir);
  return process.cwd();
}

/**
 * @param {string} line
 */
async function moveToLine(line) {
  let editor = vscode.window.activeTextEditor;
  assert(editor);
  let text = editor.document.getText();
  let lines = text.split("\n");
  let index = lines.indexOf(line);

  if (index < 0) {
    console.error(`Could not find line: "${line}"`);
    console.error(`Current editor lines:`, lines);
  }

  assert(index >= 0, "Could not find line");

  editor.selections = [new vscode.Selection(
    new vscode.Position(index, 0),
    new vscode.Position(index, 0),
  )];
}

function getActiveEditorText() {
  assert(vscode.window.activeTextEditor);
  return vscode.window.activeTextEditor.document.getText();
}

/**
 * @param {string[]} lines
 */
function assertLinesMatch(lines) {
  let text = getActiveEditorText();
  assert.equal(text, lines.join("\n"));
}

let _showInputBox = vscode.window.showInputBox;
let _showWarningMessage = vscode.window.showWarningMessage;

/**
 * @param {string | undefined} value
 */
function mockInputBox(value) {
  vscode.window.showInputBox = async () => value;
}

/**
 * @param {string | undefined} value
 */
function mockWarningMessage(value) {
  vscode.window.showWarningMessage = async () => value;
}

function resetWindowMocks() {
  vscode.window.showInputBox = _showInputBox;
  vscode.window.showWarningMessage = _showWarningMessage;
}

/**
 * 
 * @param {string} command
 * @param  {...any} args
 */
async function execCommand(command, ...args) {
  await vscode.commands.executeCommand(command, ...args);
  await sleep(100);
}

module.exports =  {
  sleep,
  fileExists,
  execCommand,
  assertLinesMatch,
  cleanTempWorkspaces,
  createTempWorkspace,
  moveToLine,
  getActiveEditorText,
  mockInputBox,
  mockWarningMessage,
  resetWindowMocks,
};
