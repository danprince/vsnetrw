let assert = require("node:assert");
let path = require("node:path");
let { homedir } = require("node:os");
let { window, workspace, commands, Uri, EventEmitter, FileType, Selection } = require("vscode");

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
 * Get the current directory from the current document's Uri.
 * @returns The path to the directory that is open in the current vsnetrw document.
 */
function getCurrentDir() {
  let editor = window.activeTextEditor;
  assert(editor && editor.document.uri.scheme === scheme, "Not a vsnetrw editor");
  return editor.document.uri.query;
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
 * Check whether the active editor is an explorer.
 * @param {import("vscode").TextEditor | undefined} editor
 * @returns {editor is import("vscode").TextEditor}
 */
function isExplorer(editor) {
  return editor?.document.uri.scheme === scheme;
}

/**
 * A map from directory paths to selections, so that cursor positions can be
 * preserved when jumping between directories.
 *
 * @type {Map<string, readonly Selection[]>}
 */
let selectionsMemoryMap = new Map();

/**
 * Attempt to save the cursor position in the active explorer.
 */
function saveSelections() {
  let editor = window.activeTextEditor;

  if (isExplorer(editor)) {
    let key = getCurrentDir();
    selectionsMemoryMap.set(key, editor.selections);
  }
}

/**
 * Attempt to restore the cursor position in the active explorer.
 */
function restoreSelections() {
  let editor = window.activeTextEditor;

  if (isExplorer(editor)) {
    let key = getCurrentDir();
    let selections = selectionsMemoryMap.get(key);
    if (selections) editor.selections = selections;
  }
}

/**
 * Open a new vsnetrw document for a given directory.
 * @param {string} dirName
 */
async function openExplorer(dirName) {
  saveSelections();
  let uri = createUri(dirName);
  let doc = await workspace.openTextDocument(uri);
  await window.showTextDocument(doc, { preview: true });
  restoreSelections();
}

/**
 * Check whether a  file is a non-empty directory.
 * @param {string} file
 * @returns {Promise<boolean>}
 */
async function isNonEmptyDir(file) {
  let uri = Uri.file(file);
  let stat = await workspace.fs.stat(uri);
  if ((stat.type & FileType.Directory) === 0) return false;
  let files = await workspace.fs.readDirectory(uri);
  return files.length > 0;
}

/**
 * Checks whether a file exists.
 * @param {string} file
 * @returns {Promise<boolean>}
 */
async function doesFileExist(file) {
  try {
    let uri = Uri.file(file);
    await workspace.fs.stat(uri);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Returns the name of the file under the cursor in the current vsnetrw
 * document.
 * @returns {string}
 */
function getLineUnderCursor() {
  let editor = window.activeTextEditor;
  assert(editor, "No active editor");
  let line = editor.document.lineAt(editor.selection.active);
  return line.text;
}

/**
 * Opens a file in a vscode editor.
 * @param {string} fileName
 */
async function openFileInVscodeEditor(fileName) {
  let uri = Uri.file(fileName);
  saveSelections();
  await commands.executeCommand("vscode.open", uri);
}

/**
 * Prompts the user to rename the file that is currently under their cursor in
 * a vsnetrw document.
 *
 * If the name includes a path that does not exist, then it will be created.
 */
async function renameFileUnderCursor() {
  let file = getLineUnderCursor();
  let base = getCurrentDir();

  let newName = await window.showInputBox({
    title: "Rename",
    value: file,
    placeHolder: "Enter a new filename",
  });

  if (!newName) return;

  let currentPath = path.join(base, file);
  let newPath = path.join(base, newName);
  let willOverwrite = await doesFileExist(newPath);

  if (willOverwrite) {
    let selection = await window.showWarningMessage(`Overwrite existing file?`, "Cancel", "Overwrite");
    if (selection !== "Overwrite") return;
  }

  let currentUri = Uri.file(currentPath);
  let newUri = Uri.file(newPath);

  await workspace.fs.rename(currentUri, newUri, { overwrite: true });

  refresh();
}

/**
 * Attempt to delete the file that is under the cursor in a vsnetrw document.
 *
 * If the file is a non-empty directory, then the user will be prompted before
 * deletion.
 */
async function deleteFileUnderCursor() {
  let file = getLineUnderCursor();
  let base = getCurrentDir();
  let pathToFile = path.join(base, file);

  // Never allow the user to accidentally delete the parent dir
  if (file == "../") return;

  if (await isNonEmptyDir(pathToFile)) {
    let selection = await window.showWarningMessage("Delete non-empty directory?", "Cancel", "Delete");
    if (selection !== "Delete") return;
  }

  let uri = Uri.file(pathToFile);
  await workspace.fs.delete(uri, { recursive: true, useTrash: true });
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
  let uri = Uri.file(pathToFile);

  // Ignore if the file already exists
  if (await doesFileExist(pathToFile)) return;

  if (newFileName.endsWith("/")) {
    await workspace.fs.createDirectory(uri)
  } else {
    await workspace.fs.writeFile(uri, new Uint8Array());
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
  let uri = Uri.file(pathToDir);
  await workspace.fs.createDirectory(uri);
  refresh();
}

/**
 * @returns {string}
 */
function getInitialDir() {
  let editor = window.activeTextEditor;

  if (editor && !editor.document.isUntitled) {
    return path.dirname(editor.document.uri.fsPath);
  } else if (workspace.workspaceFolders) {
    let folder = workspace.workspaceFolders[0];
    return folder.uri.fsPath;
  } else {
    return homedir();
  }
}

/**
 * Opens a new explorer editor.
 */
async function openNewExplorer(dir = getInitialDir()) {
  await openExplorer(dir);
}

/**
 * Attempt to open the file that is currently under the cursor.
 *
 * If there is a file under the cursor, it will open in a vscode text
 * editor. If there is a directory under the cursor, then it will open in a
 * new vsnetrw document.
 */
async function openFileUnderCursor() {
  let relativePath = getLineUnderCursor();
  let basePath = getCurrentDir();
  let newPath = path.resolve(basePath, relativePath);
  let uri = Uri.file(newPath);
  let stat = await workspace.fs.stat(uri);

  if (stat.type & FileType.Directory) {
    await openExplorer(newPath);
  } else {
    await openFileInVscodeEditor(newPath);
  }
}

/**
 * Opens the parent directory in a vsnetrw document.
 */
async function openParentDirectory() {
  let editor = window.activeTextEditor;
  assert(editor, "No active editor");
  let pathName = editor.document.uri.query;
  let parentPath = path.dirname(pathName);
  openExplorer(parentPath);
}

/**
 * Opens the home directory in a vsnetrw document. If there's an active workspace folder
 * it will be used, otherwise the user's home directory is used.
 */
async function openHomeDirectory() {
  let folder = homedir();
  let editor = window.activeTextEditor;

  if (editor) {
    let workspaceFolder = (
      workspace.getWorkspaceFolder(editor.document.uri) ||
      workspace.workspaceFolders?.[0]
    );

    if (workspaceFolder) {
      folder = workspaceFolder.uri.fsPath;
    }
  }

  openExplorer(folder);
}

/**
 * Renders the text content for the current vsnetrw document.
 * @param {Uri} documentUri
 * @returns {Promise<string>}
 */
async function provideTextDocumentContent(documentUri) {
  let pathName = documentUri.query;
  let pathUri = Uri.file(pathName);
  let results = await workspace.fs.readDirectory(pathUri);

  results.sort(([aName, aType], [bName, bType]) => {
    return aType & FileType.Directory ?
      bType & FileType.Directory ? 0 : -1 :
      aName < bName ? -1 : 1;
  });

  let listings = results.map(([name, type]) => {
    return type & FileType.Directory ? `${name}/` : name;
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
    commands.registerCommand("vsnetrw.open", openNewExplorer),
    commands.registerCommand("vsnetrw.openAtCursor", openFileUnderCursor),
    commands.registerCommand("vsnetrw.openParent", openParentDirectory),
    commands.registerCommand("vsnetrw.openHome", openHomeDirectory),
    commands.registerCommand("vsnetrw.rename", renameFileUnderCursor),
    commands.registerCommand("vsnetrw.delete", deleteFileUnderCursor),
    commands.registerCommand("vsnetrw.create", createFile),
    commands.registerCommand("vsnetrw.createDir", createDir),
    commands.registerCommand("vsnetrw.refresh", refresh),
  );
}

module.exports = { activate };
