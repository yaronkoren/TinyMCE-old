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
/*global mw:true */

tinymce.PluginManager.add('wikilink', function(editor) {
	var attachState = {};

	function isLink(elm) {
		return elm && elm.nodeName === 'A' && elm.href;
	}

	function hasLinks(elements) {
		return tinymce.util.Tools.grep(elements, isLink).length > 0;
	}

	function getLink(elm) {
		return editor.dom.getParent(elm, 'a[href]');
	}

	function getSelectedLink() {
		return getLink(editor.selection.getStart());
	}

	function getHref(elm) {
		// Returns the real href value not the resolved a.href value
		var href = elm.getAttribute('data-mce-href');
		return href ? href : elm.getAttribute('href');
	}

	function isContextMenuVisible() {
		var contextmenu = editor.plugins.contextmenu;
		return contextmenu ? contextmenu.isContextMenuVisible() : false;
	}

	var hasOnlyAltModifier = function (e) {
		return e.altKey === true && e.shiftKey === false && e.ctrlKey === false && e.metaKey === false;
	};

	function leftClickedOnAHref(elm) {
		var sel, rng, node;
		if (editor.settings.link_context_toolbar && !isContextMenuVisible() && isLink(elm)) {
			sel = editor.selection;
			rng = sel.getRng();
			node = rng.startContainer;
			// ignore cursor positions at the beginning/end (to make context toolbar less noisy)
			if (node.nodeType == 3 && sel.isCollapsed() && rng.startOffset > 0 && rng.startOffset < node.data.length) {
				return true;
			}
		}
		return false;
	}

	function appendClickRemove(link, evt) {
		document.body.appendChild(link);
		link.dispatchEvent(evt);
		document.body.removeChild(link);
	}

	function openDetachedWindow(url) {
		// Chrome and Webkit has implemented noopener and works correctly with/without popup blocker
		// Firefox has it implemented noopener but when the popup blocker is activated it doesn't work
		// Edge has only implemented noreferrer and it seems to remove opener as well
		// Older IE versions pre IE 11 falls back to a window.open approach
		if (!tinymce.Env.ie || tinymce.Env.ie > 10) {
			var link = document.createElement('a');
			link.target = '_blank';
			link.href = url;
			link.rel = 'noreferrer noopener';

			var evt = document.createEvent('MouseEvents');
			evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

			appendClickRemove(link, evt);
		} else {
			var win = window.open('', '_blank');
			if (win) {
				win.opener = null;
				var doc = win.document;
				doc.open();
				doc.write('<meta http-equiv="refresh" content="0; url=' + tinymce.DOM.encode(url) + '">');
				doc.close();
			}
		}
	}

	function gotoLink(a) {
		if (a) {
			var href = getHref(a);
			if (/^#/.test(href)) {
				var targetEl = editor.$(href);
				if (targetEl.length) {
					editor.selection.scrollIntoView(targetEl[0], true);
				}
			} else {
				openDetachedWindow(a.href);
			}
		}
	}

	function gotoSelectedLink() {
		gotoLink(getSelectedLink());
	}

	function toggleViewLinkState() {
        var self = this;

		var toggleVisibility = function (e) {
			if (hasLinks(e.parents)) {
				self.show();
			} else {
				self.hide();
			}
		};

		if (!hasLinks(editor.dom.getParents(editor.selection.getStart()))) {
			self.hide();
		}

        editor.on('nodechange', toggleVisibility);

		self.on('remove', function () {
			editor.off('nodechange', toggleVisibility);
		});
	}

	function createLinkList(callback) {
		return function() {
			var linkList = editor.settings.link_list;

			if (typeof linkList == "string") {
				tinymce.util.XHR.send({
					url: linkList,
					success: function(text) {
						callback(tinymce.util.JSON.parse(text));
					}
				});
			} else if (typeof linkList == "function") {
				linkList(callback);
			} else {
				callback(linkList);
			}
		};
	}

	function buildListItems(inputList, itemCallback, startItems) {
		function appendItems(values, output) {
			output = output || [];

			tinymce.each(values, function(item) {
				var menuItem = {text: item.text || item.title};

				if (item.menu) {
					menuItem.menu = appendItems(item.menu);
				} else {
					menuItem.value = item.value;

					if (itemCallback) {
						itemCallback(menuItem);
					}
				}

				output.push(menuItem);
			});

			return output;
		}

		return appendItems(inputList, startItems || []);
	}

	function showDialog(linkList) {
		var data = {}, selection = editor.selection, dom = editor.dom, selectedElm, anchorElm, initialText, linkParts = [];
		var win, onlyText, textListCtrl, linkListCtrl, relListCtrl, targetListCtrl, classListCtrl, linkTitleCtrl, value;

		function linkListChangeHandler(e) {
			var textCtrl = win.find('#text');

			if (!textCtrl.value() || (e.lastControl && textCtrl.value() == e.lastControl.text())) {
				textCtrl.value(e.control.text());
			}

			win.find('#href').value(e.control.value());
		}

		function buildAnchorListControl(url) {
			var anchorList = [];

			tinymce.each(editor.dom.select('a:not([href])'), function(anchor) {
				var id = anchor.name || anchor.id;

				if (id) {
					anchorList.push({
						text: id,
						value: '#' + id,
						selected: url.indexOf('#' + id) != -1
					});
				}
			});

			if (anchorList.length) {
				anchorList.unshift({text: 'None', value: ''});

				return {
					name: 'anchor',
					type: 'listbox',
					label: 'Anchors',
					values: anchorList,
					onselect: linkListChangeHandler
				};
			}
		}

		function updateText() {
			if (!initialText && data.text.length === 0 && onlyText) {
				this.parent().parent().find('#text')[0].value(this.value());
			}
		}

		function urlChange(e) {
			var meta = e.meta || {};

			if (linkListCtrl) {
				linkListCtrl.value(editor.convertURL(this.value(), 'href'));
			}

			tinymce.each(e.meta, function(value, key) {
				var inp = win.find('#' + key);

				if (key === 'text') {
					if (initialText.length === 0) {
						inp.value(value);
						data.text = value;
					}
				} else {
					inp.value(value);
				}
			});

			if (meta.attach) {
				attachState = {
					href: this.value(),
					attach: meta.attach
				};
			}

			if (!meta.text) {
				updateText.call(this);
			}
		}

		function isOnlyTextSelected(anchorElm) {
			var html = selection.getContent();

			// Partial html and not a fully selected anchor element
			if (/</.test(html) && (!/^<a [^>]+>[^<]+<\/a>$/.test(html) || html.indexOf('href=') == -1)) {
				return false;
			}

			if (anchorElm) {
				var nodes = anchorElm.childNodes, i;

				if (nodes.length === 0) {
					return false;
				}

				for (i = nodes.length - 1; i >= 0; i--) {
					if (nodes[i].nodeType != 3) {
						return false;
					}
				}
			}

			return true;
		}

		function onBeforeCall(e) {
			e.meta = win.toJSON();
		}

		selectedElm = selection.getNode();
		anchorElm = dom.getParent(selectedElm, 'a[href]');
		onlyText = isOnlyTextSelected();

		if ((value = dom.getAttrib(anchorElm, 'data-mw-type'))) {
			data.type = value;
		}

		value = decodeURI(dom.getAttrib(anchorElm, 'data-mw-wikitext'));
		if (data.type == 'internal_link') {
			value = value.substr(2, value.length - 4);
			linkParts = value.split("|");
			if (linkParts.length > 1) {
				value = linkParts[1];
			} else {
				value = '';
			}
		} else if (data.type == 'external_link') {
			value = value.substr(1, value.length - 2);
			linkParts = value.split(" ");
			if (linkParts.length > 1) {
				linkParts.shift();
				value = linkParts.join(" ");
			} else {
				value = '';
			}
		}
		data.text = value;

//		data.text = initialText = anchorElm ? (anchorElm.innerText || anchorElm.textContent) : selection.getContent({format: 'text'});
		data.href = decodeURI(anchorElm ? dom.getAttrib(anchorElm, 'href').replace(/%20/g,' ') : '');

		if (anchorElm) {
			data.target = dom.getAttrib(anchorElm, 'target');
		} else if (editor.settings.default_link_target) {
			data.target = editor.settings.default_link_target;
		}

		if ((value = dom.getAttrib(anchorElm, 'rel'))) {
			data.rel = value;
		}

		if ((value = dom.getAttrib(anchorElm, 'class'))) {
			data['class'] = value;
			if (data["class"] == "link internal mw-internal-link mceNonEditable new") {
				data["class"] = "link internal mw-internal-link mceNonEditable" ;
			}
		}

		if ((value = dom.getAttrib(anchorElm, 'title'))) {
			data.title = value;
		}

		if ((value = dom.getAttrib(anchorElm, 'data-mw-wikitext'))) {
			data.wikitext = decodeURI(value);
		}

		if (onlyText) {
			textListCtrl = {
				name: 'text',
				type: 'textbox',
				size: 40,
				label: mw.msg("tinymce-link-display-text-label"),
				onchange: function() {
					data.text = this.value();
				}
			};
		}

		if (linkList) {
			linkListCtrl = {
				type: 'listbox',
				label: mw.msg("tinymce-link-link-list-label"),
				values: buildListItems(
					linkList,
					function(item) {
						item.value = editor.convertURL(item.value || item.url, 'href');
					},
					[{text: mw.msg("tinymce-link-link-list-none"), value: ''}]
				),
				onselect: linkListChangeHandler,
				value: editor.convertURL(data.href, 'href'),
				onPostRender: function() {
					/*eslint consistent-this:0*/
					linkListCtrl = this;
				}
			};
		}

		if (editor.settings.target_list !== false) {
			if (!editor.settings.target_list) {
				editor.settings.target_list = [
					{text: mw.msg("tinymce-link-target-none"), value: ''},
					{text: mw.msg("tinymce-link-target-new-window"), value: '_blank'}
				];
			}

			targetListCtrl = {
				name: 'target',
				type: 'listbox',
				label: mw.msg("tinymce-link-target-label"),
				values: buildListItems(editor.settings.target_list)
			};
		}

		if (editor.settings.rel_list) {
			relListCtrl = {
				name: 'rel',
				type: 'listbox',
				label: mw.msg("tinymce-link-rel-label"),
				values: buildListItems(editor.settings.rel_list)
			};
		}

		if (editor.settings.link_class_list) {
			classListCtrl = {
				name: 'class',
				type: 'listbox',
				label: mw.msg("tinymce-link-type-label"),
				value: data.class,
				values: buildListItems(
					editor.settings.link_class_list,
					function(item) {
						if (item.value) {
							item.textStyle = function() {
								return editor.formatter.getCssText({inline: 'a', classes: [item.value]});
							};
						}
					}
				)
			};
		}

		if (editor.settings.link_title !== false) {
			linkTitleCtrl = {
				name: 'title',
				type: 'textbox',
				label: mw.msg("tinymce-link-title-label"),
				value: data.title
			};
		}

		win = editor.windowManager.open({
			title: 'Insert link',
			data: data,
			body: [
				classListCtrl,
				{
					name: 'href',
					type: 'filepicker',
					filetype: 'file',
					size: 40,
					autofocus: true,
					label: mw.msg("tinymce-link-url-page-label"),
					onchange: urlChange,
					onkeyup: updateText,
					onbeforecall: onBeforeCall
				},
				textListCtrl,
				linkTitleCtrl,
				buildAnchorListControl(data.href),
				linkListCtrl,
				relListCtrl,
				targetListCtrl
			],
			onSubmit: function(e) {
				/*eslint dot-notation: 0*/
				var href;
				data = tinymce.extend(data, e.data);
				href = data.href;

				// Delay confirm since onSubmit will move focus
				function delayedConfirm(message, callback) {
					var rng = editor.selection.getRng();

					tinymce.util.Delay.setEditorTimeout(editor, function() {
						editor.windowManager.confirm(message, function(state) {
							editor.selection.setRng(rng);
							callback(state);
						});
					});
				}

				function toggleTargetRules(rel, isUnsafe) {
					var rules = 'noopener noreferrer';

					function addTargetRules(rel) {
						rel = removeTargetRules(rel);
						return rel ? [rel, rules].join(' ') : rules;
					}

					function removeTargetRules(rel) {
						var regExp = new RegExp('(' + rules.replace(' ', '|') + ')', 'g');
						if (rel) {
							rel = tinymce.trim(rel.replace(regExp, ''));
						}
						return rel ? rel : null;
					}

					return isUnsafe ? addTargetRules(rel) : removeTargetRules(rel);
				}

				function createLink() {
/*					//Trim left and right everything (including linebreaks) that is not a starting or ending link code
					//This is necessary to avoid the bswikicode parser from breaking the markup
					var code = data.code.replace(/(^.*?\[|\].*?$|\r\n|\r|\n)/gm, ''); //first layer of '[...]' //external-, file- and mailto- links
					code = code.replace(/(^.*?\[|\].*?$|\r\n|\r|\n)/gm, ''); //potential second layer of '[[...]]' //internal and interwiki links*/
					data.type = "";
					var apage = decodeURIComponent(data.href).replace("_"," ");
					var linkTarget = apage;
					var newClass = data["class"];
					
					if ((data["class"] == "link internal mw-internal-link mceNonEditable") || 
						(data["class"] == "link internal mw-internal-link mceNonEditable new")) {

						/*DC now go and check the links to see if pages exist */
						var server = mw.config.get( "wgServer" ) ;
						var script = mw.config.get( 'wgScriptPath' ) + '/api.php';
						var ajaxdata = {'action': 'query','titles': apage,'format': 'json',};
						$.ajax({
							dataType: "json",
							url: script,
							data: ajaxdata,
							async: false, 
							success: function(data) {
								if (typeof data.query.pages == "undefined") {
									newClass = "link internal mw-internal-link mceNonEditable new";
								} else {
									var pages = data.query.pages;
									for( var page in pages ) {
										if (page == -1) {
											if (pages[page].title) {
												//error in lookup
												if ((typeof pages[page].missing != "undefined") ) {
													title = pages[page].title;
													message = mw.msg("tinymce-wikicode-alert-image-not-found-on-wiki",title);
												} else if (typeof pages[page].invalid != "undefined") {
													message = mw.msg("tinymce-wikicode-alert-image-request-invalid",filename);								
												} else {
													message = mw.msg("tinymce-wikicode-alert-image-request-unknown-error",filename);								
												}
												linkTarget += " " + message;
												newClass = "link internal mw-internal-link mceNonEditable new";
											}
										}
									}
								}
							}
						});
						data["class"] = newClass;
						data.type = "internal_link" ;
					} else if (data["class"] == "link external mw-external-link mceNonEditable") {
						data.type = "external_link" ; 
					}
					data.wikitext = apage ;
					var linkText = decodeURI(data.text).replace("_"," ");
					if (data.text) {
						if (data.type == "internal_link") {
							data.wikitext = "[[" + data.wikitext + "|" + linkText + "]]";
						} else if (data.type == "external_link") {
							data.wikitext = "[" + data.wikitext + " " + linkText + "]";
						}
					}
					data.wikitext = encodeURI(data.wikitext);

					var linkAttrs = {
						href: href,
						'data-mce-href': href,
						'data-mw-type': data.type,
						'data-mw-wikitext': data.wikitext,
						target: data.target ? data.target : null,
						rel: data.rel ? data.rel : null,
						"class": data["class"] ? data["class"] : null,
						title: linkTarget ? linkTarget : null
//						title: apage ? apage : null
					};

					if (!editor.settings.allow_unsafe_link_target) {
						linkAttrs.rel = toggleTargetRules(linkAttrs.rel, linkAttrs.target == '_blank');
					}

					if (href === attachState.href) {
						attachState.attach();
						attachState = {};
					}
					if (anchorElm) {
						editor.focus();
						if (!data.text) data.text = apage;
//						if (onlyText && data.text != initialText) {
						if (onlyText && data.text ) {
							if ("innerText" in anchorElm) {
								anchorElm.innerText = data.text;
							} else {
								anchorElm.textContent = data.text;
							}
						}

						dom.setAttribs(anchorElm, linkAttrs);

						selection.select(anchorElm);
						editor.undoManager.add();
					} else {
						if (onlyText) {
							args = {format: 'raw'};//mceInsertRawHTML?
							var link = dom.create('a', linkAttrs, dom.encode(data.text));
							editor.insertContent(dom.createHTML('a', linkAttrs, dom.encode(data.text)),args);
						} else {
							editor.execCommand('mceInsertLink', false, linkAttrs);
						}
					}
				}

				function insertLink() {
					editor.undoManager.transact(createLink);
				}

				if (!href) {
					editor.execCommand('unlink');
					return;
				}

				// Is email and not //user@domain.com
				if (href.indexOf('@') > 0 && href.indexOf('//') == -1 && href.indexOf('mailto:') == -1) {
					delayedConfirm(
						mw.msg("tinymce-link-want-to-link-email"),
						function(state) {
							if (state) {
								href = 'mailto:' + href;
							}

							insertLink();
						}
					);

					return;
				}

				// Is not protocol prefixed
				var hasUrl,
				urlProtocolMatch = "/^" + mw.config.get( 'wgUrlProtocols' ) + "/i";
				urlProtocolMatch = urlProtocolMatch.replace(/\|/g,"|^");
				if (href.match(urlProtocolMatch) ||
					href.substr(0,2) === "//" ) {
					hasUrl = true;
				}
				
				if ((data["class"] == "link external mw-external-link mceNonEditable") &&
					(editor.settings.link_assume_external_targets && !hasUrl)) {
					delayedConfirm(
						mw.msg("tinymce-link-want-to-link-external"),
						function(state) {
							if (state) {
								href = '//' + href;
							}

							insertLink();
						}
					);

					return;
				}

				insertLink();
			}
		});
	}

	editor.addButton('wikilink', {
		icon: 'link',
		tooltip: mw.msg("tinymce-link-link-button-tooltip"),
		shortcut: 'Meta+K',
		onclick: createLinkList(showDialog),
		stateSelector: 'a[href]'
	});

	editor.addButton('unlink', {
		icon: 'unlink',
		tooltip: mw.msg("tinymce-link-link-remove-button-tooltip"),
		cmd: 'unlink',
		stateSelector: 'a[href]'
	});


	if (editor.addContextToolbar) {
		editor.addButton('openlink', {
			icon: 'newtab',
			tooltip: mw.msg("tinymce-link-open-link"),
			onclick: gotoSelectedLink
		});

		editor.addContextToolbar(
			leftClickedOnAHref,
			mw.msg("tinymce-link-context-menu")
		);
	}

	this.showDialog = showDialog;
	
	editor.addShortcut('Meta+K', '', createLinkList(showDialog));
	editor.addCommand('mceLink', createLinkList(showDialog));

	editor.on('click', function (e) {
		var link = getLink(e.target);
		if (link && tinymce.util.VK.metaKeyPressed(e)) {
			e.preventDefault();
			gotoLink(link);
		}
	});

	editor.on('keydown', function (e) {
		var link = getSelectedLink();
		if (link && e.keyCode === 13 && hasOnlyAltModifier(e)) {
			e.preventDefault();
			gotoLink(link);
		}
	});


	editor.addMenuItem('openlink', {
		text: mw.msg('tinymce-openlink'),
		icon: 'newtab',
		onclick: gotoSelectedLink,
		onPostRender: toggleViewLinkState,
		prependToContext: true
	});

	editor.addMenuItem('wikilink', {
		icon: 'link',
		text: mw.msg('tinymce-link'),
		shortcut: 'Meta+K',
		onclick: createLinkList(showDialog),
		stateSelector: 'a[href]',
		context: 'insert',
		prependToContext: true
	});

	// Add option to double-click on link to get
	// "link" popup.
	editor.on('dblclick', function(e) {
		if (e.target.className.includes("mw-internal-link") || e.target.className.includes("mw-external-link")) {
			tinyMCE.activeEditor.execCommand('mceLink');
		}
	});

});
