/**
 * plugin.js
 *
 * Released under LGPL License.
 * Copyright (c) 1999-2015 Ephox Corp. All rights reserved
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 */

/*global tinymce:true */

tinymce.PluginManager.add('wikisourcecode', function(editor) {
	function showDialog() {
debugger;
		var win = editor.windowManager.open({
			title: "Source code",
			body: {
				type: 'textbox',
				name: 'code',
				multiline: true,
				minWidth: editor.getParam("code_dialog_width", 600),
				minHeight: editor.getParam("code_dialog_height", Math.min(tinymce.DOM.getViewPort().h - 200, 500)),
				spellcheck: false,
				style: 'direction: ltr; text-align: left'
			},
			onSubmit: function(e) {
				// We get a lovely "Wrong document" error in IE 11 if we
				// don't move the focus to the editor before creating an undo
				// transation since it tries to make a bookmark for the current selection
				editor.focus();
				editor.undoManager.transact(function() {
					e.load = true;
					editor.setContent(e.data.code,e);
				});

				editor.selection.setCursorLocation();
				editor.nodeChanged();
			}
		});

		// Gecko has a major performance issue with textarea
		// contents so we need to set it when all reflows are done
/* DC changed this to avoid serializer extracting HTML from template spans
		win.find('#code').value(editor.getContent({source_view: true}));
*/
		win.find('#code').value(editor.getContent({source_view: true, format: 'raw'}));
	}

	editor.addCommand("mceCodeEditor", showDialog);

	editor.addButton('wikisourcecode', {
		icon: 'code',
		tooltip: 'View and edit wiki source code',
		onclick: showDialog
	});

	editor.addMenuItem('wikisourcecode', {
		icon: 'code',
		text: 'Wiki source code',
		context: 'tools',
		onclick: showDialog
	});
});