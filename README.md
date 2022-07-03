# vsnetrw
A [split file explorer][oil-and-vinegar] for vscode, inspired by [netrw][netrw], [vim-vinegar][vinegar], [dired][dired], and [vim-dirvish][dirvish].

<img width="782" height="594" src="https://user-images.githubusercontent.com/1266011/177040651-16aa09d1-ac0e-433c-9c25-3699bd5cd7d2.gif" />

## Shortcuts
Press <kbd>-</kbd> (`vsnetrw.open`) to open a file explorer at the parent directory of the currently active text editor. Once open the following shortcuts are available.

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

[netrw]: https://www.vim.org/scripts/script.php?script_id=1075
[vinegar]: https://github.com/tpope/vim-vinegar
[dired]: https://www.emacswiki.org/emacs/DiredMode
[dirvish]: https://github.com/justinmk/vim-dirvish
[oil-and-vinegar]: http://vimcasts.org/blog/2013/01/oil-and-vinegar-split-windows-and-project-drawer/
