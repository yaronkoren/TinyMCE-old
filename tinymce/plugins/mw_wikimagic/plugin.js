/**
 * plugin.js
 *
 * "Wikimagic" Allows entry of wiki code for templates, parser functions and magic words.  It parses 
 * the code using mediawiki and displays the results as a non-editable block, similar to how it would 
 * display on the wikipage. Magic words bracketed by double underscores have a place holder (a scillicet
 * a.k.a. double S or section symbol) displayed so that they can be selected and edited in the editor
 *
 * @author     Duncan Crane <Duncan.Crane@aoxomoxoa.co.uk>
 * Released under LGPL License.
 * Copyright (c) 2017 onwards Aoxomoxoa Limited. All rights reserved
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 */

/*global tinymce:true */
/*global mw:true */

tinymce.PluginManager.add('wikimagic', function(editor) {
	var _tags;
	var _comments;
	var showDialog = function () {
		var selectedNode = editor.selection.getNode();
		var nodeType = '';
		var isWikimagic = '';
		var value = '';
		if (typeof(selectedNode.attributes["data-bs-type"]) !== "undefined" ) {
			nodeType = selectedNode.attributes["data-bs-type"].value;
			isWikimagic = 
				nodeType == "template" || 
				nodeType == "switch" || 
				nodeType == "tag" ||
				nodeType == "comment" ;	
		}

		if (isWikimagic) {
			value = selectedNode.attributes["data-bs-wikitext"].value;
			value = decodeURIComponent(value);
		} else {
			value = editor.selection.getContent({format : 'text'});
		}
		editor.windowManager.open({
			title: mw.msg('tinymce-wikimagic-title'),
			body: {
				type: 'textbox', 
				name: 'code', 
				size: 40, 
				label: 'Code value', 
				multiline: true,
				minWidth: editor.getParam("code_dialog_width", 600),
				minHeight: editor.getParam("code_dialog_height", 
				Math.min(tinymce.DOM.getViewPort().h - 200, 500)),
				spellcheck: false,
				style: 'direction: ltr; text-align: left',
				value: value},
			onsubmit: function(e) {
				var text = e.data.code;
				var el;
				var server = mw.config.get( "wgServer" ) ;
				var script = mw.config.get( 'wgScriptPath' ) + '/api.php';
				var title = mw.config.get( "wgCanonicalNamespace" ) + ':' + mw.config.get( "wgTitle" ) ;
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
								templateHTML += '<div class="mceNonEditableOverlay" />';
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
				//quirky. Needs to be there for the occasional second pass of cleanup
				var _specialtags = new Array();	
				_tags = new Array();			
				var specialTagsList;
				specialTagsList = editor.getParam("wiki_tags_list");
				specialTagsList += editor.getParam("additional_wiki_tags");
				// Tags without innerHTML need /> as end marker. Maybe this should be task of a preprocessor, 
				// in order to allow mw style tags without /.
				regex = '<(' + specialTagsList + ')[\\S\\s]*?((/>)|(>([\\S\\s]*?<\\/\\1>)))';
				matcher = new RegExp(regex, 'gmi');
				mtext = text;
				i = 0;
				st = '';
		
				var innerText = '';
				var retValue = false;
				var moreAttribs = '';

				while ((st = matcher.exec(mtext)) !== null) {
					/*DC now go and get parsed html for this special tag to insert into the edit window
						as not editable html (TODO addexclusions)*/
					tagName = st[1];
					var data = {'action': 'parse',
						'title': title,
						'text': st[0],
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
							var tagHTML = data.parse.text["*"];
							var tagWikiText = data.parse.wikitext["*"];
							tagWikiText = $.trim(tagWikiText);
							if (tagWikiText.substring(0, 3) == '<p>') {
								tagWikiText = tagWikiText.substring(3, tagWikiText.length);
							}
							if (tagWikiText.substring(tagWikiText.length-4,tagWikiText.length) == '</p>') {
								tagWikiText = tagWikiText.substring(0, tagWikiText.length-4);
							}
							tagWikiText = $.trim(tagWikiText);
							var displayTagWikiText = encodeURIComponent(tagWikiText);

							var t = Math.floor((Math.random() * 100000) + 100000) + i;
							var id = "bs_specialtag:@@@ST"+ t + "@@@";
							var codeAttrs = {
								'id': id,
								'class': "mceNonEditable wikimagic tag",
								'title': "<" + tagName + ">",
								'data-bs-type': "tag",
								'data-bs-id': t,
								'data-bs-name': tagName,
								'data-bs-wikitext': displayTagWikiText,
								'contenteditable': "false"
							};
							tagHTML += '<div class="mceNonEditableOverlay" />';

							var el = editor.dom.create('span', codeAttrs, tagHTML);
							tagWikiText = tagWikiText.replace(/[^A-Za-z0-9_]/g, '\\$&');
							var searchText = new RegExp(tagWikiText, 'g');
							var tagText = el.outerHTML;
							var replaceText = '<@@@TAG' + i + '@@@>';
							_tags[i] = tagText;
							text = text.replace(
								searchText,
								replaceText
							);
							i++;
						}
					});
				}

				//Now process comments
				if (!_comments) {
					_comments = new Array();
				}
				var commentText = '';
				mtext = text;
				regex = "<!--([\\S\\s]+?)-->";
				matcher = new RegExp(regex, 'gmi');
				i = 0;
				cmt = '';
				while ((cmt = matcher.exec(mtext)) !== null) {
					var t = Math.floor((Math.random() * 100000) + 100000) + i;
					id = "bs_switch:@@@CMT"+ t + "@@@";
					var codeAttrs = {
						'id': id,
						'class': "mceNonEditable wikimagic comment",
						'title': cmt[1],
						'data-bs-type': "comment",
						'data-bs-id': t,
						'data-bs-name': commentText,
						'data-bs-wikitext': cmt[0],
						'contenteditable': "false"
					};

					htmlText = editor.dom.createHTML('span', codeAttrs, '&#8493' );
					el = editor.dom.create('span', codeAttrs, '&#8493' );
					var searchText = new RegExp(cmt[0], 'g');
					var commentText = el.outerHTML;
					var replaceText = '<@@@CMT' + i + '@@@>';
					_comments[i] = commentText ;
					text = text.replace(
						searchText,
						replaceText
					);
					i++;
				}

				text = _blockLevels2html(text);
				text = _recoverTags(text);
				text = _recoverComments(text);
				editor.undoManager.transact(function(){
					editor.focus();
					editor.selection.setContent(text, {format: 'raw'});
					editor.undoManager.add();
					editor.format = 'raw';
				});
			}
		});
	};

	function _blockLevels2html(text) {
		var
			lines = text.split("\n"),
			//lastlist is set to the wikicode for the list item excluding its text content
			//it is used to determine whether the list item is at a lower, same or higher level in the list
			lastList = '',
			//line is current line being processed.  It is '' unless the line is a list item
			line = '',
			inParagraph = false,
			emptyLine = false,
			lastLine = false;

                // Walk through text line by line
		for (var i = 0; i < lines.length; i++) {
			// Prevent REDIRECT from being rendered as list.
			// Var line is only set if it is part of a wiki list
			line = lines[i].match(/^(\*|#(?!REDIRECT)|:|;)+/);
			lastLine = (i == lines.length - 1);

            		//Process lines
			if (line && line !== '') { //Process lines that are members of wiki lists.
				//DC reset the empty line count to zero as this line isn't empty
				//Strip out the wiki code for the list element to leave just the text content
				lines[i] = lines[i].replace(/^(\*|#|:|;)*\s*(.*?)$/gmi, "$2");
				//If the line belong to a definition list starting with a ':' and follows
				//the last line of a sub, ommit <li> at start of line
				if (line[0].indexOf(':') === 0) {
					if (line[0].length === lastList.length) {
						lines[i] = _continueList(lastList, line[0]) + lines[i];
					} else if (line[0].length > lastList.length) {//DC if this is the start of the list add opening <div> as list will be enclosed in <div>s
						if (line[0].length == 1) { // if first line of list place in a <div>
							lines[i] = '<div>' +  _openList(lastList, line[0]) + lines[i];
						} else {
							lines[i] = _openList(lastList, line[0]) + lines[i];
						}
					} else if (line[0].length < lastList.length) {//close list
						lines[i] = _closeList(lastList, line[0]) + lines[i];
					}
				} else {//else if the line doesn't belong to a definition list starting with a ':' and follows
					//the last line of a sub list, include <li> at start of line
					if (line[0].length === lastList.length) {
						lines[i] = _continueList(lastList, line[0]) + lines[i];
					} else if (line[0].length > lastList.length) {//DC if this is the start of top level list add opening <div> as list will be enclosed in <div>s
						if (line[0].length == 1) { // if first line of list place in a <div>
							lines[i] = '<div>' +  _openList(lastList, line[0]) + lines[i];
						} else {
							lines[i] = _openList(lastList, line[0]) + lines[i];
						}
					} else if (line[0].length < lastList.length) {//if moving back to higher level list from a sub list then precede line with a <li> tag
						lines[i] = _closeList(lastList, line[0]) + '<li>' + lines[i];
					}
				}
				//set lastlist as this will be used if the next line is a list line to determine if it is a sublist or not
				lastList = line[0];

			} else {//else process lines that are not wiki list items
				//set emptyLine if line is empty
				emptyLine = lines[i].match(/^(\s|&nbsp;)*$/);

				if (emptyLine) { // process empty lines
					// If not already in a paragraph (block of blank lines).  Process first empty line differently
					if (!inParagraph) {
						lines[i] = lines[i] + '<div class="bs_emptyline_first"><br class="bs_emptyline_first"/></div>';
						inParagraph = true;
					} else {// this is already in a paragraph
						lines[i] = lines[i] + '<div class="bs_emptyline"><br class="bs_emptyline"/></div>';
					}
				} else { // not an empty line
					if (!inParagraph && lines[i].match(/(^\<@@@TAG)/i)) { // if the line starts with <@@@TAG then precede it with a blank line
							lines[i] = '<br class="bs_emptyline"/>' + lines[i];
					}
/*					if (!inParagraph && lines[i].match(/(^\<@@@CMT)/i)) { // if the line starts with <@@@CMT then precede it with a blank line
							lines[i] = '<br class="bs_emptyline"/>' + lines[i];
					}*/
					inParagraph = false;
					if (lines[i].match(/(^\<td\>)/i)) { //first line of data in a table cell
						lines[i] = lines[i] + '<br class="bs_emptyline"/>';
					}
				}
				//Test if the previous line was in a list if so close the list
				//and place closing </div> before this line
				if (lastList.length > 0) {
					lines[i - 1] = lines[i - 1] + _closeList(lastList, '') + '</div>';
					//DC close the <div> that contains the list 
					lastList = '';
				}
			}
		}
		return lines.join("\n");
	}

	function _recoverTags(text) {
		var i, regex;
		if (_tags) {
			for (i = 0; i < _tags.length; i++) {
				regex = '<@@@TAG' + i + '@@@>';
				text = text.replace(new RegExp(regex, 'gmi'), _tags[i]);
			}
		}
		_tags = false;

		return text;
	}

	function _recoverComments(text) {
		var i, regex;
		if (_comments) {
			for (i = 0; i < _comments.length; i++) {
				regex = '<@@@CMT' + i + '@@@>';
				text = text.replace(new RegExp(regex, 'gmi'), _comments[i]);
			}
		}
		_comments = false;
		return text;
	}

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
