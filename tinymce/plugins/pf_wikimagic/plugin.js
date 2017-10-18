/**
 * plugin.js
 *
 * "Wikimagic" Allows entry of wiki code for templates, parser functions and magic words.  It parses 
 * the code using mediawiki and displays the results as a non-editable block, similar to how it would 
 * display on the wikipage. Magic words bracketed by double underscores have a place holder (a scillicet
 * a.k.a. double S or section symbol) displayed so that they can be selected and edited in the editor
 *
 * @author     Duncan Crane <Duncan.Crae@aoxomoxoa.co.uk>
 * Released under LGPL License.
 * Copyright (c) 2017 onwards Aoxomoxoa Limited. All rights reserved
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 */

/*global tinymce:true */
/*global mw:true */

tinymce.PluginManager.add('wikimagic', function(editor) {
	var showDialog = function () {
		var selectedNode = editor.selection.getNode();
		var isWikimagic = '';
		if (typeof(selectedNode.attributes["data-bs-type"]) !== "undefined" ) {
			isWikimagic = selectedNode.attributes["data-bs-type"].value == "template" || selectedNode.attributes["data-bs-type"].value == "switch";
		}

		var value = '';
		if (isWikimagic) {
			value = selectedNode.attributes["data-bs-wikitext"].value;
			value = decodeURIComponent(value);
		} else {
			value = editor.selection.getContent({format : 'text'});
		}

		editor.windowManager.open({
			title: mw.msg('tinymce-wikimagic-title'),
			body: {type: 'textbox', name: 'code', size: 40, label: 'Code value', value: value},
			onsubmit: function(e) {
				var text = e.data.code;
				var el;
				var switches = new Array;
				var switchWikiText;
				var swt;
				//DC processes switches in returned code first
				mtext = text;
				regex = "__(.*?)__";
				matcher = new RegExp(regex, 'gmi');
				i = 0;
				swt = '';
				while ((swt = matcher.exec(mtext)) !== null) {
					switches[swt[1]] = swt[0];
				}
				for (var aSwitch in switches) {
					switchWikiText= switches[aSwitch];
					t = Math.floor((Math.random() * 100000) + 100000) + i;
					id = "bs_switch:@@@SWT"+ t + "@@@";
					var codeAttrs = {
						'id': id,
						'class': "mceNonEditable wikimagic switch",
						'title': switchWikiText,
						'data-bs-type': "switch",
						'data-bs-id': t,
						'data-bs-name': aSwitch, 
						'data-bs-wikitext': switchWikiText,
						'contenteditable': "false"
					};
					htmlText = editor.dom.createHTML('span', codeAttrs, '&sect;');
					el = editor.dom.create('span', codeAttrs, '&sect;');
					var searchText = new RegExp(switchWikiText, 'g');
					var replaceText = el.outerHTML;
					text = text.replace(
						searchText,
						replaceText 
					);
					i++;
				}
				//DC now process templates and parser functions
				var templates = new Array();
				var checkedBraces = new Array();
				var templateDepth = 0;
				var curlyBraceDepth = 0;
				var squareBraceDepth = 0;
				var squareBraceFirst = false;
				var tempTemplate = '';
				for (pos = 0; pos < text.length; pos++) {
					if (text[pos] === '{') {
						curlyBraceDepth++;
						if ( checkedBraces.indexOf(pos) == -1 && text[pos + 1] === '{') {
							checkedBraces.push(pos + 1);
							templateDepth++;
						}
					}
					if (text[pos] === '[') {
						if (curlyBraceDepth === 0) {
							squareBraceFirst = true;
						}
						squareBraceDepth++;
					}
					// Caution: this matches only from the second curly brace.
					if (templateDepth && !squareBraceFirst) {
						tempTemplate = tempTemplate + text[pos];
					}
					if (text[pos] === '}') {
						curlyBraceDepth--;
						if ( checkedBraces.indexOf(pos-1) == -1 && text[pos - 1] === '}') {
							checkedBraces.push(pos);
							templateDepth--;
						}
						if (templateDepth === 0 && !squareBraceFirst) {
							if (tempTemplate !== '')
								templates[tempTemplate]=tempTemplate;
							tempTemplate = '';
						}
					}
					if (text[pos] === ']') {
						squareBraceDepth--;
						if (squareBraceDepth === 0) {
							squareBraceFirst = false;
						}
					}
				}
				if (Object.keys(templates).length > 0) {
					for (var aTemplate in templates) {
						templateText = templates[aTemplate];
						templateName = templateText;
						templateName = templateName.replace(/[\{\}]/gmi, "");

						templateNameLines = templateName.split(/\n/i);
						templateName = templateNameLines[0].trim();
		
						// remove everything after the magic word name
						if ( templateName.indexOf( "#" ) === 0 ) {
							templateName = templateName.slice( 0, templateName.indexOf( ":" ));
						}
						// remove any parameters from name. Reason: they might contain parsable code
						if ( templateName.indexOf( "|" ) > 0 ) {
							templateName = templateName.slice( 0, templateName.indexOf( "|" ));
						}
						/*DC now go and get parsed html for this template to insert into the edit window 	
						as not editable html (TODO addexclusions)*/
						var server = mw.config.get( "wgServer" ) ;
						var script = mw.config.get( 'wgScriptPath' ) + '/api.php';
						var title = mw.config.get( "wgCanonicalNamespace" ) + ':' + mw.config.get( "wgTitle" ) ;
						var data = {'action': 'parse',
							'title': title,
							'text': templateText,
							'prop': 'text|wikitext',
							'disablelimitreport': '',
							'disableeditsection': '',
							'disabletoc': '',
							'format': 'json',};
						$.ajax({
  							dataType: "json",
  							url: script,
 	 						data: data,
  							async: false, 
  							success: function(data) {
								var templateHTML = data.parse.text["*"];
								// DC remove leading and trailing <p>
								templateHTML = $.trim(templateHTML);
								templateHTML = templateHTML.replace(/<\/?p[^>]*>/g, "");

								templateHTML = $.trim(templateHTML);
								templateHTML = templateHTML.replace(/\&amp\;/gmi,'&');
								// DC remove href tags in returned htm as links will screw up conversions
								templateHTML = templateHTML.replace(/\shref="([^"]*)"/gmi,'');
								templateHTML = templateHTML.replace(/(\r\n|\n|\r)/gm,"");

								var templateWikiText = data.parse.wikitext["*"];
								templateWikiText = $.trim(templateWikiText);
								if (templateWikiText.substring(0, 3) == '<p>') {
									templateWikiText = templateWikiText.substring(3, templateWikiText.length);
								}
								if (templateWikiText.substring(templateWikiText.length-4,templateWikiText.length) == '</p>') {
									templateWikiText = templateWikiText.substring(0, templateWikiText.length-4);
								}
								templateWikiText = $.trim(templateWikiText);
								var displayTemplateWikiText = encodeURIComponent(templateWikiText);

								t = Math.floor((Math.random() * 100000) + 100000) + i;
								id = "bs_template:@@@TPL"+ t + "@@@";
								var codeAttrs = {
									'id': id,
									'class': "mceNonEditable wikimagic template",
									'title': "{{" + templateName + "}}",
									'data-bs-type': "template",
									'data-bs-id': t,
									'data-bs-name': templateName, 
									'data-bs-wikitext': displayTemplateWikiText,
									'contenteditable': "false"
								};

								var el = editor.dom.create('span', codeAttrs, templateHTML);
								templateWikiText = templateWikiText.replace(/[^A-Za-z0-9_]/g, '\\$&');
								var searchText = new RegExp(templateWikiText, 'g');
								var replaceText = el.outerHTML;
								text = text.replace(
									searchText,
									replaceText
								);
							}
						});
					}
				}
				editor.undoManager.transact(function(){
					editor.focus();
					editor.selection.setContent(text);
					editor.undoManager.add();
				});
			}
		});
	};

	editor.addCommand('mceWikimagic', showDialog);

	editor.addButton('wikimagic', {
		icon: 'codesample',
		stateSelector: '.wikimagic',
		tooltip: mw.msg( 'tinymce-wikimagic' ),
		onclick: showDialog/*,
		stateSelector: 'a:not([href])'*/
	});

	editor.addMenuItem('wikimagic', {
		icon: 'codesample',
		text: 'Wikimagic',
		tooltip: mw.msg( 'tinymce-wikimagic' ),
		context: 'insert',
		onclick: showDialog
	});

	// Add option to double-click on non-editable sections to get
	// "wikimagic" popup.
        editor.on('dblclick', function(e) {
            if (e.target.className == 'mceNonEditableOverlay' ) {
                tinyMCE.activeEditor.execCommand('mceWikimagic');
            }
        });

});
