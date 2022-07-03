let fs = require("node:fs/promises");
let os = require("node:os");
let path = require("node:path");
let assert = require("node:assert");
let vscode = require("vscode");
let { describe, test, afterEach } = require("mocha");

let {
  fileExists,
  createTempWorkspace,
  moveToLine,
  getActiveEditorText,
  cleanTempWorkspaces,
  resetWindowMocks,
  mockInputBox,
  mockWarningMessage,
  assertLinesMatch,
  execCommand,
} = require("./testUtils");

/**
 * @param {string} dir
 */
async function openExplorer(dir = process.cwd()) {
  await vscode.commands.executeCommand("vsnetrw.open", dir);
}

before(() => cleanTempWorkspaces());
afterEach(() => resetWindowMocks());

describe("rendering", () => {
  test("renders correctly", async () => {
    await createTempWorkspace([
      ".git/",
      ".env",
      "a.txt",
      "b.txt",
      "c.txt",
      "d/d1.txt",
      "e/"
    ]);
    await openExplorer();
    assertLinesMatch([
      "../",
      ".git/",
      "d/",
      "e/",
      ".env",
      "a.txt",
      "b.txt",
      "c.txt",
    ]);
  });
});

describe("navigation", () => {
  test("explorer opens at the current directory", async () => {
    let dir = await createTempWorkspace(["a/b.txt"]);
    let file = path.join(dir, "a/b.txt");
    let uri = vscode.Uri.file(file);
    await execCommand("vscode.open", uri);
    await execCommand("vsnetrw.open");
    assertLinesMatch(["../", "b.txt"]);
  });

  test("opening a directory from an explorer", async () => {
    await createTempWorkspace(["a.txt", "d/d1.txt"]);
    await openExplorer();
    await moveToLine("d/");
    await execCommand("vsnetrw.openAtCursor");
    assertLinesMatch(["../", "d1.txt"]);
  });

  test("opening a file from an explorer", async () => {
    let dir = await createTempWorkspace(["a.txt"]);
    await openExplorer();
    await moveToLine("a.txt");
    await execCommand("vsnetrw.openAtCursor");
    assert(vscode.window.activeTextEditor);
    assert.equal(
      vscode.window.activeTextEditor.document.fileName,
      path.join(dir, "a.txt"),
    );
  });

  test("opening the parent dir", async () => {
    let dir = await createTempWorkspace(["a.txt", "b/b.txt"]);
    await openExplorer(path.join(dir, "b"));
    assertLinesMatch(["../", "b.txt"]);
    await execCommand("vsnetrw.openParent");
    assertLinesMatch(["../", "b/", "a.txt"]);
  });

  test("opening the home dir", async () => {
    await createTempWorkspace(["a.txt", "b/b.txt"]);
    await openExplorer();
    await execCommand("vsnetrw.openHome");
    let editor = vscode.window.activeTextEditor;
    assert(editor);
    assert(editor.document.uri.query, os.homedir());
  });

  test("no parent dir at the filesystem root", async () => {
    await openExplorer("/");
    let text = getActiveEditorText();
    assert.doesNotMatch(text, /\.\.\//);
  });
});

describe("refresh", () => {
  test("refreshing the explorer", async () => {
    await createTempWorkspace([]);
    await openExplorer();
    await fs.writeFile("b.txt", "");
    await execCommand("vsnetrw.refresh");
    assertLinesMatch(["../", "b.txt"]);
  });
});

describe("deleting", () => {
  test("deleting a file", async () => {
    await createTempWorkspace(["a.txt"]);
    await openExplorer();
    await moveToLine("a.txt");
    await execCommand("vsnetrw.delete");
    assertLinesMatch(["../"]);
    let exists = await fileExists("a.txt");
    assert(!exists);
  });

  test("deleting an empty directory", async () => {
    await createTempWorkspace(["b/"]);
    await openExplorer();
    await moveToLine("b/");
    await execCommand("vsnetrw.delete");
    let text = getActiveEditorText();
    assert.equal(text, "../");
    let exists = await fileExists("b");
    assert(!exists);
  });

  test("cancel deleting a non-empty directory", async () => {
    let dir = await createTempWorkspace(["b/b.txt"]);
    await openExplorer(dir);
    await moveToLine("b/");
    mockWarningMessage("Cancel");
    await execCommand("vsnetrw.delete");
    let text = getActiveEditorText();
    assert.equal(text, ["../", "b/"].join("\n"));
    let file = path.join(dir, "b");
    let exists = await fileExists(file);
    assert(exists);
  });

  test("delete a non-empty directory", async () => {
    await createTempWorkspace(["b/b.txt"]);
    await openExplorer();
    await moveToLine("b/");
    mockWarningMessage("Delete");
    await execCommand("vsnetrw.delete");
    assertLinesMatch(["../"]);
    assert(!await fileExists("b"));
  });
});

describe("renaming", () => {
  test("renaming a file", async () => {
    await createTempWorkspace(["a.txt"]);
    await openExplorer();
    await moveToLine("a.txt");
    mockInputBox("b.txt");
    await execCommand("vsnetrw.rename");
    assertLinesMatch(["../", "b.txt"]);
    assert(!await fileExists("a.txt"));
    assert(await fileExists("b.txt"));
  });

  test("renaming a file into a new directory", async () => {
    await createTempWorkspace(["a.txt"]);
    await openExplorer();
    await moveToLine("a.txt");
    mockInputBox("b/c.txt");
    await execCommand("vsnetrw.rename");
    assertLinesMatch(["../", "b/"]);
    assert(!await fileExists("a.txt"));
    assert(await fileExists("b/c.txt"));
  });

  test("cancel renaming a file", async () => {
    await createTempWorkspace(["a.txt"]);
    await openExplorer();
    await moveToLine("a.txt");
    mockInputBox(undefined);
    await execCommand("vsnetrw.rename");
    assertLinesMatch(["../", "a.txt"]);
    assert(await fileExists("a.txt"));
  });

  test("renaming a directory", async () => {
    await createTempWorkspace(["a/b.txt"]);
    await openExplorer();
    await moveToLine("a/");
    mockInputBox("b");
    await execCommand("vsnetrw.rename");
    assertLinesMatch(["../", "b/"]);
    assert(!await fileExists("a"));
    assert(await fileExists("b"));
  });

  test("renaming a file and confirm overwrite", async () => {
    await createTempWorkspace(["a.txt", "b.txt"]);
    await openExplorer();
    await moveToLine("a.txt");
    mockInputBox("b.txt");
    mockWarningMessage("Overwrite");
    await execCommand("vsnetrw.rename");
    assertLinesMatch(["../", "b.txt"]);
    let contents = await fs.readFile("b.txt");
    assert.equal(contents, "a.txt");
    assert(!await fileExists("a.txt"));
    assert(await  fileExists("b.txt"));
  });

  test("renaming a file and cancel overwriting", async () => {
    await createTempWorkspace(["a.txt", "b.txt"]);
    await openExplorer();
    await moveToLine("a.txt");
    mockInputBox("b.txt");
    mockWarningMessage("Cancel");
    await execCommand("vsnetrw.rename");
    assertLinesMatch(["../", "a.txt", "b.txt"]);
    assert(await fileExists("a.txt"));
    assert(await fileExists("b.txt"));
  });
});

describe("creating", () => {
  test("creating a file", async () => {
    await createTempWorkspace(["a.txt"]);
    await openExplorer();
    mockInputBox("b.txt");
    await execCommand("vsnetrw.create");
    assertLinesMatch(["../", "a.txt", "b.txt"]);
  });

  test("creating a directory", async () => {
    await createTempWorkspace([]);
    await openExplorer();
    mockInputBox("a");
    await execCommand("vsnetrw.createDir");
    assertLinesMatch(["../", "a/"]);
  });

  test("creating a directory with trailing slash", async () => {
    await createTempWorkspace([]);
    await openExplorer();
    mockInputBox("a/");
    await execCommand("vsnetrw.create");
    assertLinesMatch(["../", "a/"]);
  });

  test("creating intermediate directories", async () => {
    await createTempWorkspace([]);
    await openExplorer();
    mockInputBox("a/b/c");
    await execCommand("vsnetrw.create");
    assertLinesMatch(["../", "a/"]);
    let stat = await fs.stat("a/b/c");
    assert(stat.isFile());
  });
});
