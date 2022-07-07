let assert = require("assert");
let path = require("path");
let { window, Uri, Range, extensions, ThemeColor } = require("vscode");

let gitExt = extensions.getExtension("vscode.git")?.exports;

/**
 * @type {import("./git").API}
 */
let git = gitExt.getAPI(1);

/**
 * @param {string} label
 * @param {string} [themeColorId]
 */
function createDecorationType(label, themeColorId) {
  return window.createTextEditorDecorationType({
    before: {
      contentText: `${label} `,
      color: themeColorId ? new ThemeColor(themeColorId) : undefined,
    },
  });
}

let modifiedDecorationType = createDecorationType("M", "gitDecoration.modifiedResourceForeground");
let addedDecorationType = createDecorationType("A", "gitDecoration.addedResourceForeground");
let deletedDecorationType = createDecorationType("D", "gitDecoration.deletedResourceForeground");
let untrackedDecorationType = createDecorationType("U", "gitDecoration.untrackedResourceForeground");
let ignoredDecorationType = createDecorationType("I", "gitDecoration.ignoredResourceForeground");
let noStatusDecorationType = createDecorationType(" ");

// Corresponds to `Status` enum in ./git.d.ts
let decorationTypesByStatus = [
  modifiedDecorationType,  // 0 INDEX_MODIFIED
  addedDecorationType,     // 1 INDEX_ADDED
  deletedDecorationType,   // 2 INDEX_DELETED
  null,                    // 3 INDEX_RENAMED
  null,                    // 4 INDEX_COPIED

  modifiedDecorationType,  // 5 MODIFIED
  deletedDecorationType,   // 6 DELETED
  untrackedDecorationType, // 7 UNTRACKED
  ignoredDecorationType,   // 8 IGNORED
  addedDecorationType,     // INTENT_TO_ADD
];

function updateDecorations() {
  if (!git) return;
  assert(window.activeTextEditor);

  let repo = git.repositories[0];
  let changes = repo ? [
    ...repo.state.indexChanges,
    ...repo.state.workingTreeChanges,
  ] : [];

  let document = window.activeTextEditor.document;
  let base = document.uri.path;
  let lines = document.getText().split("\n");

  /**
   * @type {Record<number, number[]>}
   */
  let linesByStatus = {};

  for (let line = 0; line < lines.length; line++) {
    let pathToFile = path.join(base, lines[line]);
    let uri = Uri.file(pathToFile);
    let change = changes.find(change => change.uri.toString() === uri.toString());
    let status = change ? change.status : -1;
    linesByStatus[status] = linesByStatus[status] || [];
    linesByStatus[status].push(line);
  }

  for (let key of Object.keys(linesByStatus)) {
    let status = parseInt(key);

    let decorationType = status > 0
      ? decorationTypesByStatus[status]
      : noStatusDecorationType;

    let ranges = linesByStatus[status].map(line => {
      return new Range(line, 0, line, lines[line].length);
    });

    if (decorationType) {
      window.activeTextEditor.setDecorations(decorationType, ranges);
    }
  }
}

module.exports = { updateDecorations };
