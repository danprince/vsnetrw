# vsnetrw
A [split file explorer][oil-and-vinegar] for vscode, inspired by [netrw][netrw], [vim-vinegar][vinegar], [dired][dired], and [vim-dirvish][dirvish].

<p align="center">
<img width="800" src="https://user-images.githubusercontent.com/1266011/178103105-1cc41f9e-2b19-4d2c-8e64-7f9c688575e6.png" alt="vsnetrw in action" />
</p>

## Shortcuts
Use `vsnetrw.open` to open a file explorer at the parent directory of the currently active text editor. Once open the following shortcuts are available.

| Default Shortcut | Command | Description |
| ---------------- | ------- | ----------- |
| <kbd>enter</kbd> | `vsnetrw.openAtCursor` | Open the file or directory under the cursor |
| <kbd>-</kbd> | `vsnetrw.openParent` | Jump to the parent directory |
| <kbd>~</kbd> | `vsnetrw.openHome` | Jump to the root of the current workspace folder, or user's homedir. |
| <kbd>R</kbd> | `vsnetrw.rename` | Rename the file or directory under the cursor |
| <kbd>%</kbd> | `vsnetrw.create` | Create a new file or directory (and any intermediate directories). |
| <kbd>d</kbd> | `vsnetrw.createDir` | Create a new directory (and any intermediate ones). |
| <kbd>D</kbd> | `vsnetrw.delete` | Delete the file or directory under the cursor. |
| <kbd>ctrl+l</kbd> | `vsnetrw.refresh` | Refresh the directory listing. |
| <kbd>esc</kbd> | `vsnetrw.close` | Close the active explorer. |

## VSCodeVim Keybindings
To make `-` open an explorer from any file (like `vim-vinegar`) add the following binding to your `vim.normalModeKeyBindings`.

```json
{
  "before": ["-"],
  "commands": ["vsnetrw.open"],
  "when": "editorLangId != vsnetrw"
}
```

This binding can't be provided as part of the extension because native VSCode's keybindings will accidentally trigger in undesirable instances (e.g. pressing `r-` in normal mode).

## Installation
vsnetrw can be installed from the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=danprince.vsnetrw).

You can also download a VSIX from [releases](https://github.com/danprince/vsnetrw/releases) and install it by running `>Extensions: Install from VSIX`.

[netrw]: https://www.vim.org/scripts/script.php?script_id=1075
[vinegar]: https://github.com/tpope/vim-vinegar
[dired]: https://www.emacswiki.org/emacs/DiredMode
[dirvish]: https://github.com/justinmk/vim-dirvish
[oil-and-vinegar]: http://vimcasts.org/blog/2013/01/oil-and-vinegar-split-windows-and-project-drawer/
