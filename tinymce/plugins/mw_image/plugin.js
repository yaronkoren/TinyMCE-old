/**
 * plugin.js
 *
 * Released under LGPL License.
 * Copyright (c) 1999-2015 Ephox Corp. All rights reserved
 *
 * License: http://www.tinymce.com/license
 * Contributing: http://www.tinymce.com/contributing
 *
 * Modified to work with Mediawiki 
 * Duncan Crane duncan.crane@aoxomoxoa.co.uk
 */

/*global tinymce:true */

tinymce.PluginManager.add('wikiimage', function(editor) {
//DC 06122018
	var me = this,
		_srccontent,
		_userThumbsize = 3,
		_thumbsizes = ['120', '150', '180', '200', '250', '300'];
		
	_userThumbsize = _thumbsizes[ mw.user ? mw.user.options.get('thumbsize') : 3 ];

	var scriptPath = mw.config.get( 'wgScriptPath' );

	this.makeWikiImageDataObject = function() {
		return {
			imagename: '',
			thumb: false,
			thumbsize: _userThumbsize,
			right: false,
			left: false,
			center: false,
			align: '',
			none: false,
			frameless: false,
			frame: false,
			border: false,
			upright: false,
			alt: '',
			caption: '',
			link: '',
			sizewidth: '',
			sizeheight: '',
			class: ''
		};
	};

	this.makeDefaultImageAttributesObject = function() {
		return {
			'class': "bs-ve-image",
			'border': 0,
			//'width': _userThumbsize,
			//HAD: display:inline-block; //Future: only CSS class
			'style':"cursor:move;"
		};
	};
//DC END 06012018

	function getImageSize(url, callback) {
		var img = document.createElement('img');

		function done(width, height) {
			if (img.parentNode) {
				img.parentNode.removeChild(img);
			}

			callback({width: width, height: height});
		}

		img.onload = function() {
			done(Math.max(img.width, img.clientWidth), Math.max(img.height, img.clientHeight));
		};

		img.onerror = function() {
			done();
		};

		var style = img.style;
		style.visibility = 'hidden';
		style.position = 'fixed';
		style.bottom = style.left = 0;
		style.width = style.height = 'auto';

		document.body.appendChild(img);
		img.src = url;
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
					itemCallback(menuItem);
				}

				output.push(menuItem);
			});

			return output;
		}

		return appendItems(inputList, startItems || []);
	}

	// display and process upload form
	function showDialog(dialogData) {
		//Check uploads are allowed for this wiki, exit if not
		
		if (!mw.config.get( 'wgEnableUploads' )) {
			editor.windowManager.alert("I'm sorry, uploads aren't enabled on this wiki");
			return;
		}

		if (mw.config.get( 'wgTinyMCEUserIsBlocked' )) {
			editor.windowManager.alert("I'm sorry, you aren't allowed to upload on this wiki");
			return;
		}

		if (mw.config.get( 'wgReadOnly' )) {
			editor.windowManager.alert(mw.config.get( 'wgReadOnly' ));
			return;
		}
		
		function getUserRights() {
			return mw.user.getRights( function(){
				});
		}
		
		$.when(getUserRights(), $.ready).then( function(a1){
			debugger;
			var format, pclass, win, data = {}, dom = editor.dom, imgElm, figureElm, srcType = 'File';
			var width, height, link, imageListCtrl, classListCtrl, dialogData = {};
			var imageDimensions = editor.settings.image_dimensions !== false;		
			var userRights = a1;
			var userMayUpload = false;
			var userMayUploadFromURL = false;
			
			//set permission flags for use in validations
			if (userRights) { 
				for (userRight in userRights) {
					if (userRights[userRight] == 'upload') {
						userMayUpload = true;
					} else if (userRights[userRight] == 'upload_by_url') {
						userMayUploadFromURL = true;
					}
				}
			}

			//check uploads are allowed for this user, exit if not
			if (!userMayUpload) {
				  editor.windowManager.alert("I'm sorry, you do not have permission to upload files on this wiki");
				  return;
			}
			
			//chwecks if files of with given extension are allowed to be uploaded
			function checkFileExtensionIsAllowed(extension) { 
				var checkFileExtensions = (mw.config.get( 'wgCheckFileExtensions' )),
					strictFileExtensons = (mw.config.get( 'wgStrictFileExtensions' )), 
					allowedsFileExtensions = (mw.config.get( 'wgFileExtensions' )),  
					disallowedsFileExtensions = (mw.config.get( 'wgFileBlacklist' )),
					extensionAllowed;
				
				if (disallowedsFileExtensions) { 
					for (fileExtension in disallowedsFileExtensions) {
						if (disallowedsFileExtensions[fileExtension] == extension) {
							return false;
						}
					}
				}

				extensionAllowed = true;
				if (checkFileExtensions) { 
					if (strictFileExtensons) {
						extensionAllowed = false;
						for (fileExtension in allowedsFileExtensions) {
							if (allowedsFileExtensions[fileExtension] == extension) {
								extensionAllowed = true;
							}
						}
					}
				}
				return extensionAllowed;
			}


			function recalcSize() {
				var widthCtrl, heightCtrl, newWidth, newHeight;
	
				widthCtrl = win.find('#width')[0];
				heightCtrl = win.find('#height')[0];
	
				if (!widthCtrl || !heightCtrl) {
					return;
				}
	
				newWidth = widthCtrl.value();
				newHeight = heightCtrl.value();
	
				if (win.find('#constrain')[0].checked() && (newWidth)) {
					if ((width != newWidth) && (newWidth != 0 )) {
						newHeight = Math.round((newWidth / width) * height);
	
						if (isNaN(newHeight) || (newHeight == 0)) {
							newHeight = null;	
						}
						
						heightCtrl.value(newHeight);
					}
				}
	
				width = newWidth;
				height = newHeight;
			}
	
			function updateStyle() {
				debugger;
				function addPixelSuffix(value) {
					if (value.length > 0 && /^[0-9]+$/.test(value)) {
						value += 'px';
					}
	
					return value;
				}
	
	//DC always have the advtab
	/*			if (!editor.settings.image_advtab) {
					return;
				}*/
				var data = win.toJSON(),
					css = dom.parseStyle(data.style);
	
				data.style = '';
	
				//In the first place we have to assume that "thumb" and "frame" floats
				//right,as this is MW default. May be overridden below.
				if (data.format === 'thumb' || data.format === 'frame') {
					data.style += 'border:1px solid #CCCCCC;';
					if (data.format === 'thumb') {
						pclass = 'thumb ';
					} else  {
						pclass = 'thumbimage ';
					}	
					if (data.horizontalalign === 'none'){
						data.style += 'float:right;';
						data.style += 'clear:right;';
						data.style += 'margin-left:1.4em;';
					}
				} else if (format === 'border') {
					pclass = 'thumbborder ';
				}
				if (data.horizontalalignment === 'center') {
					data.style += 'display: block;';
					data.style += 'float:none;';
					data.style += 'clear:none;';
					data.style += 'margin-left:auto;';
					data.style += 'margin-right:auto;';
					if (width) { 
						data.style += 'width:' + width + ';';
					} else {
						data.style += 'width:auto;';
					}
					if (height) { 
						data.style += 'height:' + height + ';';
					}
				} else if (data.horizontalalignment === 'right') {
					pclass += 'tright ';
					data.style += 'float:right;';
					data.style += 'clear:right;';
					data.style += 'margin-left:1.4em;';
				} else if (data.horizontalalignment === 'left') {
					pclass += 'tleft ';
					data.style += 'float:left;';
					data.style += 'clear:left;';
					data.style += 'margin-right:1.4em;';
				}
				if (data.verticalalignment) {
					data.style += 'vertical-align:' + data.verticalalignment + ';';
				}
				
				return data.style;
	
	//DC end
	
	/*
				css = mergeMargins(css);
	
				if (data.vspace) {
					css['margin-top'] = css['margin-bottom'] = addPixelSuffix(data.vspace);
				}
				if (data.hspace) {
					css['margin-left'] = css['margin-right'] = addPixelSuffix(data.hspace);
				}
				if (data.border) {
					css['border-width'] = addPixelSuffix(data.border);
				}
	
				win.find('#style').value(dom.serializeStyle(dom.parseStyle(dom.serializeStyle(css))));*/
			}
				
			function onSubmitForm(e) {
	debugger;
				var figureElm,
					oldImg,
					style,
					nodeID;
	
				function doUpload(fileToUpload, fileName, fileSummary){
			
	debugger;
					uploadData = new FormData(); //see https://developer.mozilla.org/en-US/docs/Web/Guide/Using_FormData_Objects?redirectlocale=en-US&redirectslug=Web%2FAPI%2FFormData%2FUsing_FormData_Objects
					uploadData.append("action", "upload");
					uploadData.append("filename", fileName);
					uploadData.append("text", fileSummary);
					uploadData.append("token", mw.user.tokens.get( 'editToken' ) );
					uploadData.append("file", fileToUpload);
					var url = mw.config.get( 'wgScriptPath' ) + '/api.php';
					//as we now have created the data to send, we send it...
					$.ajax( { //http://stackoverflow.com/questions/6974684/how-to-send-formdata-objects-with-ajax-requests-in-jquery
						url: url, //url to api.php 
						contentType:false,
						processData:false,
						type:'POST',
						data: uploadData,//the formdata object we created above
						success:function(data){
			
	debugger;
							//do what you like, console logs are just for demonstration :-)
							console.log("success!");
							console.log(data);
						},
						error:function(xhr,status, error){
			
	debugger;
							console.log(error)
						}
					});
				}
				
				function waitLoad(imgElm) {
					function selectImage() {
						imgElm.onload = imgElm.onerror = null;
	
						if (editor.selection) {
							editor.selection.select(imgElm);
							editor.nodeChanged();
						}
					}
	
					imgElm.onload = function() {
						if (!data.width && !data.height && imageDimensions) {
							dom.setAttribs(imgElm, {
								width: imgElm.clientWidth,
								height: imgElm.clientHeight
							});
						}
	
						selectImage();
					};
	
					imgElm.onerror = selectImage;
				}
	/***************
	
				data = dom.getAttribs(imgElm);
	
				//In the first place we have to assume that "thumb" and "frame" floats
				//right,as this is MW default. May be overridden below.
				if (e.data.format) {
					data[data-bs-format] = e.data.format ;
				}
				if (e.data.format === 'thumb') {
					data[data-bs-thumb] = 'true' ;
				} else if (e.data.format === 'frame') {
					data[data-bs-frame] = 'true' ;
				} else if (e.data.format === 'frameless') {
					data[data-bs-frameless] = 'true' ;
				} else if (e.data.format === 'border') {
					data[data-bs-border] = 'true' ;
				} 
				if (e.data.format === 'thumb' || e.data.format === 'frame') {
					data.style += 'border:1px solid #CCCCCC;';
					if (e.data.format === 'thumb') {
						pclass = 'thumb ';
					} else  {
						pclass = 'thumbimage ';
					}	
					if (e.data.horizontalalign === 'none'){
						data.style += 'float:right;';
						data.style += 'clear:right;';
						data.style += 'margin-left:1.4em;';
					}
				} else if (format === 'border') {
					pclass = 'thumbborder ';
				}
				if (data.horizontalalignment === 'center') {
					data.style += 'display: block;';
					data.style += 'float:none;';
					data.style += 'clear:none;';
					data.style += 'margin-left:auto;';
					data.style += 'margin-right:auto;';
					if (width) { 
						data.style += 'width:' + width + ';';
					} else {
						data.style += 'width:auto;';
					}
					if (height) { 
						data.style += 'height:' + height + ';';
					}
				} else if (data.horizontalalignment === 'right') {
					pclass += 'tright ';
					data.style += 'float:right;';
					data.style += 'clear:right;';
					data.style += 'margin-left:1.4em;';
				} else if (data.horizontalalignment === 'left') {
					pclass += 'tleft ';
					data.style += 'float:left;';
					data.style += 'clear:left;';
					data.style += 'margin-right:1.4em;';
				}
				if (data.verticalalignment) {
					data.style += 'vertical-align:' + data.verticalalignment + ';';
				}*/

				if (!e.data.dest && !imgElm) { // have to have a destnation name unless editing previous upload
					e.data.dest = '';
					showDialog(e.data);
					editor.windowManager.alert("I'm sorry, you have to provide a destination file name. If this field was blank it is probably because the filename corresponding to the source file has already been used.  Please enter a different one");
				}
				if (!e.data.type) e.data.type = '';
				if (!e.data.src) e.data.src = '';
				if (!e.data.summary) e.data.summary = '';
				if (!e.data.alt) e.data.alt = '';
				if (!e.data.link) e.data.link = '';
				if (e.data.width === '') e.data.width = null;
				if (e.data.height === '') e.data.height = null;
				if (!e.data.horizontalalignment) e.data.horizontalalignment = '';
				if (!e.data.verticalalignment) e.data.verticalalignment = '';
				if (!e.data.format) e.data.format = '';
	
				recalcSize();
				style = updateStyle();
				
				dialogData = e.data;
	
	// DC 06012018
	/*			var image, htmlImageObject, wikiImageObject,
					attributes, attribute, wikiText, imageCaption,
					size, property, value;
	
				image = imgElm;
	
				htmlImageObject = $(image);
				wikiImageObject = {};
	
				//process if link
				if (htmlImageObject[0].nodeName.toUpperCase() === 'A') {
					wikiImageObject.link = htmlImageObject.attr('href');
					htmlImageObject = htmlImageObject.find('img').first();
				}
	
				attributes = htmlImageObject[0].attributes;
	
				//TODO: maybe use bs.util.unprefixDataAttributeObject
				for (var j = 0; j < attributes.length; j++) {
					attribute = attributes[j].name;
					if (attribute.startsWith('data-bs-') === false) {
						property = attribute;
					} else {
						property = attribute.substr(8, attribute.length);
					}
					if ( !( property == 'width' || !property == 'height' )) {
						wikiImageObject[property] = attributes[j].value;
					}
				}
	
				//Update things that might have changed in markup but not in "data"
				//Check if wikiImageObject.imagename is set,
				//if not set it to the name of the source file
				if (!wikiImageObject.imagename) {
					var src = wikiImageObject.src;
					var dstName = src.split('/').pop().split('#')[0].split('?')[0];
					var srcfile = "File:" + dstName;
					wikiImageObject.imagename = srcfile;
				}
				//Check if wikiImageObject.style is set
				if (wikiImageObject.style) {
					var stylestring = wikiImageObject.style;
					stylestring = stylestring.replace(/\s/g, "");
					var properties = stylestring.split(';');
					var stylearray = {};
					properties.forEach(function(property) {
						var option = property.split(':');
						stylearray[option[0]] = option [1];
					});
					var stylestring = JSON.stringify(stylearray);
					var style = JSON.parse(stylestring);
					if (style['display'] === 'block' &&
						style['margin-left'] === 'auto' &&
						style['margin-right'] === 'auto') {
						wikiImageObject.align = 'center';
					}
					if (style['width']) {
						var stylewidth = style['width'].replace('px', '');
						if ( stylewidth !== "0" ) {
							wikiImageObject.sizewidth = stylewidth ;
						}
					}
					if (style['height']) {
						var styleheight = style['height'].replace('px', '');
						if ( styleheight !== "0" ) {
							wikiImageObject.sizeheight = styleheight ;
						}
					}
					if (style['float']) {
						if (style['float'] === 'left') {
							wikiImageObject.left = true;
							wikiImageObject.align = 'left';
						} else if (style['float'] === 'right') {
							wikiImageObject.right = true;
							wikiImageObject.align = 'right';
						}
					}
					if (style['vertical-align']) {
						wikiImageObject.verticalalign = style['vertical-align'];
					}
				}
				if (wikiImageObject.class) {
					if (wikiImageObject.class.indexOf("thumbborder") >= 0) {
						wikiImageObject.border = "true";
					}
					if (wikiImageObject.class.indexOf("thumbimage") >= 0) {
						wikiImageObject.frame = "true";
					}
					if (wikiImageObject.class.indexOf("thumbthumb") >= 0) {
						wikiImageObject.thumb = "true";
					}
				}
				if (htmlImageObject.css('display') === 'block' &&
					htmlImageObject.css('margin-left') === 'auto' &&
					htmlImageObject.css('margin-right') === 'auto') {
					wikiImageObject.align = 'center';
				}
				if (htmlImageObject.attr('width')
					&& htmlImageObject.attr('width') !== wikiImageObject.sizewidth) {
					wikiImageObject.sizewidth = htmlImageObject.attr( 'width' );
				}
				if (htmlImageObject.attr('height')
					&& htmlImageObject.attr('height') !== wikiImageObject.sizeheight) {
					wikiImageObject.sizeheight = htmlImageObject.attr( 'height' );
				}
				if (htmlImageObject.attr( 'caption' )) {
					wikiImageObject.caption = htmlImageObject.attr( 'caption' );
				}
				if (htmlImageObject.attr( 'link' )) {
					wikiImageObject.link = htmlImageObject.attr( 'link' );
				}
				if (htmlImageObject.css( 'width' )) {
					var csswidth = htmlImageObject.css( 'width' ).replace('px', '');
					if ( csswidth !== "0" ) {
						wikiImageObject.sizewidth = csswidth;
					}
				}
				if (htmlImageObject.css( 'height' )) {
					var cssheight = htmlImageObject.css( 'height' ).replace('px', '');
					if ( cssheight !== "0" ) {
						wikiImageObject.sizeheight = cssheight;
					}
				}
				if (htmlImageObject.css('float')) {
					if (htmlImageObject.css('float') === 'left') {
						wikiImageObject.left = true;
						wikiImageObject.align = 'left';
					} else if (htmlImageObject.css('float') === 'right') {
						wikiImageObject.right = true;
						wikiImageObject.align = 'right';
					}
				}
	
				// Build wikitext
	
				wikiText = [];
				wikiText.push(wikiImageObject.imagename);
				for (property in wikiImageObject) {
	
					if ($.inArray(property, ['imagename', 'thumbsize']) !== -1) {
						continue; //Filter non-wiki data
					}
					if ($.inArray(property, ['left', 'right', 'center', 'nolink']) !== -1) {
						continue; //Not used stuff
					}
	
					value = wikiImageObject[property];
	
					//"link" may be intentionally empty. Therefore we have to
					//check it _before_ "value is empty?"
					if ( property === 'link' ) {
						//If the 'nolink' flag is set, we need to discard a
						//maybe set value of 'link'
						if( wikiImageObject.nolink === 'true' ) {
							wikiText.push( property + '=' );
							continue;
						}
						if ( value === 'false' || value === false ) {
							continue;
						}
						wikiText.push( property + '=' + value );
						continue;
					}
	
					if( value == null || value == false
						|| value == "" || typeof value == "undefined" ) continue;
					//TODO: of short if(!value) ?
	
					if (property === 'sizewidth' ) {
						size = '';
						if (wikiImageObject.sizewidth && wikiImageObject.sizewidth !== "false") {
							size = wikiImageObject.sizewidth;
						}
						if (wikiImageObject.sizeheight && wikiImageObject.sizeheight !== "false") {
							size += 'x' + wikiImageObject.sizeheight;
						}
						if (size.length == 0 || size == "auto") continue;
						size += 'px';
						wikiText.push(size);
						continue;
					}
					if (property == 'alt') {
						wikiText.push(property + '=' + value);
						continue;
					}
					if ( property == 'align' ) {
						wikiText.push(value);
						continue;
					}
					if ( property == 'verticalalign' ) {
						wikiText.push(value);
						continue;
					}
					if ( property == 'title' ) {
						imageCaption = value;
						continue;
					}
					if ( property == 'caption' ) {
						imageCaption = value;
						continue;
					}
					if ( property == 'thumb' && value === "true" ) {
						wikiText.push( 'thumb' );
						continue;
					}
					if ( property == 'frame' && value === "true") {
						wikiText.push( 'frame' );
						continue;
					}
					if ( property == 'border' && value === "true" ) {
						wikiText.push( 'border' );
						continue;
					}
				}
	
				// make sure image caption comes in the end
				if ( imageCaption ) {
					wikiText.push( imageCaption );
				}
	
				text = text.replace(image, '[[' + wikiText.join('|').replace("@@PIPE@@", '|') + ']]');
	*/		
	//DC 06012018 
				// Setup new data 
				/*eslint dot-notation: 0*/
	/*			data = {
					type: data.type,
					src: data.src,
					dest: data.dest,
					summary: data.summary,
					licensing: data.licensing,
					alt: data.alt,
					title: data.title,
					width: data.width,
					height: data.height,
					style: data.style,
					link: data.link,
					horizontalalignment: data.horizontalalignment,
					verticalalignment: data.verticalalignment,
					format: data.format,
					caption: data.caption,
					"class": data["class"]
				};*/
				
	debugger;
	//*************
	
	
	//		var style = {};
	//		style.float = 'center';
	
				if (imgElm) {		//Editing image node so skip upload
					nodeID = imgElm.id
				} else {
					if (e.data.type == 'File') {
						nodeID = "TinyMCE" + (Math.floor((Math.random() * 100000) + 100000));
						var fileContent = _srccontent;
						var fileName = e.data.dest;
						var fileSummary = e.data.summary;
						if ((fileContent) && (fileName)) {
							doUpload(fileContent, fileName, fileSummary);
					  	}
					} else if (e.data.type == 'URL') {
					} else if (e.data.type == 'Wiki') {
					}
				}
				var data = {
					src: e.data.src,
					alt: e.data.alt,
					width: width,
					height: height,
					link: e.data.link,
					horizontalalignment: e.data.horizontalalignment,
					verticalalignment: e.data.verticalalignment,
					format: e.data.format,
					style: style,
		//			class: '$dClass',
					contentEditable: 'false',
					id: nodeID,
					"data-bs-alt": e.data.alt,
					"data-bs-sizewidth": width,
					"data-bs-sizeheight": height,
					"data-bs-align": e.data.horizontalalignment,
					"data-bs-verticalalign": e.data.verticalalignment,
					"data-bs-format": e.data.format
				};
				
				if (imgElm) {
					editor.undoManager.transact(function(){
						editor.focus();
						editor.dom.setAttribs(editor.dom.get(nodeID),data);
						editor.undoManager.add();
					});
				} else {
					var el = editor.dom.create('img', data);
					if (e.data.link) {
						el = editor.dom.create('a', {href: e.data.link}, el);
					}
					editor.undoManager.transact(function(){
						editor.focus();
						editor.selection.setNode(el);
						editor.undoManager.add();
					});
				}
	
	//*************			
	/*			if (imgElm) {
					dom.setAttribs(imgElm, e.data);
				} else {
					data.id = '__mcenew';
					editor.focus();
					editor.selection.setContent(dom.createHTML('img', data));
					imgElm = dom.get('__mcenew');
					dom.setAttrib(imgElm, 'id', null);
				}*/
				
	//DC++++++++++++++++++++++++++AJAX stuff hidden for now
	/*if (false) {
				var scriptPath = mw.config.get( 'wgScriptPath' );
				var editorid = editor.id;
				var uploadform = scriptPath + 
					'/index.php?title=Special:TinyMCEUploadWindow&pfInputID=' + 
					editorid + '&pfEditor=tinymce' +
					'&pfDropSrc=' + data.src +
					'&wpWidth=' + data.width +
					'&wpHeight=' + data.height +
					'&wpAltText=' + data.alt +
					'&wpTitle=' + data.title +
					'&wpUploadFileURL=' + data.src +
					'&wpDestFile=' + '' +
					'&wpSourceType=File';
	
				var jqueryXHR = $.ajax({
					'type': 'POST',
					'async': false,
					'url': uploadform,
					'dataType': 'json',
					'success' : function(status) {
	debugger;
						// this function only runs if an error was encounterred 
						//trying to upload the file, despite its name!! 
						editor.windowManager.alert(status);
						text = text.replace(image,"<div class='pfMceUploadFail' style='position: relative; width: " +wikiImageObject["width"] + "; height: " + wikiImageObject["height"] + " ;'><div class='pfMceUploadFailTxt mceNonEditable ' style='position: absolute; background-color:orange; z-index: 1;'>Image " + wikiImageObject['src'] + " failed to load. Try downloading to a local disk and then uploading from there. </div><div class='pfMceUploadFailImg' style='position: relative; z-index: 0; opacity:0.3'>" + image + "</div></div>");	
	
						},
						'failure' : function() {
						// this function only execute if the ajax query failed to run.  
						//TODO make language sensitive 
						editor.windowManager.alert("The process for uploading files has failed." );
					 }
					}) ;
	}*?
	//DC__________________________
	
	/*			editor.undoManager.transact(function() {
	debugger;
					if (!data.src) {
						if (imgElm) {
							dom.remove(imgElm);
							editor.focus();
							editor.nodeChanged();
						}
	
						return;
					}
	
					if (data.title === "") {
						data.title = null;
					}
	
					if (!imgElm) {
						data.id = '__mcenew';
						editor.focus();
						editor.selection.setContent(dom.createHTML('img', data));
						imgElm = dom.get('__mcenew');
						dom.setAttrib(imgElm, 'id', null);
					} else {
						dom.setAttribs(imgElm, data);
					}
	
					editor.editorUpload.uploadImagesAuto();
	
					if (data.caption === false) {
						if (dom.is(imgElm.parentNode, 'figure.image')) {
							figureElm = imgElm.parentNode;
							dom.insertAfter(imgElm, figureElm);
							dom.remove(figureElm);
						}
					}
	
					function isTextBlock(node) {
						return editor.schema.getTextBlockElements()[node.nodeName];
					}
	
					if (data.caption === true) {
						if (!dom.is(imgElm.parentNode, 'figure.image')) {
							oldImg = imgElm;
							imgElm = imgElm.cloneNode(true);
							figureElm = dom.create('figure', {'class': 'image'});
							figureElm.appendChild(imgElm);
							figureElm.appendChild(dom.create('figcaption', {contentEditable: true}, 'Caption'));
							figureElm.contentEditable = false;
	
							var textBlock = dom.getParent(oldImg, isTextBlock);
							if (textBlock) {
								dom.split(textBlock, oldImg, figureElm);
							} else {
								dom.replace(figureElm, oldImg);
							}
	
							editor.selection.select(figureElm);
						}
	
						return;
					}
	
					waitLoad(imgElm);
				});*/
			}
	
			function removePixelSuffix(value) {
				if (value) {
					value = value.replace(/px$/, '');
				}
	
				return value;
			}
			
			// get details of file already uploaded to wiki including url
			function getFileDetailsFromWiki(fileName) {
				queryData = new FormData();
				queryData.append("action", "query");
				queryData.append("prop", "imageinfo");
				queryData.append("iiprop", "url");
				queryData.append("titles", fileName);
				queryData.append("format", "json");
				var url = mw.config.get( 'wgScriptPath' ) + '/api.php';
				var fileDetails = false;
				//as we now have created the data to send, we send it...
				$.ajax( { //http://stackoverflow.com/questions/6974684/how-to-send-formdata-objects-with-ajax-requests-in-jquery
					url: url, //url to api.php 
					contentType:false,
					processData:false,
					type:'POST',
					data: queryData,//the queryData object we created above
					async: false,
					success:function(data){
						debugger;
						if (typeof data.query.pages != "undefined") {
							var pages = data.query.pages;
							for( var page in pages ) {
								if ((typeof pages[page].missing == "undefined") && (typeof pages[page].invalid == "undefined") ) {
									var pageTitle = pages[page].title
									var imageInfo = pages[page].imageinfo;
									var imageURL = imageInfo[0].url;
									if (pageTitle == fileName) {
										fileDetails = pages[page];
									}
								}
							}
						}
					},
					error:function(xhr,status, error){
					}
				});
				return fileDetails;
			}
	
			function onBeforeCall(e) {
				e.meta = win.toJSON();
			}
	
			function updateVSpaceHSpaceBorder() {
				if (!editor.settings.image_advtab) {
					return;
				}
	
				var data = win.toJSON(),
					css = dom.parseStyle(data.style);
	
				win.find('#vspace').value("");
				win.find('#hspace').value("");
	
				css = mergeMargins(css);
	
				//Move opposite equal margins to vspace/hspace field
				if ((css['margin-top'] && css['margin-bottom']) || (css['margin-right'] && css['margin-left'])) {
					if (css['margin-top'] === css['margin-bottom']) {
						win.find('#vspace').value(removePixelSuffix(css['margin-top']));
					} else {
						win.find('#vspace').value('');
					}
					if (css['margin-right'] === css['margin-left']) {
						win.find('#hspace').value(removePixelSuffix(css['margin-right']));
					} else {
						win.find('#hspace').value('');
					}
				}
	
				//Move border-width
				if (css['border-width']) {
					win.find('#border').value(removePixelSuffix(css['border-width']));
				}
	
				win.find('#style').value(dom.serializeStyle(dom.parseStyle(dom.serializeStyle(css))));
	
			}
	
			function mergeMargins(css) {
				if (css.margin) {
	
					var splitMargin = css.margin.split(" ");
	
					switch (splitMargin.length) {
						case 1: //margin: toprightbottomleft;
							css['margin-top'] = css['margin-top'] || splitMargin[0];
							css['margin-right'] = css['margin-right'] || splitMargin[0];
							css['margin-bottom'] = css['margin-bottom'] || splitMargin[0];
							css['margin-left'] = css['margin-left'] || splitMargin[0];
						break;
						case 2: //margin: topbottom rightleft;
							css['margin-top'] = css['margin-top'] || splitMargin[0];
							css['margin-right'] = css['margin-right'] || splitMargin[1];
							css['margin-bottom'] = css['margin-bottom'] || splitMargin[0];
							css['margin-left'] = css['margin-left'] || splitMargin[1];
							break;
						case 3: //margin: top rightleft bottom;
							css['margin-top'] = css['margin-top'] || splitMargin[0];
							css['margin-right'] = css['margin-right'] || splitMargin[1];
							css['margin-bottom'] = css['margin-bottom'] || splitMargin[2];
							css['margin-left'] = css['margin-left'] || splitMargin[1];
							break;
						case 4: //margin: top right bottom left;
							css['margin-top'] = css['margin-top'] || splitMargin[0];
							css['margin-right'] = css['margin-right'] || splitMargin[1];
							css['margin-bottom'] = css['margin-bottom'] || splitMargin[2];
							css['margin-left'] = css['margin-left'] || splitMargin[3];
					}
					delete css.margin;
				}
				return css;
			}
			
			// called when the type of the file upload is changed
			function typeChange(e) {
				var typeCtrl = win.find('#type')[0],
					srcCtrl = win.find('#src')[0],
					alternateSrcCtrl = win.find('#alternatesrc')[0],
					destCtrl = win.find('#dest')[0]
					summaryCtrl = win.find('#summary')[0],
					alternateSummaryCtrl = win.find('#alternateSummary')[0],
					sourceType = typeCtrl.value();
					
				if (sourceType == 'File') {			// local Fle upload
					// enable filpicker and summary input
					alternateSrcCtrl.visible(false);				
					srcCtrl.visible(true);
					alternateSummaryCtrl.visible(false);				
					summaryCtrl.visible(true);
				} else if (sourceType == 'URL') {	// URL upload
					if (!userMayUploadFromURL) {
						editor.windowManager.alert("I'm sorry, you do not have permission to upload files on this wiki");
						typeCtrl.value('File');
						return;
					}
					// disable file pickker and enable summary inpt
					srcCtrl.visible(false);
					alternateSrcCtrl.visible(true);				
					alternateSummaryCtrl.visible(false);				
					summaryCtrl.visible(true);
				} else if (sourceType == 'Wiki') {	// file already uploaded to wiki
					// disable file pickker and summary inpt
					srcCtrl.visible(false);
					alternateSrcCtrl.visible(true);				
					summaryCtrl.visible(false);
					alternateSummaryCtrl.visible(true);				
				}
				return;
			}
	
			// called when the source for the upload changes
			function srcChange(e) {
				debugger;
				var typeCtrl = win.find('#type')[0],
					srcCtrl = win.find('#src')[0],
					alternateSrcCtrl = win.find('#alternatesrc')[0],
					destCtrl = win.find('#dest')[0]
					summaryCtrl = win.find('#summary')[0],
					alternateSummaryCtrl = win.find('#alternateSummary')[0];
					
				var sourceType = typeCtrl.value(),
					srcURL, 
					prependURL,
					absoluteURLPattern, 
					destCtrl,
					meta = e.meta || {};
			
				if (sourceType == 'File') {	//Pre process local file upload
					tinymce.each(meta, function(value, key) {
						win.find('#' + key).value(value);
					});
					if (meta.srccontent) {
						_srccontent = meta.srccontent;
					}
					srcURL = editor.convertURL(this.value(), 'src');
					// Pattern test the src url and make sure we haven't already prepended the url
					prependURL = editor.settings.image_prepend_url;
					absoluteURLPattern = new RegExp('^(?:[a-z]+:)?//', 'i');
					if (prependURL && !absoluteURLPattern.test(srcURL) && srcURL.substring(0, prependURL.length) !== prependURL) {
						srcURL = prependURL + srcURL;
					}
					if (!meta.width && !meta.height) {
						getImageSize(editor.documentBaseURI.toAbsolute(this.value()), function(data) {
							if (data.width && data.height && imageDimensions) {
								width = data.width;
								height = data.height;
								win.find('#width').value(width);
								win.find('#height').value(height);
							}
						});
					}
				} else if (sourceType == 'URL') {	//Pre process URL upload
				} else if (sourceType == 'Wiki') {	//Pre process display file already uploaded to wiki
				}
				this.value(srcURL); //reset the value of this field to the propper src name which is striped of its path
				destCtrl.value(srcURL); // initially set the valueof the dest field to be the same as the src field
				destCtrl.fire('change'); // initially set the valueof the dest field to be the same as the src field
			}
			
			// called when the destination for the upload changes
			function destChange(e) {
				var typeCtrl = win.find('#type')[0],
					srcCtrl = win.find('#src')[0],
					alternateSrcCtrl = win.find('#alternatesrc')[0],
					destCtrl = win.find('#dest')[0]
					summaryCtrl = win.find('#summary')[0],
					alternateSummaryCtrl = win.find('#alternateSummary')[0],
					sourceType = typeCtrl.value();
					destinationFile = 'File:' + destCtrl.value();
					destinationFileDetails = getFileDetailsFromWiki(destinationFile);
					file = destinationFile.split('/').pop().split('#')[0].split('?')[0],
					extension = file.split('.').pop(),	
					extensionAllowed = checkFileExtensionIsAllowed(extension);
				
				if (!extensionAllowed) {
						editor.windowManager.alert("I'm sorry, you are not allowed to upload files of this type to this wiki. Please choose a file of a different type");	
						srcCtrl.focus();
						srcCtrl.value('');
						destCtrl.value('');
						return;
				}
								
				if (sourceType == 'File' || sourceType == 'URL') {			// process local file upload
					if (destinationFileDetails) {
						editor.windowManager.confirm("The destination file already exists on this wiki.  Select Ok if you would like to use the existing file or select Cancel and enter a different destination filename for this upload",
							function(ok) {
								  if (ok) {
									  typeCtrl.value('Wiki');
									  alternateSrcCtrl.value(destCtrl.value());	
									  // disable file pickker and summary inpt
									  srcCtrl.visible(false);
									  alternateSrcCtrl.visible(true);				
									  summaryCtrl.visible(false);
									  alternateSummaryCtrl.visible(true);
								  } else {
									  destCtrl.value('');
								  }
							});
						destCtrl.focus();
						return;
					}
				} else if (sourceType == 'Wiki') {	// process display file already uploaded to wiki
					if (!destinationFileDetails) {
						editor.windowManager.confirm("The destination file does not exist on this wiki.  Select Ok if you would like to upload a new file or select Cancel and enter a different destination filename for this link",
							function(ok) {
								  if (ok) {
									  typeCtrl.value('File');
									  srcCtrl.value('');
									  // enable filpicker and summary input
									  alternateSrcCtrl.visible(false);				
									  srcCtrl.visible(true);
									  alternateSummaryCtrl.visible(false);				
									  summaryCtrl.visible(true);
									  destCtrl.value('');
								  } else {
									  srcCtrl.value('');
									  destCtrl.value('');
								  }
							});
						srcCtrl.focus();
						return;
					}
				}
			}

			// called when the constrain for dimensions changes
			function constrainChange() {
				//toggles height control on or off depending
				var heightCtrl = win.find('#height')[0],
					dummyHeightCtrl = win.find('#dummyheight')[0];
	
				if (win.find('#constrain')[0].checked() && heightCtrl) {
					dummyHeightCtrl.visible(true);
					heightCtrl.visible(false);
				} else {
					dummyHeightCtrl.visible(false);
					heightCtrl.visible(true);
				}
				return;
			}
debugger;	
			imgElm = editor.selection.getNode();
			figureElm = dom.getParent(imgElm, 'figure.image');
			
			// if node is a link to an image then get the image
			if (figureElm) {
				imgElm = dom.select('img', figureElm)[0];
				//TODO get the link for the image and add it to the editor
			}
	
			// test if we are modifying an existing upload else set to null
			if (imgElm && (imgElm.nodeName != 'IMG' || imgElm.getAttribute('data-mce-object') || imgElm.getAttribute('data-mce-placeholder'))) {
				imgElm = null;
			}
	
	//DC 06012018
	//		data = dom.getAttribs(imgElm);
	
	/*		var htmlImageObject = $('<img />').attr( me.makeDefaultImageAttributesObject() ),
				wikiImageObject = me.makeWikiImageDataObject(),
				wikitext = dom.getAttrib(imgElm, 'data-bs-wikitext'),
				parts = wikitext.split("|"), part = '',
				unsuffixedValue, dimensions, kvpair, key, value, src, imgParts,
				imgName;
	
			//We set a dummy url which contains the original filename as
			//querystring parameter
			imgParts = parts[0].split(':');
			imgParts.shift(); //Throw away leading namespace prefix
			imgName = imgParts.join(':'); //Reassemble image name
			wikiImageObject.imagename = imgName;
	
			for (var i = 1; i < parts.length; i++) {
				
				part = parts[i];
				if (part.endsWith('px')) {
					// Hint: frame ignores size but we want to keep this information
					// See: mediawiki.org/wiki/Help:Images#Size_and_frame
	
					// 100x200px -> 100x200
					unsuffixedValue = part.substr(0, part.length - 2);
					// 100x200 -> [100,200]
					dimensions = unsuffixedValue.split('x');
					if (dimensions.length === 2) {
						wikiImageObject.sizewidth = (dimensions[0] === '') ? false : dimensions[0];
						wikiImageObject.sizeheight = dimensions[1];
					} else {
						wikiImageObject.sizewidth = unsuffixedValue;
					}
	
					//wikiImageObject.frame = false;
					continue;
				}
	
				if ($.inArray(part, ['thumb', 'mini', 'miniatur']) !== -1) {
					wikiImageObject.format = 'thumb';
					continue;
				}
	
				if ($.inArray(part, ['right', 'rechts']) !== -1) {
					wikiImageObject.align = 'right';
					continue;
				}
	
				if ($.inArray(part, ['left', 'links']) !== -1) {
					wikiImageObject.align = 'left';
					continue;
				}
	
				if ($.inArray(part, ['center', 'zentriert']) !== -1) {
					wikiImageObject.align = 'center';
					continue;
				}
	
				if ($.inArray(part, ['none', 'ohne']) !== -1) {
					wikiImageObject.align = 'none';
					continue;
				}
				
				if ($.inArray(part, ['middle']) !== -1) {
					wikiImageObject.verticalalign = 'middle';
					continue;
				}
	
				if ($.inArray(part, ['top']) !== -1) {
					wikiImageObject.verticalalign = 'top';
					continue;
				}
	
				if ($.inArray(part, ['bottom']) !== -1) {
					wikiImageObject.verticalalign = 'bottom';
					continue;
				}
	
				if ($.inArray(part, ['baseline']) !== -1) {
					wikiImageObject.verticalalign = 'baseline';
					continue;
				}
	
				if ($.inArray(part, ['sub']) !== -1) {
					wikiImageObject.verticalalign = 'sub';
					continue;
				}
	
				if ($.inArray(part, ['super']) !== -1) {
					wikiImageObject.verticalalign = 'super';
					continue;
				}
	
				if ($.inArray(part, ['text-top']) !== -1) {
					wikiImageObject.verticalalign = 'text-top';
					continue;
				}
	
				if ($.inArray(part, ['text-bottom']) !== -1) {
					wikiImageObject.verticalalign = 'text-bottom';
					continue;
				}
	
				if ($.inArray(part, ['frame', 'gerahmt']) !== -1) {
					wikiImageObject.format = 'frame';
					continue;
				}
	
				if ($.inArray(part, ['frameless', 'rahmenlos']) !== -1) {
					wikiImageObject.format = 'frameless';
					continue;
				}
	
				if ($.inArray(part, ['border', 'rand']) !== -1) {
					wikiImageObject.format = 'border';
					continue;
				}
	
				kvpair = part.split('=');
				if (kvpair.length === 1) {
					wikiImageObject.caption = part; //hopefully
					continue;
				}
	
				key = kvpair[0];
				value = kvpair[1];
	
				if ($.inArray(key, ['link', 'verweis']) !== -1) {
					wikiImageObject.link = value;
					continue;
				}
	
				if ($.inArray(key, ['title']) !== -1) {
					wikiImageObject.caption = value;
					continue;
				}
	
				if ($.inArray(key, ['caption']) !== -1) {
					wikiImageObject.caption = value;
					continue;
				}
	
				if (key === 'alt') {
					wikiImageObject.alt = value;
					continue;
				}
			}*/
	
	/*		if (wikiImageObject.alt) {
				htmlImageObject.attr('alt', wikiImageObject.alt);
			}
	
	
			// Workaround for HW#2013020710000217.
			// This is more a bug of InsertFile and should be fixed there.
			// @todo Check if this is still needed. In REL_1.21 the code for
			//       adding an alt tag in InsertFile has changed.
	//		if (wikiImageObject.caption) {
	//			htmlImageObject.attr('title', wikiImageObject.caption);
	//		}
	
			if (wikiImageObject.sizewidth !== false) {
				htmlImageObject.width(wikiImageObject.sizewidth);
			}
	
			if (wikiImageObject.sizeheight !== false) {
				htmlImageObject.height(wikiImageObject.sizeheight);
			}
	
			if (wikiImageObject.thumb === true) {
				htmlImageObject.addClass('thumb');
				if (wikiImageObject.sizewidth === false) {
					htmlImageObject.width(wikiImageObject.thumbsize);
				}
			}
	
			//In the first place we have to assume that "thumb" and "frame" floats
			//right,as this is MW default. May be overridden below.
			if (wikiImageObject.thumb === true || wikiImageObject.frame === true) {
				//htmlImageObject.addClass('tright');
				htmlImageObject.css('border', '1px solid #CCCCCC');
				if (wikiImageObject.none !== true){
					htmlImageObject.css('float', 'right');
					htmlImageObject.css('clear', 'right');
					htmlImageObject.css('margin-left', '1.4em');
				}
			}
	
			if (wikiImageObject.center === true) {
				htmlImageObject.addClass('center');
				if (htmlImageObject.width) {
					var csswidth = htmlImageObject.width;
				} else {
					var csswidth = 'auto';
				}
				if (htmlImageObject.height) {
					var cssheight = htmlImageObject.height;
				} else {
					var cssheight = 'auto';
				}
				htmlImageObject.css({
					'float' : 'none', //Those might be set
					'clear' : 'none', //by thumb'
					'display': 'block',
					'margin-left': 'auto',
					'margin-right': 'auto',
					'width': csswidth,
					'height': cssheight
				});
	
			} else if (wikiImageObject.right === true) {
				htmlImageObject.addClass('tright');
				htmlImageObject.css('float', 'right');
				htmlImageObject.css('clear', 'right');
				htmlImageObject.css('margin-left', '1.4em');
			} else if (wikiImageObject.left === true) {
				htmlImageObject.addClass('tleft');
				htmlImageObject.css('float', 'left');
				htmlImageObject.css('clear', 'left');
				htmlImageObject.css('margin-right', '1.4em');
			}
	
			//We store all parsed properties of the WikiText link within the dom
			//node to make access by other components more easy
			//We use $.attr instead of $.data because of issues with IE in older
			//jQuery versions. This should be subject to further testing.
	
			htmlImageObject.attr(
				_makeDataAttributeObject(wikiImageObject)
			);
	
			//Let's store the original WikiText as well. This makes it easier for
			//other extensions to read in the data.
			//We can not use [[/]] because this might cause double parsing!
			htmlImageObject.attr('data-bs-wikitext', link);
	
			//We set a dummy url which contains the original filename as
			//querystring parameter
			imgParts = parts[0].split(':');
			imgParts.shift(); //Throw away leading namespace prefix
			imgName = imgParts.join(':'); //Reassemble image name
			src = _imageDummyUrl + '?' + imgName;
	
			//We have to save the name and url of the image to allow post process
			//replacement of dummyUrls
			_images.push({ imageName: imgName, dummySrc: src });
	
			// image, resulting in a 404 error.
			htmlImageObject.attr('src', src);
	
			// make contenteditable false so image can be selected correctly
			htmlImageObject.attr('contentEditable', false);
			htmlImageObject.attr('id',"PF" + (Math.floor((Math.random() * 100000) + 100000)));
	
			//Create linked images
			if (wikiImageObject.link !== false) {
				htmlImageObject.wrap('<a style="display:inline-block"></a>'); //IE needs closing tag
				htmlImageObject = htmlImageObject.parent();
				htmlImageObject.attr('href', wikiImageObject.link);
			}*/
	
	//		return htmlImageObject[0].outerHTML;
	
	// DC END 06012018

			if (imgElm) { //Populate form with details of existing upload

	//DC 06122018
	/*			width = '';
				height = '';*/
				link = '';
	/*			if (dom.getAttrib(imgElm, 'data-bs-sizewidth')) {
					width = dom.getAttrib(imgElm, 'data-bs-sizewidth');
				}
				if (dom.getAttrib(imgElm, 'data-bs-sizeheight')) {
					height = dom.getAttrib(imgElm, 'data-bs-sizeheight');
				}*/
	/*			if (dom.getAttrib(imgElm, 'data-bs-link') != 'false') {
					link = dom.getAttrib(imgElm, 'data-bs-link');
				}*/
				
	/*			if (dom.getAttrib(imgElm, 'middle')) {
					wikiImageObject.verticalalign = 'middle';
				} else if (dom.getAttrib(imgElm, 'top')) {
					wikiImageObject.verticalalign = 'top';
				} else if (dom.getAttrib(imgElm, 'bottom')) {
					wikiImageObject.verticalalign = 'bottom';
				} else if (dom.getAttrib(imgElm, 'baseline')) {
					wikiImageObject.verticalalign = 'baseline';
				} else if (dom.getAttrib(imgElm, 'sub')) {
					wikiImageObject.verticalalign = 'sub';
				} else if (dom.getAttrib(imgElm, 'super')) {
					wikiImageObject.verticalalign = 'super';
				} else if (dom.getAttrib(imgElm, 'text-top')) {
					wikiImageObject.verticalalign = 'text-top';
				} else if  (dom.getAttrib(imgElm, 'text-bottom')) {
					wikiImageObject.verticalalign = 'text-bottom';
				}*/
	
	/*			var format;
				if (dom.getAttrib(imgElm, 'data-bs-thumb')) {
					format = 'thumb';
				} else if (dom.getAttrib(imgElm, 'data-bs-frame')) {
					format = 'frame';
				} else if (dom.getAttrib(imgElm, 'data-bs-frameless')) {
					format = 'frameless';
				} else if (dom.getAttrib(imgElm, 'data-bs-border')) {
					format = 'border';
				}*/
				
				var src = dom.getAttrib(imgElm, 'src');

				if (!src) {
					editor.windowManager.confirm("I'm sorry, the selected node doesn't apear to have an associated source on this wiki.  Please add a new link to the existing file and delete this node");
					return;
				}				
				
				link = dom.getAttrib(imgElm, 'data-bs-link');
				if (link == 'false') {
					link = '';
				}
				width = dom.getAttrib(imgElm, 'data-bs-sizewidth');
				if ( width == 'false') {
					width = null;				
				}
				height = dom.getAttrib(imgElm, 'data-bs-sizeheight');
				if ( height == 'false') {
					height = null;				
				}		
	
				data = {
					type: 'Wiki',
					src: src,
					dest: dom.getAttrib(imgElm, 'src'),
//					"class": dom.getAttrib(imgElm, 'data-bs-class'),
					link: link,
					alt: dom.getAttrib(imgElm, 'data-bs-alt'),
					width: width,
					height: height,
					horizontalalignment: dom.getAttrib(imgElm, 'data-bs-align'),
					verticalalignment: dom.getAttrib(imgElm, 'data-bs-verticalalign'),
					format: dom.getAttrib(imgElm, 'data-bs-format'),
				};
			} else { //populate form with dat already in form if any
			debugger;
				if (!dialogData.type) dialogData.type = 'File';
				if (!dialogData.src) dialogData.src = '';
				if (!dialogData.dest) dialogData.dest = dialogData.src;
				if (!dialogData.summary) dialogData.summary = '';
				if (!dialogData.link) dialogData.link = '';
				if (!dialogData.alt) dialogData.alt = '';
				if (dialogData.constrain != false) dialogData.constrain = true;
				if (!dialogData.width) dialogData.width = null;
				if (!dialogData.height) dialogData.height = null;
				if (!dialogData.horizontalalignment) dialogData.horizontalalignment = '';
				if (!dialogData.verticalalignment) dialogData.verticalalignment = '';
				if (!dialogData.format) dialogData.format = '';
				data = {
					type: dialogData.type,
					src: dialogData.src,
					dest: dialogData.dest,
					summary: dialogData.summary,
//					"class": dom.getAttrib(imgElm, 'data-bs-class'),
					link: link,
					alt: dialogData.alt,
					constrain: dialogData.constrain,
					width: dialogData.width,
					height: dialogData.height,
					horizontalalignment: dialogData.horizontalalignment,
					verticalalignment: dialogData.verticalalignment,
					format: dialogData.format,
				};			
			}
	
	/*		if (imageList) {
				imageListCtrl = {
					type: 'listbox',
					label: 'Image list',
					values: buildListItems(
						imageList,
						function(item) {
							item.value = editor.convertURL(item.value || item.url, 'src');
						},
						[{text: 'None', value: ''}]
					),
					value: data.src && editor.convertURL(data.src, 'src'),
					onselect: function(e) {
						var altCtrl = win.find('#alt');
	
						if (!altCtrl.value() || (e.lastControl && altCtrl.value() == e.lastControl.text())) {
							altCtrl.value(e.control.text());
						}
	
						win.find('#src').value(e.control.value()).fire('change');
					},
					onPostRender: function() {
						//eslint consistent-this: 0
						imageListCtrl = this;
					}
				};
			}*/
			
			typeListCtrl = {
				name: 'type',
				type: 'listbox',
				autofocus: true,
				label: mw.msg("tinymce-upload"),
				value: dialogData.type,
				onselect: typeChange,
				tooltip: mw.msg("tinymce-upload-type-tooltip"),
				values: buildListItems(
					editor.settings.image_class_list,
					function(item) {
						if (item.value) {
							item.textStyle = function() {
								return editor.formatter.getCssText({inline: 'img', classes: [item.value]});
							};
						}
					}
				)
			};
	
			srcTextCtrl = {
				type: 'container',
				label: 'Source',
				minHeight: 30, 
				layout: 'fit',
				style: "position: realtive; width: 100%",
				align: 'center',
				items: [
					{name: 'alternatesrc', 
						type: 'textbox',
						value: dialogData.src,
//						style: "position: absolute; width: 100%; height: 100%; top: 0; right: 0",
						style: "position: absolute; top: 0; left: 0",
						onchange: srcChange,
						onbeforecall: onBeforeCall,
						visible: false},
					{name: 'src', 
						type: 'filepicker',
						filetype: 'image',
						style: "position: absolute; top: 0; right: 0",
						value: dialogData.src,
						onchange: srcChange,
						onbeforecall: onBeforeCall,
						visible: true},
				]
			};
	
			srcTextDisplay = {
				name: 'src',
				type: 'textBox',
				label: 'Source',
				disabled: true,
			};
	
			if (!dialogData.dest) dialogData.dest = '';
			destTextCtrl = {
				name: 'dest', 
				type: 'textbox', 
				label: 'Destination File Name',
				value: dialogData.dest,
				onchange: destChange,
			};
	
			summaryTextCtrl = {
				type: 'container',
				label: 'Summary',
				layout: 'fit',
				minHeight: 90, 
				style: "position: realtive; width: 100%",
				align: 'center',
				items: [
					{name: 'alternateSummary', 
						type: 'textbox', 
						multiline: 'true',
						style: "background: #f0f0f0; position: absolute; width: 100%; height: 100%; top: 0; left: 0",
						disabled: true,
						visible: false},
					{name: 'summary', 
						type: 'textbox', 
						multiline: 'true',
						style: "position: absolute; width: 100%; height: 100%; top: 0; right: 0",
						visible: true},
				]
			};
			

			linkTextCtrl = {
				label: 'Link To',
				name: 'link',
				type: 'textbox',
			};
	
			altTextCtrl = {
				name: 'alt', 
				type: 'textbox', 
				label: 'Alternative Text'
			};
	
			imageDimensionsCtrl = {
				type: 'container',
				label: 'Dimensions',
				layout: 'flex',
				direction: 'row',
				align: 'center',
				spacing: 5,
				items: [
					{name: 'constrain', 
						type: 'checkbox', 
						checked: true, 
						onchange: constrainChange, 
						text: 'Constrain proportions'},
					{name: 'width', 
						type: 'textbox', 
						maxLength: 5, 
						size: 3, 
						onchange: recalcSize, 
						ariaLabel: 'Width'},
					{type: 'label', 
						text: 'x'},
					{name: 'dummyheight', 
						type: 'textbox', 
						maxLength: 5, 
						size: 3, 
						style: "background: #f0f0f0",
						disabled: true,
						visible: true,
						ariaLabel: 'DummyHeight'},
					{name: 'height', 
						type: 'textbox', 
						maxLength: 5, 
						size: 3, 
						onchange: recalcSize, 
						visible: false,
						ariaLabel: 'Height'},
				]
			};
	
			verticalAlignListCtrl = {
				type   : 'listbox',
				name   : 'verticalalignment',
				label  : 'Vertical Alignment',
				values : 
					[
						{ text: 'Middle', value: 'middle' },
						{ text: 'Top', value: 'top' },
						{ text: 'Bottom', value: 'bottom' },
						{ text: 'Baseline', value: 'baseline' },
						{ text: 'Sub', value: 'sub' },
						{ text: 'Super', value: 'super' },
						{ text: 'Text top', value: 'text-top' },
						{ text: 'Text bottom', value: 'text-bottom', selected: true }
					]
			};
	
			horizontalAlignListCtrl = {
				type   : 'listbox',
				name   : 'horizontalalignment',
				label  : 'Horizontal Alignment',
				values : 
					[
						{ text: 'Left', value: 'left' },
						{ text: 'Centre', value: 'center' },
						{ text: 'Right', value: 'right' },
						{ text: 'None', value: 'none', selected: true }
					]
			};
	
			formatListCtrl = {
				type   : 'listbox',
				name   : 'format',
				label  : 'Format',
				values : 
					[
						{ text: 'Thumb', value: 'thumb' },
						{ text: 'Border', value: 'border' },
						{ text: 'Frame', value: 'frame' },
						{ text: 'Frameless', value: 'frameless', selected: true }
					]
			};
	
			if (imgElm) { //we are editing an existing image node
		
				var generalFormItems = [
					srcTextDisplay,
					linkTextCtrl,
					altTextCtrl,
					imageDimensionsCtrl,
					verticalAlignListCtrl,
					horizontalAlignListCtrl,
					formatListCtrl
				];
				
			} else {
		
				// General settings shared between simple and advanced dialogs
				var generalFormItems = [
	//				srcContentCtrl,
					typeListCtrl,
					srcTextCtrl,
					destTextCtrl,
					summaryTextCtrl,
				];
		
				var imageFormItems = [
					linkTextCtrl,
					altTextCtrl,
					imageDimensionsCtrl,
					verticalAlignListCtrl,
					horizontalAlignListCtrl,
					formatListCtrl
				];	
							
			}
			
	//		generalFormItems.push({name: 'licensing', type: 'textbox', label: 'Licensing'});
	
	
	/*		if (editor.settings.image_title) {
				imageFormItems.push({
					name: 'title', 
					type: 'textbox', 
					label: 'Image Title'});
			}*/
	
			
	/*		if (editor.settings.image_caption && tinymce.Env.ceFalse) {
				imageFormItems.push({name: 'caption', type: 'checkbox', label: 'Caption'});
			}*/
			
	/*		imageFormItems.push(
			{
					hidden: true,
	//				label: 'Style',
					name: 'style',
					type: 'textbox',
					onchange: updateVSpaceHSpaceBorder
				},
				{
					label: 'Link To',
					name: 'link',
					type: 'textbox',
				},
				{
					type: 'form',
					layout: 'grid',
					packV: 'start',
					columns: 2,
					padding: 0,
					alignH: ['left', 'right'],
					items: 
						[	
							{
								type   : 'listbox',
								name   : 'verticalalignment',
								label  : 'Vertical Alignment',
								values : 
									[
										{ text: 'Middle', value: 'middle' },
										{ text: 'Top', value: 'top' },
										{ text: 'Bottom', value: 'bottom' },
										{ text: 'Baseline', value: 'baseline' },
										{ text: 'Sub', value: 'sub' },
										{ text: 'Super', value: 'super' },
										{ text: 'Text top', value: 'text-top' },
										{ text: 'Text bottom', value: 'text-bottom', selected: true }
									]},
							{
								type   : 'listbox',
								name   : 'horizontalalignment',
								label  : 'Horizontal Alignment',
								values : 
									[
										{ text: 'Left', value: 'left' },
										{ text: 'Centre', value: 'centre' },
										{ text: 'Right', value: 'right' },
										{ text: 'None', value: 'none', selected: true }
									]},
							{
								type   : 'listbox',
								name   : 'format',
								label  : 'Format',
								values : 
									[
										{ text: 'Thumb', value: 'thumb' },
										{ text: 'Border', value: 'border' },
										{ text: 'Frame', value: 'frame' },
										{ text: 'Frameless', value: 'frameless', selected: true }
									]}
						]
				}
			);*/
			
			if (imgElm) { // edit existing image display
				// Parse styles from img
				if (imgElm.style.marginLeft && imgElm.style.marginRight && imgElm.style.marginLeft === imgElm.style.marginRight) {
					data.hspace = removePixelSuffix(imgElm.style.marginLeft);
				}
				if (imgElm.style.marginTop && imgElm.style.marginBottom && imgElm.style.marginTop === imgElm.style.marginBottom) {
					data.vspace = removePixelSuffix(imgElm.style.marginTop);
				}
				if (imgElm.style.borderWidth) {
					data.border = removePixelSuffix(imgElm.style.borderWidth);
				}
	
				data.style = editor.dom.serializeStyle(editor.dom.parseStyle(editor.dom.getAttrib(imgElm, 'style')));
				// Advanced dialog shows general+advanced tabs
				win = editor.windowManager.open({
					title: 'Update image display properties',
					data: data,
					body: generalFormItems,
					onSubmit: onSubmitForm
				});
			} else { // new upload
				win = editor.windowManager.open({
					title: 'Upload and display file',
					data: data,
					bodyType: 'tabpanel',
					body: [
						{
							title: 'General',
							type: 'form',
							items: generalFormItems
						},
						{
							title: 'Image',
							type: 'form',
							pack: 'start',
							items: imageFormItems
						}
					],
					onSubmit: onSubmitForm
				});
			}
			return;
		});

	}
	

//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
	editor.on('preInit', function() {
		function hasImageClass(node) {
			var className = node.attr('class');
			return className && /\bimage\b/.test(className);
		}

		function toggleContentEditableState(state) {
			return function(nodes) {
				var i = nodes.length, node;

				function toggleContentEditable(node) {
					node.attr('contenteditable', state ? 'true' : null);
				}

				while (i--) {
					node = nodes[i];

					if (hasImageClass(node)) {
						node.attr('contenteditable', state ? 'false' : null);
						tinymce.each(node.getAll('figcaption'), toggleContentEditable);
					}
				}
			};
		}

		editor.parser.addNodeFilter('figure', toggleContentEditableState(true));
		editor.serializer.addNodeFilter('figure', toggleContentEditableState(false));
	});

	editor.addButton('image', {
		icon: 'image',
		tooltip: 'Insert/edit image',
		onclick: showDialog,
		stateSelector: 'img:not([data-mce-object],[data-mce-placeholder]),figure.image'
	});

	editor.addMenuItem('image', {
		icon: 'image',
		text: 'Image',
		onclick: showDialog,
		context: 'insert',
		prependToContext: true
	});

	editor.addCommand('mceImage', showDialog);
});
