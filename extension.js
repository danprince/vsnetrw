let fs = require("node:fs/promises");
let path = require("node:path");
let { window, workspace, commands, Uri, EventEmitter } = require("vscode");

/**
 * The scheme is used to associate vsnetrw documents with the text content provider
 * that renders the directory listing.
 */
const scheme = "vsnetrw";

/**
 * The filename is used in the URI to recognise vsnetrw documents and apply
 * the vsnetrw language editor id and syntax highlighting.
 */
const defaultFileName = "vsnetrw";

/**
 * Creates a vsnetrw document uri for a given path.
 *
 * @param {string} dirName The directory to open
 * @returns {Uri} The path as a Uri
 */
function createUri(dirName) {
  return Uri.from({ scheme, path: defaultFileName, query: dirName });
}

/**
 * Event emitter used to trigger updates for the text document content provider.
 */
let uriChangeEmitter = new EventEmitter();

/**
 * Refresh the current vsnetrw document.
 */
function refresh() {
  let dir = getCurrentDir();
  let uri = createUri(dir);
  uriChangeEmitter.fire(uri);
}

/**
 * Get the current directory from the current document's Uri.
 * @returns The path to the directory that is open in the current vsnetrw document.
 */
function getCurrentDir() {
  return window.activeTextEditor.document.uri.query;
}

/**
 * Open a new vsnetrw document for a given directory.
 * @param {string} dirName
 */
async function openVsnetrw(dirName) {
  let uri = createUri(dirName);
  let doc = await workspace.openTextDocument(uri);
  await window.showTextDocument(doc, { preview: true });
}

/**
 * Check whether a  file is a non-empty directory.
 * @param {string} file
 * @returns {Promise<boolean>}
 */
async function isNonEmptyDir(file) {
  let stat = await fs.stat(file);
  if (!stat.isDirectory()) return false;
  let files = await fs.readdir(file);
  return files.length > 0;
}

/**
 * Returns the name of the file under the cursor in the current vsnetrw
 * document.
 * @returns {string}
 */
function getFileUnderCursor() {
  let doc = window.activeTextEditor.document;
  let editor = window.activeTextEditor;
  let line = doc.lineAt(editor.selection.active);
  return line.text;
}

/**
 * Opens a file in a text editor.
 * @param {string} fileName
 */
async function openFileInVscodeEditor(fileName) {
  let uri = Uri.file(fileName);
  await commands.executeCommand("vscode.open", uri);
}

/**
 * Prompts the user to rename the file that is currently under their cursor in
 * a vsnetrw document.
 *
 * If the name includes a path that does not exist, then it will be created.
 */
async function renameFileUnderCursor() {
  let file = getFileUnderCursor();
  let base = getCurrentDir();

  let newName = await window.showInputBox({
    title: "Rename",
    value: file,
    placeHolder: "Enter a new filename",
  });

  if (!newName) return;

  let pathToCurrent = path.join(base, file);
  let pathToNew = path.join(base, newName);
  let newPathDir = path.dirname(pathToNew);

  await fs.mkdir(newPathDir, { recursive: true });
  await fs.rename(pathToCurrent, pathToNew);

  refresh();
}

/**
 * Attempt to delete the file that is under the cursor in a vsnetrw document.
 *
 * If the file is a non-empty directory, then the user will be prompted before
 * deletion.
 */
async function deleteFileUnderCursor() {
  let file = getFileUnderCursor();
  let base = getCurrentDir();
  let pathToFile = path.join(base, file);

  // Never allow the user to accidentally delete the parent dir
  if (file == "../") return;

  if (await isNonEmptyDir(pathToFile)) {
    let selection = await window.showWarningMessage("Delete non-empty directory?", "Cancel", "Delete");
    if (selection !== "Delete") return;
  }

  await fs.rm(pathToFile, { recursive: true });
  refresh();
}

/**
 * Prompt the user to create a new file. If the name of the new file ends with a slash,
 * a directory will be created instead.
 *
 * If the file includes a path that does not exist, then the path will be created.
 */
