# vscode-pairprog README

This is the README for your extension "vscode-pairprog". After writing up a brief description, we recommend including the following sections.

LATEST UPDATE: There are a couple of issues which prevent the completion of a first prototype.

- There is no Cursors API in VSCode, so there is no visual feedback on the position
of remote collaborators' cursors.
- ShareDB works with [json0 OT Type](https://github.com/ottypes/json0) which supports
insert and delete operations *on a string*. VSCode API provides the inserted text
for the insert operation but not the deleted one for the delete operation. I've opened
a couple of issues in github for these 2 issues and I'm waiting on their feedback.
- [Cursors API issue](https://github.com/Microsoft/vscode/issues/36136)
- [Deleted text API](https://github.com/Microsoft/vscode/issues/36361)

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: enable/disable this extension
* `myExtension.thing`: set to `blah` to do something

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of ...

-----------------------------------------------------------------------------------------------------------

## Working with Markdown

**Note:** You can author your README using Visual Studio Code.  Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on OSX or `Ctrl+\` on Windows and Linux)
* Toggle preview (`Shift+CMD+V` on OSX or `Shift+Ctrl+V` on Windows and Linux)
* Press `Ctrl+Space` (Windows, Linux) or `Cmd+Space` (OSX) to see a list of Markdown snippets

### For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**