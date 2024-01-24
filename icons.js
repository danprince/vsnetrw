const { workspace } = require("vscode");

/**
 * Mapping of file extension to icon
 * @type {Object.<string, string>}
 */
const icons = {
    // docs
    'txt': '',
    'doc': '',
    'docx': '',
    'pdf': '',
    'xls': '',
    'xlsx': '',
    'ppt': '',
    'pptx': '',
    // images
    'jpg': '',
    'png': '',
    'gif': '',
    'svg': '󰜡',
    // programming
    'json': '',
    'md': '',
    'vscodeignore': '󰨞',
    'gitignore': '',
    'java': '',
    'py': '',
    'cpp': '󰌛',
    'c': '󰙱',
    'cs': '󰌛',
    'php': '󰌟',
    'html': '󰌝',
    'css': '',
    'rb': '',
    'go': '󰟓',
    'swift': '',
    'rust': '',
    'ts': '',
    'js': '',
    'jsx': '',
    'tsx': '',
    'sh': '',
    'sql': '',
    'lua': '󰢱',
    'r': '󰟔',
    'scala': '',
    'kotlin': '',
    'asm': '',
    'dockerignore': '',
    'yml': '',
    'xml': '󰗀',
    'ini': '',
    'vue': '',
    'coffee': '',
    'groovy': '',
    'gradle': '',
    'dart': '',
    'ejs': '',
    'less': '',
    'sass': '',
    'scss': '',
    'styl': '',
    'zsh': '',
    'bash': '',
    'cmd': '',
    'xaml': '',
    'csproj': '',
    'sln': '',
    'vb': '',
    'conf': '',
    'toml': ''
};

/**
 * Mapping of special files to icon
 * @type {Object.<string, string>}
 */
const specialFilesIcons = {
    'package.json': '',
    'dockerfile': '',
}

/**
 * Get icon for filename with extension
 * @param {string} filename
 */
function getIconFile(filename) {
    const extension = filename?.split('.')?.pop()?.toLowerCase();

    if (extension && icons[extension]) {
        return icons[extension];
    }

    return ''
}

function getIconDirectory() {
    return ''
}


/**
 * @param {string} filename 
 * @param {boolean} isDirectory
 * @returns 
 */
function renderListing(filename, isDirectory = false) {
    if (iconsEnabled()) {
        if (isDirectory) {
            return `${getIconDirectory()} ${filename}/`
        }

        if (filename in specialFilesIcons) {
            return `${specialFilesIcons[filename]} ${filename}`
        }

        return `${getIconFile(filename)} ${filename}`
    }

    return isDirectory ? `${filename}/` : filename
}

function iconsEnabled() {
    return workspace.getConfiguration("vsnetrw").useNerdFontIcons
}

module.exports = {
    renderListing, iconsEnabled
}