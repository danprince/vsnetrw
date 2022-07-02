# vsnetrw
A split file explorer for vscode, inspired by [netrw][netrw], [vim-vinegar][vinegar], [dired][dired], and [vim-dirvish][dirvish].

## Shortcuts
Press <kbd>-</kbd> to open a file explorer at the parent directory of the currently active text editor. Once open the following shortcuts are available.

| Default Shortcut | Command | Description |
| ---------------- | ------- | ----------- |
| <kbd>enter</kbd> | `vsnetrw.open` | Open the file or directory under the cursor |
| <kbd>-</kbd> | `vsnetrw.openParent` | Jump to the parent directory |
| <kbd>R</kbd> | `vsnetrw.rename` | Rename the file or directory under the cursor |
| <kbd>%</kbd> | `vsnetrw.create` | Create a new file or directory. If the name ends with a `/` a directory will be created. Also creates the intermediate path if it doesn't already exist. |
| <kbd>d</kbd> | `vsnetrw.createDir` | Create a new directory. Also creates the intermediate path if it doesn't already exist. |
| <kbd>D</kbd> | `vsnetrw.delete` | Delete the file or directory under the cursor. Shows a confirmation before deleting a non-empty directory. |
| <kbd>ctrl+l</kbd> | `vsnetrw.refresh` | Refresh the directory listing. |

[netrw]: https://www.vim.org/scripts/script.php?script_id=1075
[vinegar]: https://github.com/tpope/vim-vinegar
[dired]: https://www.emacswiki.org/emacs/DiredMode
[dirvish]: https://github.com/justinmk/vim-dirvish
[oil-and-vinegar]: http://vimcasts.org/blog/2013/01/oil-and-vinegar-split-windows-and-project-drawer/