async function createFile() {
  let base = getCurrentDir();

  let newFileName = await window.showInputBox({
    title: "Create New File / Directory",
    placeHolder: "Enter a name for the new file",
  });

  if (newFileName == null) return;
  let pathToFile = path.join(base, newFileName);

  if (newFileName.endsWith("/")) {
    await fs.mkdir(pathToFile, { recursive: true });
  } else {
    let dirName = path.dirname(pathToFile);
    await fs.mkdir(dirName, { recursive: true });
    await fs.appendFile(pathToFile, "");
  }

  refresh();
}

/**
 * Prompt the user to create a new directory. Intermediate directories that
 * don't exist will be created too.
 */
async function createDir() {
  let base = getCurrentDir();

  let newFileName = await window.showInputBox({
    title: "Create New Directory",
    placeHolder: "Enter a name for the new directory",
  });

  if (newFileName == null) return;
  let pathToDir = path.join(base, newFileName);
  await fs.mkdir(pathToDir, { recursive: true });
  refresh();
}

/**
 * Attempt to open the file that is currently under the cursor. If
 * vsnetrw is not already open, then it will be opened at the directory
 * of the currently opened file.
 *
 * If there is a file under the cursor, it will open in a vscode text
 * editor. If there is a directory under the cursor, then it will open in a
 * new vsnetrw document.
 */
async function openFileUnderCursor() {
  let doc = window.activeTextEditor.document;

  // Check whether we're already in a netrw buffer
  if (doc.uri.scheme === scheme) {
    // Open the file/dir under the cursor
    let relativePath = getFileUnderCursor();
    let basePath = getCurrentDir();
    let newPath = path.join(basePath, relativePath);
    let stat = await fs.lstat(newPath);

    if (stat.isDirectory()) {
      await openVsnetrw(newPath);
    } else {
      await openFileInVscodeEditor(newPath);
    }
  } else {
    // Open a new netrw instance at the current file's path
    let fileUri = doc ? doc.uri.fsPath : ".";
    let pathName = path.dirname(fileUri);
    await openVsnetrw(pathName);
  }
}

/**
 * Opens the parent directory in a vsnetrw document.
 */
async function openParentDirectory() {
  let doc = window.activeTextEditor.document;
  let pathName = doc.uri.query;
  let parentPath = path.dirname(pathName);
  openVsnetrw(parentPath);
}

/**
 * Combines the results from readdir and stat. Files/dirs that have stat
 * errors are silently omitted from the results.
 * 
 * @param {string} dirName
 * @return {Promise<{ file: string, stat: import("fs").Stats }[]>}
 */
async function readdirAndStat(dirName) {
  let files = await fs.readdir(dirName);

  let stats = await Promise.all(files
    .map(file => path.join(dirName, file))
    .map(file => fs.stat(file).catch(() => null))
  );

  let results = files.map((file, index) => {
    let stat = stats[index];
    return { file, stat };
  });

  return results.filter(result => result.stat != null);
}

/**
 * Renders the text content for the current vsnetrw document.
 * @param {Uri} uri
 * @returns {Promise<string>}
 */
async function provideTextDocumentContent(uri) {
  let pathName = uri.query;
  let results = await readdirAndStat(pathName);

  results.sort((a, b) => {
    return a.stat.isDirectory() ?
      b.stat.isDirectory() ? 0 : -1 :
      a.file < b.file ? -1 : 1;
  });

  let listings = results.map(res => {
    return res.stat.isDirectory() ? `${res.file}/` : res.file;
  });

  let hasParent = path.dirname(pathName) !== pathName;
  if (hasParent) listings.unshift("../");

  return listings.join("\n");
}

/**
 * @type {import("vscode").TextDocumentContentProvider}
 */
let contentProvider = {
  onDidChange: uriChangeEmitter.event,
  provideTextDocumentContent,
};

/**
 * @param {import("vscode").ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    workspace.registerTextDocumentContentProvider(scheme, contentProvider),
  );

  context.subscriptions.push(
    commands.registerCommand("vsnetrw.open", openFileUnderCursor),
    commands.registerCommand("vsnetrw.up", openParentDirectory),
    commands.registerCommand("vsnetrw.rename", renameFileUnderCursor),
    commands.registerCommand("vsnetrw.delete", deleteFileUnderCursor),
    commands.registerCommand("vsnetrw.create", createFile),
    commands.registerCommand("vsnetrw.createDir", createDir),
    commands.registerCommand("vsnetrw.refresh", refresh),
  );
}

module.exports = { activate };
