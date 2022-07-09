let assert = require("node:assert");
let path = require("node:path");
let { homedir } = require("node:os");
let { window, workspace, commands, Uri, EventEmitter, FileType, Selection, languages, Range, Diagnostic, DiagnosticRelatedInformation, Location } = require("vscode");

/**
 * The scheme is used to associate vsnetrw documents with the text content provider
 * that renders the directory listing.
 */
const scheme = "vsnetrw";

/**
 * The editorLanguageId used to identify vsnetrw buffers.
 */
const languageId = "vsnetrw";

/**
 * The path to the file that was open before the current explorer.
 */
let previousFilePath = "";

/**
 * Creates a vsnetrw document uri for a given path.
 *
 * @param {string} dirName The directory to open
 * @returns {Uri} The path as a Uri
 */
function createUri(dirName) {
  return Uri.from({ scheme, path: dirName });
}

/**
 * Get the current directory from the current document's Uri.
 * @returns The path to the directory that is open in the current vsnetrw document.
 */
function getCurrentDir() {
  let editor = window.activeTextEditor;
  assert(editor && editor.document.uri.scheme === scheme, "Not a vsnetrw editor");
  return editor.document.uri.path;
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
 * @param {string} prompt
 * @returns {Promise<boolean>}
 */
function confirm(prompt) {
  return new Promise(resolve => {
    let inputBox = window.createInputBox();
    let resolveOnHide = true;
    inputBox.validationMessage = `${prompt} (y or n)`;

    let onChange = inputBox.onDidChangeValue(text => {
      let ch = text[0].toLowerCase();
      if (ch === "y") {
        resolve(true);
        resolveOnHide = false;
        inputBox.hide();
      } else if (ch === "n" || "q") {
        inputBox.hide();
      }
    });

    let onHide = inputBox.onDidHide(() => {
      inputBox.dispose();
      onChange.dispose();
      onHide.dispose();
      if (resolveOnHide) {
        resolve(false);
      }
    });

    inputBox.show();
  });
}

function moveCursorToPreviousFile() {
  let editor = window.activeTextEditor;
  if (!editor) return;
  let dir = getCurrentDir();
  let files = editor.document.getText().split("\n");

  let index = files.findIndex(file => (
    path.join(dir, file) === previousFilePath ||
    path.join(dir, file) === `${previousFilePath}/`
  ));

  if (index >= 0) {
    editor.selections = [new Selection(index, 0, index, 0)];
  }
}

/**
 * Open a new vsnetrw document for a given directory.
 * @param {string} dirName
 */
async function openExplorer(dirName) {
  let editor = window.activeTextEditor;

  if (editor) {
    previousFilePath = editor.document.uri.fsPath;
  }

  let uri = createUri(dirName);
  let doc = await workspace.openTextDocument(uri);
  await window.showTextDocument(doc, { preview: true });
  await languages.setTextDocumentLanguage(doc, languageId);
  moveCursorToPreviousFile();
  refreshDiagnostics();
  refresh();
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
    let ok = await confirm("Overwrite existing file?");
    if (!ok) return;
  }

  let currentUri = Uri.file(currentPath);
  let newUri = Uri.file(newPath);

  await workspace.fs.rename(currentUri, newUri, { overwrite: true });

  refresh();
}

/**
 * Attempt to delete the file that is under the cursor in a vsnetrw document.
 */
async function deleteFileUnderCursor() {
  let file = getLineUnderCursor();
  let base = getCurrentDir();
  let pathToFile = path.join(base, file);

  // Never allow the user to accidentally delete the parent dir
  if (file == "../") return;

  let ok = await confirm(`Confirm deletion of ${file}`);
  if (!ok) return;

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
    refresh();
  } else {
    await workspace.fs.writeFile(uri, new Uint8Array());
    await openFileInVscodeEditor(uri.fsPath);
  }
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
  // For some reason vim.normalModeKeyBindings pass an empty array
  if (Array.isArray(dir)) dir = getInitialDir();
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
  let pathName = editor.document.uri.path;
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
  let pathName = documentUri.path;
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

let diagnostics = languages.createDiagnosticCollection("vsnetrw");

/**
 * Propagate diagnostics in files up to the explorer.
 */
function refreshDiagnostics() {
  assert(window.activeTextEditor);

  let document = window.activeTextEditor.document;
  let base = getCurrentDir();

  let uris = document.getText().split("\n").map(name => {
    let pathToFile = path.join(base, name);
    return Uri.file(pathToFile);
  })

  let ownDiagnostics = uris.flatMap((uri, line) => {
    let childDiagnostics = languages.getDiagnostics(uri);
    if (childDiagnostics.length === 0) return [];

    let severities = childDiagnostics.map(diagnostic => diagnostic.severity);
    let severity = Math.min(...severities);
    let name = path.basename(uri.fsPath);
    let range = new Range(line, 0, line, name.length);

    let diagnostic = new Diagnostic(
      range, `${childDiagnostics.length} problems in this file`,
      severity
    );

    diagnostic.relatedInformation = childDiagnostics.map(childDiagnostic => {
      return new DiagnosticRelatedInformation(
        new Location(uri, childDiagnostic.range),
        childDiagnostic.message
      );
    });

    return diagnostic;
  });

  diagnostics.set(document.uri, ownDiagnostics);
}

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
