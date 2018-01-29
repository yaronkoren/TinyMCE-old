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
/*global mw:true */

tinymce.PluginManager.add('wikiupload', function(editor) {

	var me = this,
		_srccontent,
		_userThumbsize = 3,
		_thumbsizes = ['120', '150', '180', '200', '250', '300'];
		
	_userThumbsize = _thumbsizes[ mw.user ? mw.user.options.get('thumbsize') : 3 ];

	var scriptPath = mw.config.get( 'wgScriptPath' );
	
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

	// display and process upload form
	function showDialog(dialogData) { 
		var format, pclass, win, data = {}, dom = editor.dom, imgElm, figureElm, srcType = 'File';
		var width, height, link, imageListCtrl, classListCtrl, dialogData = {};
		var imageDimensions = editor.settings.image_dimensions !== false;		
		var userMayUpload = true;
		var userMayUploadFromURL = false;

		//Check and process upload permissions
		function checkPermisionsOk() {
			if (mw.config.get( 'wgReadOnly' )) {
				editor.windowManager.alert(mw.config.get( 'wgReadOnly' ));
				return false;
			}
	
			if (!mw.config.get( 'wgEnableUploads' )) {
				editor.windowManager.alert("I'm sorry, uploads aren't enabled on this wiki");
				return false;
			}
	
			if (mw.config.get( 'wgTinyMCEUserIsBlocked' )) {
				editor.windowManager.alert("I'm sorry, you are not allowed to upload to this wiki");
				return false;
			}
	
			if (!mw.config.get( 'wgTinyMCEUserMayUpload' )) {
				userMayUpload = false;
//				editor.windowManager.alert("I'm sorry, you do not have permission to upload files on this wiki but you may still insert on this page a file which has previously been uploaded");
				return true;		
			}
	
			if (mw.config.get( 'wgTinyMCEUserMayUploadFromURL' )) {
				userMayUploadFromURL = true;;
				return true;
			}
			return false;
		}
		
		// check if files of with given extension are allowed to be uploaded
		function checkFileExtensionIsAllowed(extension) { 
			var checkFileExtensions = (mw.config.get( 'wgTinyMCECheckFileExtensions' )),
				strictFileExtensons = (mw.config.get( 'wgTinyMCEStrictFileExtensions' )), 
				allowedsFileExtensions = (mw.config.get( 'wgTinyMCEFileExtensions' )),  
				disallowedsFileExtensions = (mw.config.get( 'wgTinyMCEFileBlacklist' )),
				extensionAllowed;
			
			if (disallowedsFileExtensions) { 
				for (fileExtension in disallowedsFileExtensions) {
					if (disallowedsFileExtensions[fileExtension].toLowerCase() == extension.toLowerCase()) {
						return false;
					}
				}
			}

			extensionAllowed = true;
			if (checkFileExtensions) { 
				if (strictFileExtensons) {
					extensionAllowed = false;
					for (fileExtension in allowedsFileExtensions) {
						if (allowedsFileExtensions[fileExtension].toLowerCase() == extension.toLowerCase())
							extensionAllowed = true;
						}
					}
				}
			}
			return extensionAllowed;
		}
		
		function checkUploadDetail(uploadDetails, submittedData) {
			var message;
			if (typeof uploadDetails == "undefined") {
				showDialog(submittedData);
				message = "I'm sorry, you have encountered an unknown error trying to upload this file.  If this error persists please cntact your systems administrator";
				editor.windowManager.alert(message);
				return false;		
			} else if (typeof uploadDetails.error != "undefined") {
				showDialog(submittedData);
				message = "I'm sorry, you have encountered an error trying to upload to this wiki : " + uploadDetails.error.info + ". If this continues please contact your administrator";
				editor.windowManager.alert(message);
				return false;		
			} else if (typeof uploadDetails.warnings != "undefined") { // shouldn't get here as ignorewarnings currently set to true
				showDialog(submittedData);
				message = "I'm sorry, you have encountered a warning trying to upload to this wiki. If this continues please contact your administrator";
				editor.windowManager.alert(message);
				return false;		
			} else if (typeof uploadDetails.imageinfo != "undefined") {
				return uploadDetails.imageinfo.url
			}
		}
		
		// cleans submitted data to ensure all datatypes are valid
		function cleanSubmittedData(submittedData) {
			if (!submittedData.type) submittedData.type = '';
			if (!submittedData.src) submittedData.src = '';
			if (!submittedData.alternatesrc) submittedData.alternatesrc = '';
			if (!submittedData.summary) submittedData.summary = '';
			if (!submittedData.alt) submittedData.alt = '';
			if (!submittedData.link) submittedData.link = '';
			if (submittedData.width === '') submittedData.width = null;
			if (submittedData.height === '') submittedData.height = null;
			if (!submittedData.horizontalalignment) submittedData.horizontalalignment = '';
			if (!submittedData.verticalalignment) submittedData.verticalalignment = '';
			if (!submittedData.format) submittedData.format = '';
			return submittedData;
		}
		
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

		function recalcSize() {
			var widthCtrl = win.find('#width')[0], 
				heightCtrl = win.find('#height')[0],
				dimensions = [], 
				newWidth, 
				newHeight;

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

			dimensions['width'] = newWidth;
			dimensions['height'] = newHeight;
			return dimensions;
		}

		function updateStyle() {
			function addPixelSuffix(value) {
				if (value.length > 0 && /^[0-9]+$/.test(value)) {
					value += 'px';
				}

				return value;
			}

//DC always have the advtab leave for now incase want to repurpos?
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
					if (typeof data.query == "undefined") {
						fileDetails = JSON.parse(data)
					} else if (typeof data.query.pages != "undefined") {
						var pages = data.query.pages;
						for( var page in pages ) {
							if ((typeof pages[page].missing == "undefined") && (typeof pages[page].invalid == "undefined") ) {
								var pageTitle = pages[page].title
								var imageInfo = pages[page].imageinfo;
								var imageURL = imageInfo[0].url;
								if (pageTitle.replace("_"," ").toLowerCase() == fileName.replace("_"," ").toLowerCase()) {
									fileDetails = imageURL;
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

		// called when the type of the file upload is changed
		function typeChange(e) {
			var typeCtrl = win.find('#type')[0],
				srcCtrl = win.find('#src')[0],
				alternateSrcCtrl = win.find('#alternatesrc')[0],
				destCtrl = win.find('#dest')[0]
				summaryCtrl = win.find('#summary')[0],
				dummySummaryCtrl = win.find('#dummySummary')[0],
				sourceType = typeCtrl.value();
				
			if (sourceType == 'File') {			// local Fle upload
				// enable filpicker and summary input
				alternateSrcCtrl.visible(false);				
				srcCtrl.visible(true);
				dummySummaryCtrl.visible(false);				
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
				dummySummaryCtrl.visible(false);				
				summaryCtrl.visible(true);
			} else if (sourceType == 'Wiki') {	// file already uploaded to wiki
				// disable file pickker and summary inpt
				srcCtrl.visible(false);
				alternateSrcCtrl.visible(true);				
				summaryCtrl.visible(false);
				dummySummaryCtrl.visible(true);				
			}
			return;
		}

		// called when the source for the upload changes
		function srcChange(e) {

			var typeCtrl = win.find('#type')[0],
				srcCtrl = win.find('#src')[0],
				alternateSrcCtrl = win.find('#alternatesrc')[0],
				destCtrl = win.find('#dest')[0]
				summaryCtrl = win.find('#summary')[0],
				dummySummaryCtrl = win.find('#dummySummary')[0];
				
			var sourceType = typeCtrl.value(),
				srcURL, 
				prependURL,
				absoluteURLPattern, 
				meta = e.meta || {};
		
			if ((sourceType == 'File') || (sourceType == 'URL')) {	//Pre process local file upload
				if (sourceType == 'File') {
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
					this.value(srcURL); //reset the value of this field to the propper src name which is striped of its path
				} else { // type is URL
					srcURL = alternateSrcCtrl.value(); 
					srcURL = srcURL.split('/').pop().split('#')[0].split('?')[0];					
				}

//TODO check what this next bit does or doesn't do
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
			} else if (sourceType == 'Wiki') {	//Pre process display file already uploaded to wiki
				srcURL = alternateSrcCtrl.value(); 
			}

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
				dummySummaryCtrl = win.find('#dummySummary')[0],
				sourceType = typeCtrl.value();
				destinationFile = 'File:' + destCtrl.value();
				
			var destinationFileDetails,
				file,
				extension,	
				extensionAllowed;

			// see if file already on wiki and return details if it is
			$.when(getFileDetailsFromWiki(destinationFile), $.ready).then( function(a1){
				destinationFileDetails = a1;
			});
			
			// encountered an error trying to access the api	
			if (typeof destinationFileDetails.error != "undefined") {
					editor.windowManager.alert("I'm sorry, there seems to be a problem accessing the wiki from this dialog.  If the problem persists try logging off and on again");	
					srcCtrl.focus();
					return;
			}			

			if (sourceType == 'File' || sourceType == 'URL') { // file is to uploaded
				if (destinationFileDetails) { // file of this name already exists on this wiki
					editor.windowManager.confirm("The destination file already exists on this wiki.  Select Ok if you would like to use the existing file or select Cancel and enter a different destination filename for this upload",
						function(ok) {
							  if (ok) {
								  typeCtrl.value('Wiki');
								  alternateSrcCtrl.value(destCtrl.value());	
								  // disable file pickker and summary inpt
								  srcCtrl.visible(false);
								  alternateSrcCtrl.visible(true);				
								  summaryCtrl.visible(false);
								  dummySummaryCtrl.visible(true);
								  destCtrl.focus();
							  } else {
								  destCtrl.value('');
								  destCtrl.focus();
							  }
						});

/* Experimental to show html in a popup window doesn't work


var dialogBody = '<p>Whatever <b>you</b> want here</p>';

editor.windowManager.open({
    title: 'Destination File Exists',
    html: dialogBody,
    buttons: [{
        text: 'Ok',
        subtype: 'primary',
        onclick: function() {
								  typeCtrl.value('Wiki');
								  alternateSrcCtrl.value(destCtrl.value());	
								  // disable file pickker and summary inpt
								  srcCtrl.visible(false);
								  alternateSrcCtrl.visible(true);				
								  summaryCtrl.visible(false);
								  dummySummaryCtrl.visible(true);
            (this).parent().parent().close();
        }
    },
    {
        text: 'Cancel',
        onclick: function() {
								  destCtrl.value('');
            (this).parent().parent().close();
        }
    }]
});*/
					destCtrl.focus();
					return;
				} else { // check if files of this type allowed to be uploaded?
					file = destinationFile.split('/').pop().split('#')[0].split('?')[0];
					extension = file.split('.').pop();
					extensionAllowed = checkFileExtensionIsAllowed(extension);
					if (!extensionAllowed) {
							editor.windowManager.alert("I'm sorry, you are not allowed to upload files of this type to this wiki. Please choose a file of a different type");	
							srcCtrl.focus();
							srcCtrl.value('');
							destCtrl.value('');
							return;
					}
				}
			} else if (sourceType == 'Wiki') {
				if (!destinationFileDetails) {
					editor.windowManager.confirm("The file does not exist on this wiki.  Select Ok if you would like to upload a new file or select Cancel and enter a different filename for this link",
						function(ok) {
							if (ok) {
								typeCtrl.value('File');
								srcCtrl.value('');
								// enable filpicker and summary input
								alternateSrcCtrl.visible(false);				
								srcCtrl.visible(true);
								dummySummaryCtrl.visible(false);				
								summaryCtrl.visible(true);
								destCtrl.value('');
							} else {
								srcCtrl.value('');
								destCtrl.value('');
							}
						});
					srcCtrl.focus();
				} else {
					alternateSrcCtrl.value(destinationFileDetails);
				}
			}
			return;
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
		
		function displayForm(dialogData) {
			// set up defaults using previously enterred data if any
			if (!dialogData.type) dialogData.type = 'File';
			if (!dialogData.src) dialogData.src = '';
			if (!dialogData.dest) dialogData.dest = dialogData.src;
			if (!dialogData.summary) dialogData.summary = '';
			if (!dialogData.link) dialogData.link = '';
			if (!dialogData.alt) dialogData.alt = '';
			if (dialogData.constrain != false) dialogData.constrain = true;
			if (!dialogData.width) dialogData.width = null;
			if (!dialogData.height) dialogData.height = null;
			if (!dialogData.horizontalalignment) dialogData.horizontalalignment = 'right';
			if (!dialogData.verticalalignment) dialogData.verticalalignment = 'middle';
			if (!dialogData.format) dialogData.format = 'thumb';
	
			if (imgElm) { //Populate form with details of existing upload
				dialogData.type = 'Wiki';
				dialogData.src = dom.getAttrib(imgElm, 'src').split('/').pop().split('#')[0].split('?')[0];
				if (dialogData.src == 'false') dialogData.src = '';
				dialogData.dest = '';
				dialogData.summary = '';
				dialogData.link = dom.getAttrib(imgElm, 'data-bs-link');
				if (dialogData.link == 'false') dialogData.link = '';
				dialogData.alt = dom.getAttrib(imgElm, 'data-bs-alt');
				if ( dialogData.alt == 'false') dialogData.height = '';				
				if (dialogData.constrain != false) dialogData.constrain = true;
				dialogData.width = dom.getAttrib(imgElm, 'data-bs-sizewidth');
				if ( dialogData.width == 'false') dialogData.width = null;				
				dialogData.height = dom.getAttrib(imgElm, 'data-bs-sizeheight');
				if ( dialogData.height == 'false') dialogData.height = null;				
				dialogData.horizontalalignment = dom.getAttrib(imgElm, 'data-bs-align');
				if ( dialogData.horizontalalignment == 'false') dialogData.horizontalalignment = null;				
				dialogData.verticalalignment = dom.getAttrib(imgElm, 'data-bs-verticalalign');
				if ( dialogData.verticalalignment == 'false') dialogData.verticalalignment = null;				
				dialogData.format = dom.getAttrib(imgElm, 'data-bs-format');
				if ( dialogData.format == 'false') dialogData.format = null;				
			}
	
			// setup the list of upload types according to user permissions
			var typelist = [];
			if (userMayUpload) {
				typelist.push({text: mw.msg("tinymce-upload-type-label-file"), value: "File"});
				if (userMayUploadFromURL) {
					typelist.push({text: mw.msg("tinymce-upload-type-label-url"), value: "URL"});
				}
			}
			typelist.push({text: mw.msg("tinymce-upload-type-label-wiki"), value: "Wiki"});
			if (!userMayUpload) dialogData.type = "Wiki";
			
			//setup the form controls
			
			typeListCtrl = {
				name: 'type',
				type: 'listbox',
				autofocus: true,
				label: mw.msg("tinymce-upload"),
				value: dialogData.type,
				onselect: typeChange,
				tooltip: mw.msg("tinymce-upload-type-tooltip"),
				values: typelist,
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
						style: "position: absolute; top: 0; left: 0",
						onchange: srcChange,
						onbeforecall: onBeforeCall,
						visible: !userMayUpload},
					{name: 'src', 
						type: 'filepicker',
						filetype: 'image',
						style: "position: absolute; top: 0; right: 0",
						value: dialogData.src,
						onchange: srcChange,
						onbeforecall: onBeforeCall,
						visible: userMayUpload},
				]
			};
	
			srcTextDisplay = {
				name: 'src',
				type: 'textBox',
				value: dialogData.src,
				label: 'Source',
				disabled: true,
			};
	
			destTextCtrl = {
				name: 'dest', 
				type: 'textbox', 
				value: dialogData.dest,
				label: 'Destination File Name',
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
					{name: 'dummySummary', 
						type: 'textbox', 
						multiline: 'true',
						style: "background: #f0f0f0; position: absolute; width: 100%; height: 100%; top: 0; left: 0",
						disabled: true,
						visible: false},
					{name: 'summary', 
						type: 'textbox', 
						multiline: 'true',
						value: dialogData.summary,
						style: "position: absolute; width: 100%; height: 100%; top: 0; right: 0",
						visible: true},
				]
			};
			
			linkTextCtrl = {
				label: 'Link To',
				name: 'link',
				type: 'textbox',
				value: dialogData.link,
			};
	
			altTextCtrl = {
				name: 'alt', 
				type: 'textbox', 
				label: 'Alternative Text',
				value: dialogData.alt,
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
						checked: dialogData.constrain, 
						onchange: constrainChange, 
						text: 'Constrain proportions'},
					{name: 'width', 
						type: 'textbox',
						value: dialogData.width, 
						maxLength: 5, 
						size: 3, 
//						onchange: recalcSize, 
						label: 'W',
//						ariaLabel: 'Width'
						},
					{type: 'label', 
						text: 'x'},
					{name: 'dummyheight', 
						type: 'textbox', 
						maxLength: 5, 
						size: 3, 
						style: "background: #f0f0f0",
						disabled: true,
						visible: true,
						label: 'H',
//						ariaLabel: 'DummyHeight'
					},
					{name: 'height', 
						type: 'textbox', 
						value: dialogData.height, 
						maxLength: 5, 
						size: 3, 
//						onchange: recalcSize, 
						visible: false,
						label: 'H',
//						ariaLabel: 'Height'
					},
				]
			};
	
			verticalAlignListCtrl = {
				type   : 'listbox',
				name   : 'verticalalignment',
				label  : 'Vertical Alignment',
				value  : dialogData.verticalalignment,
				values : 
					[
						{ text: 'Middle', value: 'middle' },
						{ text: 'Top', value: 'top' },
						{ text: 'Bottom', value: 'bottom' },
						{ text: 'Baseline', value: 'baseline' },
						{ text: 'Sub', value: 'sub' },
						{ text: 'Super', value: 'super' },
						{ text: 'Text top', value: 'text-top' },
						{ text: 'Text bottom', value: 'text-bottom'}
					]
			};
	
			horizontalAlignListCtrl = {
				type   : 'listbox',
				name   : 'horizontalalignment',
				label  : 'Horizontal Alignment',
				value  : dialogData.horizontalalignment,
				values : 
					[
						{ text: 'Left', value: 'left' },
						{ text: 'Centre', value: 'center' },
						{ text: 'Right', value: 'right' },
						{ text: 'None', value: 'none'}
					]
			};
	
			formatListCtrl = {
				type   : 'listbox',
				name   : 'format',
				label  : 'Format',
				value  : dialogData.format,
				values : 
					[
						{ text: 'Thumb', value: 'thumb' },
						{ text: 'Border', value: 'border' },
						{ text: 'Frame', value: 'frame' },
						{ text: 'Frameless', value: 'frameless'}
					]
			};
	
			if (imgElm) { // editing an existing image node
		
				var generalFormItems = [
					srcTextDisplay,
					linkTextCtrl,
					altTextCtrl,
					imageDimensionsCtrl,
					verticalAlignListCtrl,
					horizontalAlignListCtrl,
					formatListCtrl
				];
				
			} else { // new upload from local file store or url
				var generalFormItems = [
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
			
			if (imgElm) { // edit existing image display
				// Parse styles from img
/*				if (imgElm.style.marginLeft && imgElm.style.marginRight && imgElm.style.marginLeft === imgElm.style.marginRight) {
					data.hspace = removePixelSuffix(imgElm.style.marginLeft);
				}
				if (imgElm.style.marginTop && imgElm.style.marginBottom && imgElm.style.marginTop === imgElm.style.marginBottom) {
					data.vspace = removePixelSuffix(imgElm.style.marginTop);
				}
				if (imgElm.style.borderWidth) {
					data.border = removePixelSuffix(imgElm.style.borderWidth);
				}*/
	
	
				data.style = editor.dom.serializeStyle(editor.dom.parseStyle(editor.dom.getAttrib(imgElm, 'style')));
	
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
		}
		
		function onSubmitForm(e) {
			var submittedData = win.toJSON();

			var figureElm,
				oldImg,
				style,
				nodeID,
				uploadDetails,
				uploadSrc,
				fileType,
				fileContent,
				fileName,
				fileSummary,
				uploadDetails;

			function doUpload(fileType, fileToUpload, fileName, fileSummary){
				uploadData = new FormData();
				uploadData.append("action", "upload");
				uploadData.append("filename", fileName);
				uploadData.append("text", fileSummary);
				uploadData.append("token", mw.user.tokens.get( 'editToken' ) );
//				uploadData.append("ignorewarnings", true );
				if (fileType == 'File') uploadData.append("file", fileToUpload);
				if (fileType == 'URL') uploadData.append("url", fileToUpload);
				uploadData.append("format", 'json');
				var url = mw.config.get( 'wgScriptPath' ) + '/api.php';
				var uploadDetails;
				//as we now have created the data to send, we send it...
				$.ajax( { //http://stackoverflow.com/questions/6974684/how-to-send-formdata-objects-with-ajax-requests-in-jquery
					url: url, //url to api.php 
					contentType:false,
					processData:false,
					type:'POST',
					async: false,
					data: uploadData,//the formdata object we created above
					success:function(data){
						uploadDetails = data.upload;
						//do what you like, console logs are just for demonstration :-)
						console.log("success!");
						console.log(data);
					},
					error:function(xhr,status, error){
		
						console.log(error)
					}
				});
				return uploadDetails;
			}
			
			// have to have a destnation name unless editing previous upload		
			if (!submittedData.dest && !imgElm) { 
				submittedData.dest = '';
				showDialog(submittedData);
				editor.windowManager.alert("I'm sorry, you have to provide a destination file name. If this field was blank it is probably because the filename corresponding to the source file has already been used.  Please enter a different one");
				return;
			}
			
			submittedData = cleanSubmittedData(submittedData);
			dimensions = recalcSize();
			width = dimensions['width'];
			height = dimensions['height'];
			style = updateStyle();
			uploadDetails = [];
			uploadSrc = '';
			if (imgElm) {		//Editing image node so skip upload
				nodeID = imgElm.id
				uploadSrc = imgElm.src;
			} else {
				if ((submittedData.type == 'File') || (submittedData.type == 'URL')) {
					if (submittedData.type == 'File') {
						fileContent = _srccontent;				
					} else {
						fileContent = submittedData.alternatesrc;						
					}
					nodeID = "TinyMCE" + (Math.floor((Math.random() * 100000) + 100000));
					fileType = submittedData.type;
					fileName = submittedData.dest;
					fileSummary = submittedData.summary;
					if ((fileContent) && (fileName)) {
// TODO test uploadSrc for errors and warnings and process accordingly
						uploadDetails = doUpload(fileType, fileContent, fileName, fileSummary);
						uploadSrc = checkUploadDetail(uploadDetails, submittedData);
						if (!uploadSrc) {
							return;
						}
				  	} else {
						editor.windowManager.alert("I'm sorry, you there's a problem with either the source or destination being undefined.  Please check and try again");
						return;
					}
				} else if (submittedData.type == 'Wiki') {
					fileName = submittedData.dest;
					uploadSrc = submittedData.alternatesrc;
				}
			}

			//set up node data for inserting or updating in editor window
			var data = {
				src: uploadSrc,
				alt: submittedData.alt,
				width: width,
				height: height,
				link: submittedData.link,
				horizontalalignment: submittedData.horizontalalignment,
				verticalalignment: submittedData.verticalalignment,
				format: submittedData.format,
				style: style,
				contentEditable: 'false',
				id: nodeID,
				"data-bs-src": uploadSrc,
				"data-bs-link": submittedData.link,
				"data-bs-alt": submittedData.alt,
				"data-bs-sizewidth": width,
				"data-bs-sizeheight": height,
				"data-bs-align": submittedData.horizontalalignment,
				"data-bs-verticalalign": submittedData.verticalalignment,
				"data-bs-format": submittedData.format
			};
			
			if (imgElm) { //update existing node
//TODO if there is a link check if its changed and process accordingly
				editor.undoManager.transact(function(){
					editor.focus();
//					editor.dom.setAttribs(editor.dom.get(nodeID),data);
					editor.dom.setAttribs(imgElm,data);
					editor.undoManager.add();
				});
				editor.selection.select(imgElm);
				editor.nodeChanged();
			} else { //create new node
				var el = editor.dom.create('img', data);
				if (submittedData.link) {
					el = editor.dom.create('a', {href: submittedData.link}, el);
				}
				editor.undoManager.transact(function(){
					editor.focus();
					editor.selection.setNode(el);
					editor.undoManager.add();
				});
			}
		}

		// abort if permissions not Ok
		if (!checkPermisionsOk()) return;
		
		imgElm = editor.selection.getNode();
		figureElm = dom.getParent(imgElm, 'figure.image');
		
		// if node is a link to an image then get the image
		if (figureElm) {
			imgElm = dom.select('img', figureElm)[0];
		}

		// test if we are modifying an existing upload else set to null
		if (imgElm && (imgElm.nodeName != 'IMG' || imgElm.getAttribute('data-mce-object') || imgElm.getAttribute('data-mce-placeholder'))) {
			imgElm = null;
		}

		displayForm(dialogData);

		return;
	}
	
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

	editor.addButton('wikiupload', {
		icon: 'upload',
		tooltip: 'Upload/edit file',
		onclick: showDialog,
		stateSelector: 'img:not([data-mce-object],[data-mce-placeholder]),figure.image'
	});

	editor.addMenuItem('wikiupload', {
		icon: 'upload',
		text: 'Upload/edit file',
		onclick: showDialog,
		context: 'upload',
		prependToContext: true
	});

	editor.addCommand('mceImage', showDialog);
});
