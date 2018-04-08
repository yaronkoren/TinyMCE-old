/**
 * TinyMCE extension
 *
 * Wiki code to HTML and vice versa parser
 *
 * @author     Markus Glaser <glaser@hallowelt.com>
 * @author     Sebastian Ulbricht
 * @author     Duncan Crane <duncan.crane@aoxomoxoa.co.uk>
 * @copyright  Copyright (C) 2016 Hallo Welt! GmbH, All rights reserved.
 * @license    http://www.gnu.org/copyleft/gpl.html GNU Public License v2 or later
 * @filesource
 */

/*global tinymce:true */
/*global mw:true */
/*global BlueSpice:true */

var MwWikiCode = function() {

	"use strict";
	var
		/**
		 *
		 * @type Array
		 */
		_preTags,
		/**
		 *
		 * @type Array
		 */
		_preTagsSpace,
		/**
		 *
		 * @type Array
		 */
		_nowikiTags,
		/**
		 *
		 * @type Array
		 */
		_templates4Html,
		/**
		 *
		 * @type Array
		 */
		_images,
		/**
		 *
		 * @type Array
		 */
		_comments,
		/**
		 *
		 * @type Array
		 */
		_specialTagsList,
		/**
		 *
		 * @type Array
		 */
//		_switches4Html,
		/**
		 *
		 * @type Array
		 */
		_tags4Html,
		/**
		 *
		 * @type Array
		 */
		_tags4Wiki,
		/**
		 *
		 * @type Array
		 */
		_templates4Wiki,
		/**
		 *
		 * @type Array
		 */
		_htmlEntities4Wiki,
		/**
		 * List of available thumbnail sizes
		 * @type Array
		 */
		_thumbsizes = ['120', '150', '180', '200', '250', '300'],
		/**
		 * One of the thumbnail sizes, choosen by the user in Special:Preferences
		 * @default 3
		 * @type Number
		 */
		_userThumbsize = 3,
		/**
		 *
		 * @type Boolean
		 */
		_processFlag = false,
		/**
		 * Used for numbering external links with no label
		 * @type Number
		 */
		_externalLinkNo = 1,
		/**
		 *
		 * @type TinyMCE
		 */
		_ed = null,
		_useNrnlCharacter,
		_slb,
		_scriptPath;

	var me = this;

//	_userThumbsize = _thumbsizes[ mw.user ? mw.user.options.get('thumbsize') : _userThumbsize ];
	

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
			link: false,
			sizewidth: false,
			sizeheight: false,
			class: ''
		};
	};

	this.makeDefaultImageAttributesObject = function() {
		return {
			'class': "mw-image",
			'border': 0,
			//'width': _userThumbsize,
			//HAD: display:inline-block; //Future: only CSS class
			'style':"cursor:move;"
		};
	};

	function _makeDataAttributeObject( obj ) {
		var data = {};
		for ( var property in obj ) {
			data['data-mw-'+property] = obj[property];
		}
		return data;
	}

	String.prototype.format = function () {
		var args = arguments;
		return this.replace(/{(\d+)}/g, function(match, number) {
			return typeof args[ number ] !== 'undefined' ? args[number] : match;
		});
	};

	function print_r(printthis, returnoutput) {
		var output = '';

		if ($.isArray(printthis) || typeof(printthis) == 'object') {
			for(var i in printthis) {
				output += i + ' : ' + print_r(printthis[i], true) + '\n';
			}
		} else {
			output += printthis;
		}
		if (returnoutput && returnoutput == true) {
			return output;
		} else {
			alert(output);
		}
	}
	
	// get details of file already uploaded to wiki including url
	function getPageDetailsFromWiki(fileName) {
		var queryData,
			url = _scriptPath + '/api.php',
			fileDetails = new Array();
				
		queryData = new FormData();
		queryData.append("action", "query");
		queryData.append("prop", "imageinfo");
		queryData.append("iiprop", "url");
		queryData.append("titles", fileName);
		queryData.append("format", "json");
		
		//as we now have created the data to send, we send it...
		$.ajax( { //http://stackoverflow.com/questions/6974684/how-to-send-formdata-objects-with-ajax-requests-in-jquery
			url: url, //url to api.php
			contentType:false,
			processData:false,
			type:'POST',
			data: queryData,
			async: false,
			success:function(data){
				var reason,
					message,
					title,
					imageInfo,
					imageURL,
					pages,
					page;
				if (typeof data.query == "undefined") {
					fileDetails = JSON.parse(data)
				} else if (typeof data.query.pages != "undefined") {
					pages = data.query.pages;
					for( page in pages ) {
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
								fileDetails["error"] = message;
							}
						} else {
							title = pages[page].title;
							imageInfo = pages[page].imageinfo;
							if (typeof imageInfo == "undefined") {
								imageURL = title;
							} else {
								imageURL = imageInfo[0].url;
							}
							if (title.replace(/_/g," ").toLowerCase() == fileName.replace(/_/g," ").toLowerCase()) {
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

	function _image2html(aLink) {
		// @todo inline stylings taken from MediaWiki and adapted to TinyMCE markup. Not nice...
		var htmlImageObject = $('<img />').attr( me.makeDefaultImageAttributesObject() ),
			wikiImageObject = me.makeWikiImageDataObject(),
			parts,
			part = '',
			unsuffixedValue, dimensions, kvpair, key, value, src, imgParts,
			imgName, imageFileDetails;

		// remove brackets and split into patrts
		parts = aLink.substr(2, aLink.length - 4).split("|"); 

		wikiImageObject.imagename = parts[0];
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

			if ($.inArray(part, ['thumb']) !== -1) {
				wikiImageObject.thumb = true;
				continue;
			}

			if ($.inArray(part, ['right']) !== -1) {
				wikiImageObject.left = false;
				wikiImageObject.right = true;
				wikiImageObject.align = 'right';
				continue;
			}

			if ($.inArray(part, ['left']) !== -1) {
				wikiImageObject.right = false;
				wikiImageObject.left = true;
				wikiImageObject.align = 'left';
				continue;
			}

			if ($.inArray(part, ['center']) !== -1) {
				wikiImageObject.right = false;
				wikiImageObject.left = false;
				wikiImageObject.center = true;
				wikiImageObject.align = 'center';
				continue;
			}

			if ($.inArray(part, ['middle']) !== -1) {
				wikiImageObject.middle = true;
				wikiImageObject.verticalalign = 'middle';
				continue;
			}

			if ($.inArray(part, ['top']) !== -1) {
				wikiImageObject.top = true;
				wikiImageObject.verticalalign = 'top';
				continue;
			}

			if ($.inArray(part, ['bottom']) !== -1) {
				wikiImageObject.bottom = true;
				wikiImageObject.verticalalign = 'bottom';
				continue;
			}

			if ($.inArray(part, ['baseline']) !== -1) {
				wikiImageObject.baseline = true;
				wikiImageObject.verticalalign = 'baseline';
				continue;
			}

			if ($.inArray(part, ['sub']) !== -1) {
				wikiImageObject.sub = true;
				wikiImageObject.verticalalign = 'sub';
				continue;
			}

			if ($.inArray(part, ['super']) !== -1) {
				wikiImageObject.super = true;
				wikiImageObject.verticalalign = 'super';
				continue;
			}

			if ($.inArray(part, ['text-top']) !== -1) {
				wikiImageObject.textTop = true;
				wikiImageObject.verticalalign = 'text-top';
				continue;
			}

			if ($.inArray(part, ['text-bottom']) !== -1) {
				wikiImageObject.textBottom = true;
				wikiImageObject.verticalalign = 'text-bottom';
				continue;
			}

			if ($.inArray(part, ['none']) !== -1) {
				wikiImageObject.none = true;
				continue;
			}

			if ($.inArray(part, ['frame']) !== -1) {
				wikiImageObject.frame = true;
				continue;
			}

			if ($.inArray(part, ['frameless']) !== -1) {
				wikiImageObject.frameless = true;
				continue;
			}

			if ($.inArray(part, ['border']) !== -1) {
				wikiImageObject.border = true;
				wikiImageObject.mwborder = true;
				continue;
			}

			kvpair = part.split('=');
			if (kvpair.length === 1) {
				wikiImageObject.caption = part; //hopefully
				continue;
			}

			key = kvpair[0];
			value = kvpair[1];

			if ($.inArray(key, ['link']) !== -1) {
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

			if ($.inArray(key, ['upright']) !== -1) {
				wikiImageObject.upright = value;
				continue;
			}

			if (key === 'alt') {
				wikiImageObject.alt = value;
				continue;
			}
		}

		if (wikiImageObject.alt) {
			htmlImageObject.attr('alt', wikiImageObject.alt);
		}

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
		htmlImageObject.attr('data-mw-wikitext', encodeURI(aLink));

		// see if file already on wiki and return details if it is
/*		$.when(getPageDetailsFromWiki(parts[0]), $.ready).then( function(a1){
			src = a1;
		});*/
		src = getPageDetailsFromWiki(parts[0]);
		// encountered an error trying to access the api
		// set src to filename instead of url on wiki
		if (typeof src.error != 'undefined' ) {
			return src;
		}
		
		// image
		if (src) {
			htmlImageObject.attr('src', src);
		}

		// make contenteditable false so image can be selected correctly
		htmlImageObject.attr('contentEditable', false);
		htmlImageObject.attr('id',"<@@@IMG" + (Math.floor((Math.random() * 100000) + 100000)) + "@@@>");

		//Create linked images
		if (wikiImageObject.link !== false) {
			htmlImageObject.wrap('<a style="display:inline-block"></a>'); //IE needs closing tag
			htmlImageObject = htmlImageObject.parent();
			htmlImageObject.attr('href', wikiImageObject.link);
		}

		return htmlImageObject[0].outerHTML;
	}

	function _image2wiki(text) {
		var image, imageHTML, htmlImageObject, wikiImageObject,
			attributes, attribute, wikiText, imageCaption,
			size, property, value;

		var images = text.match(/(<a([^>]*?)>)?<img([^>]*?)\/?>(<\/a>)?/gi);
		if (!images)
			return text;

		for (var i = 0; i < images.length; i++) {
			image = images[i];
			htmlImageObject = $(image);
			wikiImageObject = {};

			//process if link
			if (htmlImageObject[0].nodeName.toUpperCase() === 'A') {
				wikiImageObject.link = htmlImageObject.attr('href');
				htmlImageObject = htmlImageObject.find('img').first();
			}

			attributes = htmlImageObject[0].attributes;
			// populate the wiki image object attributes
			// strip the data-mw prefix from attribute names
			for (var j = 0; j < attributes.length; j++) {
				attribute = attributes[j].name;
				if (attribute.startsWith('data-mw-') === false) {
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
		}

		return text;
	}

	function _links2html(text) {

		var links, 
			link, 
			linkNoWrap, 
			linkParts, 
			linkTarget, 
			linkLabel, 
			linkHtml,
			targetParts, 
			fileExtension, 
			targetTextParts, 
			nsText, 
			nsId,
			linkTargetParts, 
			protocol, 
			namespaces = mw.config.get( 'wgNamespaceIds' ),
			anchorFormat = '<a href="{0}" data-mce-href="{5}" title="{6}" data-mw-type="{2}" class="{3}" data-mw-wikitext="{4}" contenteditable= "false" >{1}<div class="mceNonEditableOverlay"></div></a>',
			squareBraceDepth = 0,
			linkDepth = 0,
			linkStart = 0,
			curlyBraceFirst = false,
			tempLink = '',
			linkClass,
			linkTitle,
			pageDetails,
			internalLinks = new Array(),
			externalLinks = new Array(),
			checkedBraces = new Array(),
			pos = 0,
			urlProtocolMatch = "/^" + mw.config.get( 'wgUrlProtocols' ) + "/i";
		
		urlProtocolMatch = urlProtocolMatch.replace(/\|/g,"|^");
		for (pos = 0; pos < text.length; pos++) {
			if (text[pos] === '[') {
				squareBraceDepth++;
				linkStart = pos;

				// check to see if an internal link eg starts with [[
				if (text[pos + 1] === '[') {
					pos = pos + 2;
					squareBraceDepth++;
					for (pos = pos; pos < text.length; pos++) {
						if (text[pos] === '[') {
							squareBraceDepth++;
						} else if (text[pos] === ']') {
							if (squareBraceDepth == 2) {
								// checking for closure of internal link eg ]]
								// if not then dont decrement depth counter
								// otherwise won't be able to match closure
								if (text[pos + 1] === ']') {
									pos = pos +1;
									squareBraceDepth = 0;
									tempLink = text.substring(linkStart,pos + 1)
									internalLinks[tempLink] = tempLink;
									break;
								}
							} else {
								squareBraceDepth--;
							}	
						}
					}
				// else process external link as only single [
				} else {
					pos = pos + 1;
					for (pos = pos; pos < text.length; pos++) {
						if (text[pos] === '[') {
							squareBraceDepth++;
						} else if (text[pos] === ']') {
							if (squareBraceDepth == 1) {
								// checking for closure of external link eg ]
								pos ++;
								squareBraceDepth = 0;
								tempLink = text.substring(linkStart,pos)
								if (tempLink.substr(1,tempLink.length - 2).match(urlProtocolMatch) ||
									tempLink.substr(1,2) === "//" ) {
									externalLinks[tempLink] = tempLink;
								}
								break;
							} else {
								squareBraceDepth--;
							}	
						}
					}					
				}
			}
		}

		// replace internal wiki links with html
		if (Object.keys(internalLinks).length > 0) {
			for (var aLink in internalLinks) {
				link = aLink.substr(2, aLink.length - 4);
				linkParts = link.split("|");
				linkTarget = linkParts[0];
				linkLabel = linkParts[0];
				// FS#134: Cleanup specials within Link
				linkTarget = linkTarget.replace(/\<.*?\>/g, "");
				if (linkParts.length > 1) {
					// Links of the form [[Test|]] . Uses trim to cope with whitespace
					if ( (linkParts[1].trim() === "") ) {
						linkLabel = linkTarget.replace(/(.*:)?([^,\(]*)(.*)/, "$2");
					} else {
						linkLabel = linkParts[1];
					}
				}

				linkClass = 'link internal mw-internal-link mceNonEditable';
				linkTitle = linkTarget;

				// check page exists on wiki
				pageDetails = getPageDetailsFromWiki(linkTarget);
				
				// if wiki page doesn't exist then treat as red link
				if (typeof pageDetails.error != 'undefined' ) {
					linkClass += ' new' ;
					linkTitle += " (" + pageDetails.error + ")";
				}
				
				// create the html for the wiki link
				linkHtml = anchorFormat.format(
					encodeURI( linkTarget ),//escape(linkTarget),	// href
					linkLabel,				// <a>linkLabel</a>
					'internal_link',		// data-mw-type
					linkClass,				// class
					encodeURI( aLink ),	// data-mw-wikitext
					encodeURI( linkTarget ),// data-mce-href
					linkTitle				// title
				);

				// if the wiki page exists and it is to a media file create image html
				if (typeof pageDetails.error == 'undefined' ) {
					targetParts = linkTarget.split(":");
					if (targetParts.length > 1) {
						nsText = targetParts[0];
						nsId = namespaces[nsText.toLowerCase()];
						if (nsId === 6) {
							linkHtml = _image2html(aLink);
						}
					}
				}

				link = link.replace( "@@PIPE@@", "|" );
				text = text.replace("[[" + link + "]]", linkHtml);
			}
		}

		// replace external wiki links with html
		if (Object.keys(externalLinks).length > 0) {
			for (var aLink in externalLinks) {
				link = aLink.substr(1, aLink.length - 2);
				linkNoWrap = aLink.substr(1, aLink.length - 2);

				link = linkNoWrap.replace(/^\s+|\s+$/gm,'');
				linkParts = link.split(" ");
				linkTarget = linkParts[0];
				linkLabel = linkParts[0];

				//FS#134: Cleanup specials within Link
				linkTarget = linkTarget.replace(/\<.*?\>/g, "");
				//"http://", "https://", "ftp://", "mailto:", "//", ...
				linkTargetParts = linkTarget.split( ':' ); //Detect protocol
				protocol= 'none';
				if( linkTargetParts.length > 1){
					protocol = linkTargetParts[0];
				} else if (linkTarget.substr(0,2) = '//' ) {
					protocol = '//';
				}

				if (linkParts.length > 1) {
					linkParts.shift();
					linkLabel = linkParts.join(" ");
				} else {
					linkLabel = "[" + _externalLinkNo + "]";
					_externalLinkNo++;
				}

				linkHtml = anchorFormat.format(
					encodeURI( linkTarget.replace( /%20/g, ' ' ) ),	// href
					linkLabel,					// <a>linkLabel</a>
					'external_link',			// data-mw-type
					'link external mw-external-link mceNonEditable',// class
					encodeURI( aLink ),	// data-mw-wikitext
					encodeURI( linkTarget.replace( /%20/g, ' ' ) ),	// data-mce-href
					$( '<div/>' ).text( linkLabel ).html()	// title
				);
				text = text.replace("[" + linkNoWrap + "]", linkHtml);
			}
		}
		return text;
	}

	function _links2wiki(text) {
		var links, linkwiki, type, target, label,
			link, hrefAttr, inner, typeAttr, validProtocol, wikitext;
			
		// convert text to dom
		var $dom = $( "<div id='tinywrapper'>" + text + "</div>" );

		// replace html links with wikitext
		$dom.find( "a[class*='link']" ).replaceWith( function() {
			var wikiText = this.getAttribute("data-mw-wikitext");
			return decodeURI(wikiText);
		} );

		// convert dom back to text
		text = $dom.html();
		return text;
	}

	//Make public available?
	//this.links2wiki = _links2wiki;

	/**
	 * Normalizes some MW table syntax shorthand to HTML attributes
	 *
	 * @param {String} attr
	 * @param {String} elm
	 * @returns {String}
	 */
	function _tablesAttrCleanUp2html(attr, elm) {
		switch (elm) {
			case 'row':
				attr = attr.replace(/al="*?(.*)"*?/g, "align=\"$1\"");
				attr = attr.replace(/bc="*?(.*)"*?/g, "background-color=\"$1\"");
				attr = attr.replace(/va="*?(.*)"*?/g, "valign=\"$1\"");
				return attr;
				break;
			case 'cell':
				attr = attr.replace(/al="*?(.*)"*?/g, "align=\"$1\"");
				attr = attr.replace(/bc="*?(.*)"*?/g, "background-color=\"$1\"");
				attr = attr.replace(/cs="*?(.*)"*?/g, "colspan=\"$1\"");
				attr = attr.replace(/rs="*?(.*)"*?/g, "rowspan=\"$1\"");
				attr = attr.replace(/va="*?(.*)"*?/g, "valign=\"$1\"");
				attr = attr.replace(/wd="*?(.*)"*?/g, "width=\"$1\"");
				return attr;
				break;
		}
	}

	/**
	 * Convert MW tables to HTML
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _tables2html(text, embedded) {
		var lines, line, innerLines, innerTable,
			tableAttr, closeLine, attr, endTd,
			tdText, tdAttr, cells, curLine,
			cont, tempcont,
			inTable = false,
			inTr = false,
			inTd = false,
			inTh = false,
			start = 0,
			nestLevel = 0;

		if (typeof embedded == 'undefined') {
			embedded = false;
		}

		// images or links in tables may contain | in their attributes, esp. in mw-data-*. These
		// need to be properly escaped in order not to interfere with table syntax
		while (text.match(/(\<[^\>]*?)(\|)([^\>]*?\>)/g)) {
			text = text.replace(/(\<[^\>]*?)(\|)([^\>]*?\>)/g, "$1@@pipe@@$3");
		}
		lines = text.split(/\n/);
		for (var i = 0; i < lines.length; i++) {
			line = lines[i].match(/^\{\|(.*)/gi);
			if (line && line !== '') {
				// nested table support, beware: recursive
				if (inTable) {
					innerLines = '';
					nestLevel = 0;
					for (; i < lines.length; i++) {
						if (lines[i].match(/^\{\|(.*)/gi)) {
							nestLevel++;
							innerLines = innerLines + lines[i] + '\n';
							lines.splice(i, 1);
							i--;
						} else if (lines[i].match(/^\|\}/gi)) {
							if (nestLevel > 1) {
								innerLines = innerLines + lines[i] + '\n';
								lines.splice(i, 1);
								i--;
								nestLevel--;
							} else {
								innerLines = innerLines + lines[i];
								lines.splice(i, 1);
								i--;
								break;
							}
						} else {
							innerLines = innerLines + lines[i] + '\n';
							lines.splice(i, 1);
							i--;
						}
					}
					i++;
					embedded = true;
					innerTable = _tables2html(innerLines, embedded);
					lines.splice(i, 0, innerTable);
					embedded = false;
					continue;
				}
				tableAttr = line[0].substr(2, line[0].length);
				if (tableAttr !== '') {
					tableAttr = " " + tableAttr;
				}
				if (embedded) {
					lines[i] = "<table" + tableAttr + ">";
				} else {
					lines[i] = "<div><table" + tableAttr + ">";
				}
				start = i;
				inTable = true;
			} else if (line = lines[i].match(/^\|\}/gi)) {
				closeLine = '';
				if (inTd) {
					closeLine = "</td>";
				}
				if (inTh) {
					closeLine = "</th>";
				}
				if (inTr) {
					closeLine += "</tr>";
				}
				if (embedded) {
					lines[i] = closeLine + "</table>" + line[0].substr(2, line[0].length);
				} else {
					lines[i] = closeLine + "</table></div>" + line[0].substr(2, line[0].length);
				}
				inTr = inTd = inTh = inTable = false;
			} else if ((i === (start + 1)) && (line = lines[i].match(/^\|\+(.*)/gi))) {
				lines[i] = "<caption>" + line[0].substr(2) + "</caption>";
			} else if (line = lines[i].match(/^\|\-(.*)/gi)) {
				endTd = '';
				attr = _tablesAttrCleanUp2html(line[0].substr(2, line[0].length), 'row');
				// @todo makes that any sense???
				if (attr !== '') {
					attr = " " + attr;
				}
				if (inTd) {
					endTd = "</td>";
					inTd = inTh = false;
				}
				if (inTh) {
					endTd = "</th>";
					inTh = inTd = false;
				}
				if (inTr) {
					lines[i] = endTd + "</tr><tr" + attr + ">";
				} else {
					lines[i] = endTd + "<tr" + attr + ">";
					inTr = true;
				}
			} else if ( ( line = lines[i].match(/^\|(.*)/gi) ) && inTable) {
				cells = line[0].substr(1, line[0].length).split(/(\|\|)/);
				var curLine = '';

				for (var k = 0; k < cells.length; k++) {
					tdText = '';
					tdAttr = '';

					if (k > 0 && (cells[k].indexOf("|") === 0)) {
						cells[k] = cells[k].substr(1, cells[k].length);
					}

					cont = cells[k].split("|");
					if (cont.length > 1) {

						// This reflects the case where a pipe is within the table content
						tempcont = new Array();
						for (var j = 1; j < cont.length; j++) {
							tempcont[j - 1] = cont[j];
						}
						tdText = tempcont.join("|");
						tdAttr = _tablesAttrCleanUp2html(cont[0], 'cell');
						if (tdAttr !== '') {
							tdAttr = " " + tdAttr;
						}
					} else {
						tdText = cont[0];
					}

					if (!inTr) {
						inTr = true;
						curLine = "<tr>" + curLine;
					}

					if (inTd) {
						curLine += "</td><td" + tdAttr + ">" + tdText;
					} else if ( inTh ) {
						curLine += "</th><td" + tdAttr + ">" + tdText;
						inTh = false;
						inTd = true;
					} else {
						curLine += "<td" + tdAttr + ">" + tdText;
						inTd = true;
					}
				}
				lines[i] = curLine;
			} else if ( ( line = lines[i].match(/^\!(.*)/gi) ) && inTable) {
				cells = line[0].substr(1, line[0].length).split(/!!/);
				curLine = "";

				for (var k = 0; k < cells.length; k++) {
					if (cells[k] === "!!") {
						continue;
					}
					tdText = '';
					tdAttr = '';

					if (k > 0 && (cells[k].indexOf("!") === 0 || cells[k].indexOf("|") === 0)) {
						cells[k] = cells[k].substr(1, cells[k].length);
					}

					cont = cells[k].split(/!|\|/);
					if (cont.length > 1) {

						// This reflects the case where a pipe is within the table content
						tempcont = new Array();
						for (var j = 1; j < cont.length; j++) {
							tempcont[j - 1] = cont[j];
						}
						tdText = tempcont.join("|");
						tdAttr = _tablesAttrCleanUp2html(cont[0], 'cell');
						if (tdAttr !== '')
							tdAttr = " " + tdAttr;
					} else {
						tdText = cont[0];
					}

					if (!inTr) {
						inTr = true;
						curLine = "<tr>" + curLine;
					}
					if (inTh) {
						curLine += "</th><th" + tdAttr + ">" + tdText;
					} else if (inTd) {
						curLine += "</td><th" + tdAttr + ">" + tdText;
						inTd = false;
						inTh = true;
					} else {
						curLine += "<th" + tdAttr + ">" + tdText;
						inTh = true;
					}
				}
				lines[i] = curLine;
			}
		}
		text = lines.join("\n");
		text = text.replace(/@@pipe@@/gmi, '|');
		return text;
	}

	function _tables2wiki(e) {
		var text = e.content;
		// save some effort if no tables
		if (!text.match(/\<table/g)) return text;
		
		// table preprocessing
		text = text.replace(/(\{\|[^\n]*?)\n+/gmi, "$1\n");
		text = text.replace(/(\|-[^\n]*?)\n+/gmi, "$1\n");
		// this is used to make sure every cell begins in a single line
		// do not use m flag here in order to get ^ as line beginning
		text = text.replace(/(^|.+?)(\|\|)/gi, '$1\n\|');
		text = text.replace(/\n\|\}\n?/gmi, '\n\|\}\n');

		// mark templates in table headers, as they cannot be rendered
		var i = 0;
		while (text.match(/^(\{\|.*?)(\{\{(.*?)\}\})(.*?)$/gmi)) {
			text = text.replace(/^(\{\|.*?)(\{\{(.*?)\}\})(.*?)$/gmi, '$1 data-mw-table-tpl'+i+'="$3"$4');
			i++;
		}

		// mark templates in row definitions, as they cannot be rendered
		var i = 0;
		while (text.match(/^(\|-.*?)(\{\{(.*?)\}\})(.*?)$/gmi)) {
			text = text.replace(/^(\|-.*?)(\{\{(.*?)\}\})(.*?)$/gmi, '$1 data-mw-tr-tpl'+i+'="$3"$4');
			i++;
		}

		// mark templates in header definitions, as they cannot be rendered
		var i = 0;
		while (text.match(/^(!.*?)(\{\{(.*?)\}\})(.*?\|)/gmi)) {
			text = text.replace(/^(!.*?)(\{\{(.*?)\}\})(.*?\|)/gmi, '$1 data-mw-th-tpl'+i+'="$3"$4');
			i++;
		}

		// mark templates in cell definitions, as they cannot be rendered
		var i = 0;
		while (text.match(/^(\|.*?)(\{\{(.*?)\}\})(.*?\|)/gmi)) {
			text = text.replace(/^(\|.*?)(\{\{(.*?)\}\})(.*?\|)/gmi, '$1 data-mw-td-tpl'+i+'="$3"$4');
			i++;
		}

		// protect new lines from being replaced by a space in the html domparser
		text = text.replace(/\n/gmi, '@@TNL@@');

		/* Use {{!}} instead of | if this will be a value passed to a template. */
		//var editingTextarea = $(tinymce.activeEditor.getElement());
		var editingTextarea = $(e.target.targetElm);
		var pipeText;
		if ( editingTextarea.hasClass('mcePartOfTemplate') ) {
			pipeText = '{{!}}';
		} else {
			pipeText = '|';
		}
		//process newlines within table cells
		var tableparser = new tinymce.html.DomParser({validate: true});
		var emptyLine;
		tableparser.addNodeFilter('td', function(nodes, name) {
			function processText(text, block) {
				if ((text == "@@br_emptyline@@") || (text == "<@@1nl@@>") ) return "@@br_emptyline@@"; // cell is empty
				text = text.replace(/@@br_emptyline_first@@/gmi, "@@br_emptyline@@");
				var lines = text.split("@@br_emptyline@@");

				// Walk through text line by line adjusting
				// emptylines appropriately
				for (var i = 0; i < lines.length; i++) {
					//set emptyLine if line is empty
					emptyLine = lines[i].match(/^(\s|&nbsp;)*$/);
					if (!(emptyLine) && ((block > 0) || (i > 0 )) && (i < lines.length - 1 )) {
						lines[i] = lines[i] + '@@br_emptyline@@';
					} else if ((emptyLine) && (block == 0) && (i == 1 )) {
						lines[i] = lines[i] + '@@br_emptyline@@';
					} else if ((emptyLine) && (i == 0 )) {
						lines[i] = lines[i] + '@@br_emptyline@@' + '@@br_emptyline@@';
					}
				}
				return lines.join("@@br_emptyline@@");
			}
			for (var i = 0; i < nodes.length; i++) {
				var child = nodes[i].firstChild;
				var j=0;
				while(child){
					if ( child.name == '#text' ) {
						child.value = processText(child.value,j);
					}
					child = child.next;
					j++;
				}
			}
		});
		var tables = tableparser.parse(text);
		text = new tinymce.html.Serializer().serialize(tables);
		// decode html entities of form &xxx;
		text = text.replace(/(&[^\s]*?;)/gmi, function($0) {
			return tinymce.DOM.decode($0);
		});
		
		//restore the new lines
		text = text.replace(/@@TNL@@/gm, '\n');

		//cleanup thead and tbody tags. Caution: Must be placed before th cleanup because of
		//regex collision
		text = text.replace(/<(\/)?tbody([^>]*)>/gmi, "");
		text = text.replace(/<(\/)?thead([^>]*)>/gmi, "");
		text = text.replace(/<(\/)?tfoot([^>]*)>/gmi, "");
		text = text.replace(/\n?<table([^>]*)>/gmi, "<@@tnl@@>{" + pipeText + "$1");
//		text = text.replace(/\n?(<div>)?<table([^>]*)>/gmi, "<@@tnl@@>{" + pipeText + "$1");
//		text = text.replace(/\n?<table([^>]*)>/gmi, "{" + pipeText + "$1");
		text = text.replace(/\n?<\/table([^>]*)>/gi, "<@@tnl@@>" + pipeText + "}<@@tnl@@>");
//		text = text.replace(/\n?<\/table([^>]*)>(<\/div>)?/gi, "<@@tnl@@>" + pipeText + "}<@@tnl@@>");

		// remove spurious new lines at start and end of tables
		// this is a bit of a hack -should try and stop the being put there
		// in the first place!
//		text = text.replace(/<td><@@tnl@@>\{\|/gmi, "<td>{|"); // before table in table
//		text = text.replace(/<td><@@tnl@@>\{\{\{!\}\}/gmi, "<td>{{{!}}"); // before table in table
		text = text.replace(/^(<@@tnl@@>{)/, "{");//before table at start of text
		text = text.replace(/(@@br_emptyline@@)<@@tnl@@>\{\|/gmi, "<@@tnl@@>{|"); // before table
		text = text.replace(/(@@br_emptyline@@)<@@tnl@@>\{\{\{!\}\}/gmi, "<@@tnl@@>{{{!}}"); // before table
		text = text.replace(/<@@nl@@><@@tnl@@>\{\|/gmi, "<@@tnl@@>{|"); // before table
		text = text.replace(/<@@nl@@><@@tnl@@>\{\{\{!\}\}/gmi, "<@@tnl@@>{{{!}}"); // before table
		text = text.replace(/\|\}<@@tnl@@><\/td>/gmi, "|}<\/td>"); // after table in table
		text = text.replace(/\{\{!\}\}\}<@@tnl@@><\/td>/gmi, "{{!}}}<\/td>"); // after table in table
		text = text.replace(/\|\}<@@tnl@@>@@br_emptyline@@/gmi, "|}<@@tnl@@>"); // after table
		text = text.replace(/\{\{!\}\}\}<@@tnl@@>@@br_emptyline@@/gmi, "{{!}}}<@@tnl@@>"); // after table
		text = text.replace(/<@@tnl@@><@@tnl@@>/gmi, "<@@tnl@@>");//between tables

		text = text.replace(/\n?<caption([^>]*)>/gmi, "<@@tnl@@>" + pipeText + "+$1");
		text = text.replace(/\n?<\/caption([^>]*)>/gmi, "");

		text = text.replace(/\n?<tr([^>]*)>/gmi, "<@@tnl@@>" + pipeText + "-$1");
		text = text.replace(/\n?<\/tr([^>]*)>/gmi, "");

		text = text.replace(/\n?<th([^>]*)>/gmi, "<@@tnl@@>!$1" + pipeText);
		text = text.replace(/\n?<\/th([^>]*)>/gmi, "");

		text = text.replace(/\n?<td([^>]*)>/gmi, "<@@tnl@@>" + pipeText + "$1" + pipeText);

		// remove extra new lines in tables
		text = text.replace(/@@br_emptyline@@<\/td([^>]*)>/gmi, "");
		text = text.replace(/<@@tnl@@><\/td([^>]*)>/gmi, "");
		text = text.replace(/\n?<\/td([^>]*)>/gmi, "");

//		text = text.replace(/\|\|&nbsp;/gi, pipeText + pipeText);
		text = text.replace(/\|&nbsp;/gi, pipeText);

		return text;
	}

	/**
	 * Converts MW list markers to HTML list open tags
	 *
	 * @param {String} lastList
	 * @param {String} cur
	 * @returns {String}
	 */
	function _openList2html(lastList, cur) {
		var listTags = '';
		for (var k = lastList.length; k < cur.length; k++) {
			switch (cur.charAt(k)) {
				case '*' :
					listTags = listTags + "<ul><li>";
					break;
				case '#' :
					listTags = listTags + '<ol><li>';
					break;
				case ';' :
					listTags = listTags + '<dl><dt>';
					break;
				case ':' :
					listTags = listTags + '<blockquote>';
					break;
			}
		}
		return listTags;
	}

	/**
	 * Converts MW list markers to HTML list end tags
	 *
	 * @param {String} lastList
	 * @param {String} cur
	 * @returns {String}
	 */
	function _closeList2html(lastList, cur) {
		var listTags = '';
		for (var k = lastList.length; k > cur.length; k--) {
			switch (lastList.charAt(k - 1)) {
				case '*' :
					listTags = listTags + '</li></ul>';
					break;
				case '#' :
					listTags = listTags + '</li></ol>';
					break;
				case ';' :
					listTags = listTags + '</dt></dl>';
					break;
				case ':' :
					listTags = listTags + '</blockquote>';
					break;
			}
		}
		return listTags;
	}

	/**
	 * Converts MW list markers to HTML list item tags
	 *
	 * @param {String} lastList
	 * @param {String} cur
	 * @returns {String}
	 */
	function _continueList2html(lastList, cur) {
		var listTags = '';
		var lastTag = lastList.charAt(lastList.length - 1);
		var curTag = cur.charAt(cur.length - 1);
		if (lastTag === curTag) {
			switch (lastTag) {
				case '*' :
				case '#' :
					listTags = '</li><li>';
					break;
				case ';' :
					listTags = listTags + '</dt><dt>';
					break;
				case ':' :
					listTags = '</blockquote><blockquote>';
					break;
			}
		} else {
			switch (lastTag) {
				case '*' :
					listTags = listTags + '</li></ul>';
					break;
				case '#' :
					listTags = listTags + '</li></ol>';
					break;
				case ';' :
					listTags = listTags + '</dt></dl>';
					break;
				case ':' :
					listTags = listTags + '</blockquote>';
					break;
			}
			switch (curTag) {
				case '*' :
					listTags = listTags + '<ul><li>';
					break;
				case '#' :
					listTags = listTags + '<ol><li>';
					break;
				case ';' :
					listTags = listTags + '<dl><dt>';
					break;
				case ':' :
					listTags = listTags + '<blockquote>';
					break;
			}
		}
		return listTags;
	}

	function _listsAndEmptyLines2html(text) {
		var
			lines = text.split("\n"),
			//lastlist is set to the wikicode for the list item excluding its text content
			//it is used to determine whether the list item is at a lower, same or higher level in the list
			lastList = '',
			//line is current line being processed.  It is '' unless the line is a list item
			line = '',
			inParagraph = false,
			inBlock = false,
			matchStartTags = false,
			matchEndTags = false,
			emptyLine = false,
			lastLine = false,
			startTags = 0,
			endTags = 0,
			blockLineCount = 0;

		//Walk through text line by line
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
				if (line[0].match(/^(\*|#)+:$/) ) {
					// If the line starts with something like '*:' or '#:', it's not
					// really a list item.
					lines[i] = "<br />" + lines[i];
				} else if (line[0].indexOf(':') === 0) {
					// If the line belongs to a definition list starting with a ':' and
					// follows the last line of a sub, omit <li> at start of line.
					if (line[0].length === lastList.length) {
						lines[i] = _continueList2html(lastList, line[0]) + lines[i];
					} else if (line[0].length > lastList.length) {//DC if this is the start of the list add
						//opening <div> as list will be enclosed in <div>s
						if (line[0].length == 1) { // if first line of list place in a <div>
							lines[i] = '<div>' +  _openList2html(lastList, line[0]) + lines[i];
						} else {
							lines[i] = _openList2html(lastList, line[0]) + lines[i];
						}
					} else if (line[0].length < lastList.length) {//close list
						lines[i] = _closeList2html(lastList, line[0]) + lines[i];
					}
				} else {//else if the line doesn't belong to a definition list starting with a ':' and follows
					//the last line of a sub list, include <li> at start of line
					if (line[0].length === lastList.length) {
						lines[i] = _continueList2html(lastList, line[0]) + lines[i];
					} else if (line[0].length > lastList.length) {//DC if this is the start of top level list add opening <div> as list will be enclosed in <div>s
						if (line[0].length == 1) { // if first line of list place in a <div>
							lines[i] = '<div>' +  _openList2html(lastList, line[0]) + lines[i];
						} else {
							lines[i] = _openList2html(lastList, line[0]) + lines[i];
						}
					} else if (line[0].length < lastList.length) {//if moving back to higher level list from a sub list then precede line with a <li> tag
						lines[i] = _closeList2html(lastList, line[0]) + '<li>' + lines[i];
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
						if ((lines[i-1].match(/(<td>)(\s|&nbsp;)*$/))
							|| (lines[i-1].match(/(<\/table>)(\s|&nbsp;)*$/))
							) {
							// if first line of data in a table cell
							//do nothing
						} else {
//dc 29122017				lines[i] = lines[i] + '<div class="mw_emptyline_first"><br class="mw_emptyline_first"/></div>';
							//lines[i] = lines[i] + '<br class="mw_emptyline_first"/>';
							lines[i] = lines[i] + '<br class="mw_emptyline_first"/><br class="mw_emptyline_first"/>';
						}
						inParagraph = true;
					} else {// this is already in a paragraph
//dc 29122017			lines[i] = lines[i] + '<div class="mw_emptyline"><br class="mw_emptyline"/></div>';
						lines[i] = lines[i] + '<br class="mw_emptyline"/>';
					}
				} else { // not an empty line
					if (!inParagraph && lines[i].match(/(^\<@@@TAG)/i) && i>0 ) { // if the line starts with <@@@TAG then precede it with a blank line
							lines[i] = '<br class="mw_emptyline"/>' + lines[i];
					}
					if (!inParagraph && lines[i].match(/(^\<@@@CMT)/i) && i>0 ) { // if the line starts with <@@@CMT then precede it with a blank line
							lines[i] = '<br class="mw_emptyline"/>' + lines[i];
					}
					inParagraph = false;
					if ((lines[i].match(/(^\<td\>)/i)) || (lines[i].match(/(^\<\/td\>\<td\>)/i))) {	// if first line of data in a table cell
						if (!(lines[i+1].match(/(^\<\/td)/i))) { // and not a single line
							if (!(lines[i+1].match(/^(\s|&nbsp;)*$/))) { // and not an empty line after
								if (!(lines[i+1].match(/(^\<table)/))) { // and not a table after
									lines[i] = lines[i] + '<br class="mw_emptyline"/>';
								}
							}
						}
					}
				}
				//Test if the previous line was in a list if so close the list
				//and place closing </div> before this line
				if (lastList.length > 0) {
					lines[i - 1] = lines[i - 1] + _closeList2html(lastList, '') + '</div>';
					lastList = '';
				}
			}
		}
		return lines.join("");
	}

	/**
	 * Processes wiki heading code into h tags.
	 *
	 * @param {String} match
	 * @param {String} lineStart
	 * @param {String} level
	 * @param {String} content
	 * @returns {String}
	 */
	function _wikiHeader2html(match, lineStart, level, content) {
		if( typeof lineStart == 'undefined' ) {
			lineStart = '';
		}
//		return lineStart + "<h" + level.length + ">" + content + "</h" + level.length + ">";
		return lineStart + "<div><h" + level.length + ">" + content + "</h" + level.length + "></div>\n";
	}
	
	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _styles2html(text) {	
		// bold and italics
		// the ^' fixes a problem with combined bold and italic markup
		text = text.replace(/'''([^'\n][^\n]*?)'''([^']?)/gmi, '<strong>$1</strong>$2');
		text = text.replace(/''([^'\n][^\n]*?)''([^']?)/gmi, '<em>$1</em>$2');
		// horizontal rules
		text = text.replace(/^\n?----\n?/gmi, "\n<hr>\n");
		// div styles
		// @todo check this, might be unneccessary
		text = text.replace(/<div style='text-align:left'>(.*?)<\/div>/gmi, "<div align='left'>$1</div>");
		text = text.replace(/<div style='text-align:right'>(.*?)<\/div>/gmi, "<div align='right'>$1</div>");
		text = text.replace(/<div style='text-align:center'>(.*?)<\/div>/gmi, "<div align='center'>$1</div>");
		text = text.replace(/<div style='text-align:justify'>(.*?)<\/div>/gmi, "<div align='justify'>$1</div>");
		return text;
	}
	
	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _spans2html(text) {	
			// cleanup old entity markers
		while (text.match(/<span class="mw_htmlentity">.+?<\/span>/gmi)) {
			text = text.replace(/(<span class="mw_htmlentity">)(.+?)(<\/span>)/gmi, '$2');
		}

		text = text.replace(/(<span class="mw_htmlentity">)/gmi, '');
		// cleanup spans
		while (text.match(/(<span ([^>]*?)>)(\1)[^>]*?<\/span><\/span>/gmi)) {
			text = text.replace(/(<span [^>]*?>)(\1)([^>]*?)(<\/span>)<\/span>/gmi, '$1$3$4');
		}
		while (text.match(/<span class="toggletext">[\s\S]*?<\/span>/gmi)) {
			text = text.replace(/<span class="toggletext">([\s\S]*?)<\/span>/gmi, '$1');
		}
		// remove replacement in external links. this must be done in a loop since there might be more
		// & in an url
		while (text.match(/(\[[^\]]+?)<span class="mw_htmlentity">(.+?)<\/span>([^\]]+?])/gmi)) {
			text = text.replace(/(\[[^\]]+?)<span class="mw_htmlentity">(.+?)<\/span>([^\]]+?])/gmi, '$1$2$3');
		}

		//preserve entities that were orignially html entities
		text = text.replace(/(&[^\s;]+;)/gmi, '<span class="mw_htmlentity">$1</span>');

		// clean up bogus code when spans are in a single line
		text = text.replace(/<p>((<span([^>]*)>\s*)+)<\/p>/gmi, '$1');
		text = text.replace(/<p>((<\/span>\s*)+)<\/p>/gmi, '$1');
		
		return text;
	}
	
	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _headers2html(text) {	
		// faster replacement for header processing
		// One regexp to rule them all, on regexp to find them,
		// one regexp to bring them all and in html bind them!!!
		text = text.replace(/(^|\n)((?:=){1,6})\s*(.+?)\s*\2(?:\n+|$)/img, _wikiHeader2html);
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _switches2Html(text, e) {
		//process switches
		var mtext, 
			regex, 
			matcher, 
			swt, 
			switches,
			aSwitch,
			i, 
			t,
			pos, 
			innerText, 
			id, 
			el, 
			switchWikiText,
			switchHtml,
			ed = tinymce.get(e.target.id);
			
		if (ed == null) {
			ed = tinymce.activeEditor;
		}
		
		switches = new Array();
		mtext = text;
		regex = "__(.*?)__";
		matcher = new RegExp(regex, 'gmi');
		i = 0;
		swt = '';
		while ((swt = matcher.exec(mtext)) !== null) {
			switches[swt[1]] = swt[0];
		}
		for (aSwitch in switches) {
			switchWikiText = encodeURI(switches[aSwitch]);
			t = Math.floor((Math.random() * 100000) + 100000) + i;
			id = "<@@@SWT"+ t + "@@@>";
			var codeAttrs = {
				'id': id,
				'class': "mceNonEditable wikimagic switch",
				'title': switchWikiText,
				'data-mw-type': "switch",
				'data-mw-id': id,
				'data-mw-name': aSwitch,
				'data-mw-wikitext': switchWikiText,
				'contenteditable': "false"
			};

			switchHtml = '&sect;' + '<div class="mceNonEditableOverlay" />';
			el = ed.dom.create('span', codeAttrs, switchHtml);
			var searchText = new RegExp(switchWikiText, 'g');
			var replaceText = el.outerHTML;
			text = text.replace(
				searchText,
				replaceText
			);
			i++;
		}
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _wiki2html(e) {
		var text = e.content;
		// save some work, if the text is empty
		if (text === '') {
			return text;
		}

		// wrap the text in an object to send it to event listeners
		var textObject = {text: text};
		// call the event listeners
		$(document).trigger('TinyMCEBeforeWikiToHtml', [textObject]);
		// get the text back
		text = tinymce.util.Tools.trim(textObject.text);

		// substitute {{!}} for | if text is part of template
		var editingTextarea = $(e.target.targetElm);
		if ( editingTextarea.hasClass('mcePartOfTemplate') ) {
			// If the table is part of a template parameter, {{!}} should
			// be used instead of |, so do this substitution first.
			text = text.replace(/{{!}}/gmi, "|");
		}

		// normalize line endings to \n
		text = text.replace(/\r\n/gmi, "\n");

		// preserve tags for recovery later
		text = _preserveTags4Html(text, e);

		// preserve templates and parser functions for recovery later
		text = _preserveTemplates4Html(text, e);
		
		// preserve comments for recovery later
		text = _preserveComments4Html(text, e)

		// process switches
		text = _switches2Html(text, e);
		
		// process spans
		text = _spans2html(text);
		
		//cleanup linebreaks in tags except comments
		text = text.replace(/(<[^!][^>]+?)(\n)([^<]+?>)/gi, "$1$3");

		//preserve single line breaks
		do {
			_processFlag = false;
			text = text.replace(/(^|\n|>| )([^\n]+)\n([^\n]{1,5})/gi, __preserveSingleLinebreaks);
		} while (_processFlag);
		
		//normalize line endings to \n
		text = text.replace(/\r\n/gi, '\n');

		// br preprocessing
		text = text.replace(/<br(.*?)\/?>/gi, function(match, p1, offset, string) {
			p1 = p1.trim();
			if ( p1 == '' ) {
				return '<br />';
			} else {
				return '<br data-attributes="' + encodeURI(p1) + '" />'; // @todo: Use JSON.stringify
			}
		});

		// process style (bold, italic, rule, div styles
		text = _styles2html(text);

		// process headers
		text = _headers2html(text);

		// process links
		text = _links2html(text);

		// process tables
		text = _tables2html(text);

		// lists and empty lines
		text = _listsAndEmptyLines2html(text);

		//Write back content of preserved code.
//		text = _recoverPres2wiki(text);
		text = _recoverTags2html(text);
		text = _recoverTemplates2html(text);
		text = _recoverComments2html(text);

		//In some cases (i.e. Editor.insertContent('<img ... />') ) the content
		//is not parsed. We do not want to append any stuff in this case.
		if( text == textObject.text || text == '<p>'+textObject.text+'</p>' ) {
			text = textObject.text;
		}
		else {
			//<p> is neccessary to fix Ticket#2010111510000021. do not use <p>
			//in the complementary line in html2wiki
			text = text + '<div><br class="mw_lastline" /></div>';
		}
		// this reverts the line above. otherwise undo/redo will not work
		text = text.replace(/<div><br [^>]*mw_lastline[^>]*><\/div>/gmi, '');
		text = text.replace(/<br data-attributes="" \/>/gmi, '<br/>');
		text = text.replace(/<br data-attributes="[^>]*data-mce-bogus[^>]*" \/>/gmi, '');
		text = text.replace(/<br [^>]*data-mce-bogus="1"[^>]*>/gmi, '');

		// wrap the text in an object to send it to event listeners
		textObject = {text: text};
		// call the event listeners
		$(document).trigger('TinyMCEAfterWikiToHtml', [textObject]);
		// get the text back
		text = textObject.text;
		return text;
	}

	function _htmlFindList(text) {
		return text.search(/(<ul|<ol|<li( |>)|<\/?dl|<\/?dt|<blockquote[^>]*?>|<\/li( |>)|<\/ul|<\/ol|<\/blockquote|<p( |>)|<\/p( |>)|<h[1-6]|<hr|<br)/);
	}

	function _textStyles2wiki (text) {
		text = text.replace(/<strong>(.*?)<\/strong>/gmi, "'''$1'''");
		text = text.replace(/<b>(.*?)<\/b>/gmi, "'''$1'''");
		text = text.replace(/<em>(.*?)<\/em>/gmi, "''$1''");
		text = text.replace(/<i>(.*?)<\/i>/gmi, "''$1''");
		//underline needs no conversion
		text = text.replace(/<strike>(.*?)<\/strike>/gi, "<s>$1</s>");
		//sub and sup need no conversion
		
		text = text.replace(/\n?<p style="([^"]*?)">(.*?)<\/p>/gmi, "\n<div style='$1'>$2</div><@@nl@@>");
		text = text.replace(/\n?<p style="text-align:\s?left;?">(.*?)<\/p>/gmi, "<@@nl@@><div style='text-align: left'>$1</div><@@nl@@>");
		text = text.replace(/\n?<p style="text-align:\s?right;?">(.*?)<\/p>/gmi, "<@@nl@@><div style='text-align: right'>$1</div><@@nl@@>");
		text = text.replace(/\n?<p style="text-align:\s?center;?">(.*?)<\/p>/gmi, "<@@nl@@><div style='text-align: center'>$1</div><@@nl@@>");
		text = text.replace(/\n?<p style="text-align:\s?justify;?">(.*?)<\/p>/gmi, "<@@nl@@><div style='text-align: justify'>$1</div><@@nl@@>");
		text = text.replace(/\n?<p style=('|")padding-left: 30px;('|")>([\S\s]*?)<\/p>/gmi, "<blockquote>$3</blockquote>");
		text = text.replace(/\n?<p style=('|")padding-left: 60px;('|")>([\S\s]*?)<\/p>/gmi, "<blockquote><blockquote>$3</blockquote>");
		text = text.replace(/\n?<p style=('|")padding-left: 90px;('|")>([\S\s]*?)<\/p>/gmi, "<blockquote><blockquote><blockquote>$3</blockquote>");

		text = text.replace(/\n?<div style=('|")padding-left: 30px;('|")>([\S\s]*?)<\/div>/gmi, "<blockquote>$3</blockquote>");
		text = text.replace(/\n?<div style=('|")padding-left: 60px;('|")>([\S\s]*?)<\/div>/gmi, "<blockquote><blockquote>$3</blockquote>");
		text = text.replace(/\n?<div style=('|")padding-left: 90px;('|")>([\S\s]*?)<\/div>/gmi, "<blockquote><blockquote><blockquote>$3</blockquote>");

		return text
	}

	function _preserveNewLines4wiki (text) {
		//TODO make this work whatever the forced_root_ block element is, even false
		var findText, 
			replaceText, 
			currentPos, 
			nextPos;

		//Remove \nl as they are not part of html formatting
		text = text.replace(/\n/gi, "");

		//Process Enter Key (<p>) and Shift-Enter key (<br>)formatting
		//first clean when multiple Enter keypresses one after another
//		text = text.replace(/<p class="mw_paragraph"><br data-mce-bogus="1"><\/p>/gmi, '@@br_emptyline_first@@@@br_emptyline@@');
		text = text.replace(/<p class="mw_paragraph"><br data-mce-bogus="1"><\/p>/gmi, '@@br_emptyline_first@@');
		//then replace paragraphs containing only blank lines first followed by a <div> with just blank line
		//text = text.replace(/<p class="mw_paragraph"><br class="mw_emptyline_first"><\/p><div>/gmi, '@@br_emptyline@@<div>');
		//then replace paragraphs containing only blank lines first with just blank lines first
		//text = text.replace(/<p class="mw_paragraph"><br class="mw_emptyline_first"><\/p>/gmi, '@@br_emptyline_first@@');
		text = text.replace(/<p class="mw_paragraph"><br class="mw_emptyline_first">/gmi, '<p class="mw_paragraph">');
		//then replace blank lines first followed by blank line at end of paragraph with blank line first
		//text = text.replace(/<br class="mw_emptyline_first"><br class="mw_emptyline"><\/p>/gmi, '@@br_emptyline_first@@</p>');
		//then replace blank lines first at end of paragraph with blank line
		//text = text.replace(/<br class="mw_emptyline_first"><\/p>/gmi, '@@br_emptyline@@</p>');
		text = text.replace(/<br class="mw_emptyline_first"><\/p>/gmi, '</p>');
		text = text.replace(/<br class="mw_emptyline"><\/p>/gmi, '</p>');
		//then replace Enter keypress followed by 'div's (eg table, lists etc, with a single empty line
		text = text.replace(/<p class="mw_paragraph">(.*?)<\/p><div>/gmi, '$1@@br_emptyline@@<div>');
		//then replace Enter keypress with wiki paragraph eg three new lines
		text = text.replace(/<p class="mw_paragraph">(.*?)<\/p>/gmi, '$1@@br_emptyline_first@@@@br_emptyline@@');
//		text = text.replace(/<p class="mw_paragraph">(.*?)<\/p>/gmi, '$1@@br_emptyline_first@@');
		//finally replace Shift enters appropriate number of new lines eg two for first and one for immediately following
//		text = text.replace(/<br>/gmi, '@@br_emptyline_first@@');
/*		currentPos = text.search(/(<br>)+/mi);
		while (currentPos > -1) {
			text = text.replace(/<br ?\/>/mi, '@@br_emptyline_first@@');
			nextPos = currentPos - 1;
			currentPos = text.search(/(<br>)+/mi);
			while (currentPos - 9 === nextPos) {
				text = text.replace(/<br>/mi, '@@br_emptyline@@');
				currentPos = text.search(/(<br>)+/mi);
				nextPos = currentPos - 1;
			}
		}*/

		text = text.replace(/<br class="mw_emptyline_first"[^>]*>/gmi, "@@br_emptyline_first@@");
		// if emptyline_first is no longer empty, change it to a normal p
//		text = text.replace(/<div class="mw_emptyline_first"[^>]*>&nbsp;<\/div>/gmi, '<div>@@br_emptyline_first@@</div>'); // TinyMCE 4
//		text = text.replace(/<div class="mw_emptyline_first"[^>]*>(.*?\S+.*?)<\/div>/gmi, "<div>$1</div>");
//		text = text.replace(/<div class="mw_emptyline_first"[^>]*>.*?<\/div>/gmi, "<div>@@br_emptyline_first@@</div>");
//		text = text.replace(/<div>@@br_emptyline_first@@<\/div>/gmi, "@@br_emptyline_first@@");
		text = text.replace(/<br class="mw_emptyline"[^>]*>/gmi, "@@br_emptyline@@");
		//text = text.replace(/<br>/gmi, "@@br_emptyline@@");
		// if emptyline is no longer empty, change it to a normal p
//		text = text.replace(/<div class="mw_emptyline"[^>]*>&nbsp;<\/div>/gmi, '<div>@@br_emptyline@@</div>'); // TinyMCE 4
//		text = text.replace(/<div class="mw_emptyline"[^>]*>(.*?\S+.*?)<\/div>/gmi, "<div>$1</div>"); //doesn't replace 2nd occurence
//		text = text.replace(/<div class="mw_emptyline"[^>]*>(.*?)<\/div>/gmi, "<div>@@br_emptyline@@</div>");//file 10
		text = text.replace(/<br mce_bogus="1"\/>/gmi, "");
		// remove stray bogus data placeholders
		text = text.replace(/<br data-mce-bogus="1">/gmi, "");

		text = text.replace(/<br.*?>/gi, function(match, offset, string) {
			var attributes = $(match).attr('data-attributes');
			if (typeof attributes === 'undefined' || attributes == "") {
				return '<br class="single_linebreak"/>';
			}
			return '<br' + decodeURI(attributes) + '>';
		});

		return text;
	}

	function _divs2wiki (text) {
		text = text.replace(/<\/div>\n?/gmi, "</div>\n");
		text = text.replace(/<div>(.*?)<\/div>/gmi, "$1");
		return text;
	}
	
	function _blocks2wiki (text) {
		var listTag, currentPos, nextPos, oldText, message;

		listTag = '';
		text = text.replace(/@@br_emptyline_first@@/gi, "<br />");

		// careful in the upcoming code: .*? does not match newline, however, [\s\S] does.
		nextPos = _htmlFindList(text);
		while (nextPos !== -1) {
			oldText = text;
			switch (text.substr(nextPos, 2).toLowerCase()) {
				case '<p' :
					// Todo: putting these lines straight in row might lead to strange behaviour
					currentPos = text.search(/<p[^>]*>(<span[^>]*mw_comment[^>]*>[\s\S]*?<\/span>[\s\S]*?)<\/p>/mi);
					if (currentPos === nextPos) {
						text = text.replace(/<p[^>]*>(<span[^>]*mw_comment[^>]*>[\s\S]*?<\/span>[\s\S]*?)<\/p>/mi, "$1");
					}
					currentPos = text.search(/<p(\s+[^>]*?)?>\s*(\s|<br ?\/>)\s*<\/p>/mi);
					if (currentPos === nextPos) {
						text = text.replace(/\n?<p(\s+[^>]*?)?>\s*(\s|<br ?\/>)\s*<\/p>/mi, "<@@2nl@@>");
					}
					currentPos = text.search(/<p(\s+[^>]*?)?>(\s| |&nbsp;)*?<\/p>/mi);
					if (currentPos === nextPos) {
						text = text.replace(/\n?<p(\s+[^>]*?)?>(\s| |&nbsp;)*?<\/p>/mi, "<@@2nl@@>");
					}
					//THIS IS EXPERIMENTAL: If anything breaks, put in a second \n at the end
					//DC Seems to insert spurious \n so taken these out
					currentPos = text.search(/<p(\s+[^>]*?)?>([\s\S]*?)<\/p>/mi);
					if (currentPos === nextPos) {
//DC						text = text.replace(/\n?<p(\s+[^>]*?)?>([\s\S]*?)<\/p>/mi, "\n$2\n\n");
						text = text.replace(/\n?<p(\s+[^>]*?)?>([\s\S]*?)<\/p>/mi, "$2");
//20171216						text = text.replace(/<p(\s+[^>]*?)?>([\s\S]*?)<\/p>/mi, "$2");
						text = text.replace(/<p(\s+[^>]*?)+>([\s\S]*?)<\/p>/mi, "$2");
					}
					break;
			}
			switch (text.substr(nextPos, 3)) {
				case '</p' :
					text = text.replace(/<\/p>/, "");
					break;
//DC headers on consecutive lines will result in an extra new line being introduced so check for this and replace with a single new line
				case '<h1' :
//					text = text.replace(/\n?<h1.*?>(.*?)<\/h1>\n?/mi, "\n=$1=\n\n");
					text = text.replace(/\n?<h1.*?>(.*?)<\/h1>\n?/mi, "<@@hnl@@>=$1=<@@hnl@@>");
					break;
				case '<h2' :
//					text = text.replace(/\n?<h2.*?>(.*?)<\/h2>\n?/mi, "\n==$1==\n\n");
					text = text.replace(/\n?<h2.*?>(.*?)<\/h2>\n?/mi, "<@@hnl@@>==$1==<@@hnl@@>");
					break;
				case '<h3' :
//					text = text.replace(/\n?<h3.*?>(.*?)<\/h3>\n?/mi, "\n===$1===\n\n");
					text = text.replace(/\n?<h3.*?>(.*?)<\/h3>\n?/mi, "<@@hnl@@>===$1===<@@hnl@@>");
					break;
				case '<h4' :
//					text = text.replace(/\n?<h4.*?>(.*?)<\/h4>\n?/mi, "\n====$1====\n\n");
					text = text.replace(/\n?<h4.*?>(.*?)<\/h4>\n?/mi, "<@@hnl@@>====$1====<@@hnl@@>");
					break;
				case '<h5' :
//					text = text.replace(/\n?<h5.*?>(.*?)<\/h5>\n?/mi, "\n=====$1=====\n\n");
					text = text.replace(/\n?<h5.*?>(.*?)<\/h5>\n?/mi, "<@@hnl@@>=====$1=====<@@hnl@@>");
					break;
				case '<h6' :
//					text = text.replace(/\n?<h6.*?>(.*?)<\/h6>\n?/mi, "\n======$1======\n\n");
					text = text.replace(/\n?<h6.*?>(.*?)<\/h6>\n?/mi, "<@@hnl@@>======$1======<@@hnl@@>");
					break;
				case '<hr' :
					text = text.replace(/\n?<hr.*?>/mi, "<@@nl@@>----");
					break;
				case '<ul'	:
					listTag = listTag + '*';
					text = text.replace(/<ul[^>]*?>/, "");
					break;
				case '<ol' :
					listTag = listTag + '#';
					text = text.replace(/<ol[^>]*?>/, "");
					break;
				case '<dl' :
					//listTag = listTag + '#';
					text = text.replace(/<dl[^>]*?>/, "");
					break;
				case '<dt' :
					listTag = listTag + ';';
					text = text.replace(/<dt[^>]*?>/, "<@@bnl@@>" + listTag + " ");
					break;
				case '<li' :
					if (text.search(/<li[^>]*?>\s*(<ul[^>]*?>|<ol[^>]*?>)/) === nextPos) {
						text = text.replace(/<li[^>]*?>/, "");
					} else {
						text = text.replace(/\n?<li[^>]*?>/mi, "<@@bnl@@>" + listTag + " ");
					}
					break;
				case '<br' :
				//TODO check this now works as simple <br>s were preserved in preserveNewLines4wiki function
					if (listTag.length > 0) {
						text = text.replace(/<br .*?\/>/, "<@@nl@@>" + listTag + ": ");
					} else {
						if (text.search(/<br class="single_linebreak">/) === nextPos) {
//							text = text.replace(/<br .*?\/>/, "<@@1nl@@>");
							text = text.replace(/<br .*?>/, "<@@1nl@@>");
						} else {
							text = text.replace(/<br .*?\/>/, "<@@nl@@>");
						}
/*
						// replace  first <br /> with 2 new lines
						// any <br />s that follow immediately will be
						// replaced by single new lines
						text = text.replace(/<br ?\/>/mi, "<@@2nl@@>");
						currentPos = text.search(/(<br ?\/>)+/mi);
						while (currentPos - 9 === nextPos) {
							text = text.replace(/<br ?\/>/mi, "<@@nl@@>");
							nextPos = currentPos - 1;
							currentPos = text.search(/(<br ?\/>)+/mi);
						}
*/
					}
					break;
			}
			switch (text.substr(nextPos, 4)) {
				case '<blo' :
					listTag = listTag + ':';
					if (text.search(/(<blockquote[^>]*?>\s*(<ul>|<ol>))|(<blockquote[^>]*?>\s*<blockquote[^>]*?>)/) === nextPos) {
						text = text.replace(/<blockquote[^>]*?>/, "");
					} else {
//DC						text = text.replace(/\n?<blockquote[^>]*?>/mi, "\n" + listTag + " ");
						text = text.replace(/\n?<blockquote[^>]*?>/mi, "" + listTag + " ");
					}
					break;
				case '</ul'	:
					listTag = listTag.substr(0, listTag.length - 1);
					if (listTag.length > 0) {
						text = text.replace(/<\/ul>/, "");
					} else {
						text = text.replace(/<\/ul>/, "<@@bnl@@>");
//						text = text.replace(/<\/ul>/, "");
					}
					break;
				case '</ol' :
					listTag = listTag.substr(0, listTag.length - 1);
					//prevent newline after last blockquote
					if (listTag.length > 0) {
						text = text.replace(/<\/ol>/, "");
					} else {
						text = text.replace(/<\/ol>/, "<@@bnl@@>");
//DC						text = text.replace(/<\/ol>/, "");
					}
					break;
				case '</dl' :
					listTag = listTag.substr(0, listTag.length - 1);
					//prevent newline after last blockquote
					if (listTag.length > 0) {
						text = text.replace(/<\/dl>/, "");
					} else {
//DC						text = text.replace(/<\/dl>/, "\n");
						text = text.replace(/<\/dl>/, "");
					}
					break;
				case '</dt' :
					listTag = listTag.substr(0, listTag.length - 1);
					text = text.replace(/<\/dt>/, "");
					break;
				case '</li' :
//DC					text = text.replace(/\n?<\/li>/mi, "\n");
					text = text.replace(/\n?<\/li>/mi, "");
					break;
//DC TODO text procesing of block quotes
				case '</bl' :
					listTag = listTag.substr(0, listTag.length - 1);
					if (text.search(/<\/blockquote>\s*<blockquote[^>]*?>/) === nextPos) {
//DC						text = text.replace(/\n?<\/blockquote>\s*<blockquote[^>]*?>/, "\n<blockquote>");
						text = text.replace(/\n?<\/blockquote>\s*<blockquote[^>]*?>/, "<blockquote>");
					} else if (text.search(/<\/blockquote>\s*<\/blockquote>/) === nextPos) {
						text = text.replace(/<\/blockquote>/, "");
					} else if (text.search(/<\/blockquote>\s*<\/li>/) === nextPos) {
						text = text.replace(/<\/blockquote>/, "");
					} else {
						//prevent newline after last blockquote //if no * or # is present
						if (listTag.length > 0) {
//DC							text = text.replace(/<\/blockquote>/, "\n" + listTag + " ");
							text = text.replace(/<\/blockquote>/, "" + listTag + " ");
						} else {
//DC							text = text.replace(/<\/blockquote>/, "\n");
							text = text.replace(/<\/blockquote>/, "");
						}
					}
					break;
			}

			nextPos = _htmlFindList(text);
			// this is a rather expensive function in order to prevent system crashes.
			// if the text has not changed, text.search will find the same tag over and over again
			// Todo: Identify infinite loops and prevent
			if (oldText == text) {
				// Todo: i18n
				message = mw.msg("tinymce-wikicode-alert-infinte-loop");
				alert(message);
				break;
			}
		}
		return text;
	}
	
	function _newLines2wiki (text) {
		//DC if the br_emptyline was preceded by abr_emptyline_first then replacing the br_emptyline before the br_emptyline_first
		text = text.replace(/\n?@@br_emptyline_first@@/gmi, "<@@2nl@@>");
		text = text.replace(/\n?@@br_emptyline@@/gmi, "<@@nl@@>");
		//DC clean up new lines associated with blocks and or headers
		text = text.replace(/<@@bnl@@><@@bnl@@>/gmi, "<@@nl@@>");
		text = text.replace(/<@@hnl@@><@@hnl@@>/gmi, "<@@nl@@>");
		text = text.replace(/<@@2nl@@><@@[bh]nl@@>/gmi, "<@@2nl@@>");
		text = text.replace(/<@@[bh]nl@@><@@2nl@@>/gmi, "<@@2nl@@>");
		text = text.replace(/<@@hnl@@><@@nl@@>/gmi, "<@@nl@@>");
		text = text.replace(/<@@nl@@><@@[bh]nl@@>/gmi, "<@@nl@@>");
		text = text.replace(/<@@[bh]nl@@>/gmi, "<@@nl@@>");
		//DC clean up new lines associated with tables
		text = text.replace(/<@@tnl@@>/gmi, "<@@nl@@>");
		// Cleanup empty lines that exists if enter was pressed within an aligned paragraph
		// However, leave empty divs with ids or classes
		// DC just remove any remaining DIVS otherwise this corupt conversion back to html
//		text = text.replace(/<div (?!(id|class))[^>]*?>(\s|&nbsp;)*<\/div>/gmi, "");
		text = text.replace(/<div [^>]*?>(\s|&nbsp;)*<\/div>/gmi, "");
		// Cleanup am Schluss lÃ¶scht alle ZeilenumbrÃ¼che und Leerzeilen/-Zeichen am Ende.
		// Important: do not use m flag, since this makes $ react to any line ending instead of text ending
		text = text.replace(/((<p( [^>]*?)?>(\s|&nbsp;|<br\s?\/>)*?<\/p>)|<br\s?\/>|\s)*$/gi, "");
		text = text.replace(/<br [^>]*mw_lastline[^>]*>/gmi, '');
		text = text.replace(/<br data-attributes="" ?\/?>/gmi, '<br/>');
		text = text.replace(/<br data-attributes="[^>]*data-mce-bogus[^>]*" ?\/?>/gmi, '');
		text = text.replace(/<br data-attributes="[^>]*data-attributes[^>]*" ?\/?>/gmi, '<br/>');
		text = text.replace(/<br [^>]*data-mce-bogus="1"[^>]*>/gmi, '');
		text = text.replace(/<br [^>]*data-mce-fragment="1"[^>]*>/gmi, '');
		//DC clean up single new lines from _onGetContent
		text = text.replace(/ ?<span[^>]*class="single_linebreak" title="single linebreak"[^>]*>(&nbsp;|.|&para;)<\/span> ?/g, "<@@nl@@>");
		//DC replace all new line codes as all valid ones now have place holders
		text = text.replace(/\n*/gi, '');
		text = text.replace(/<br \/><br \/>/gmi, "\n");
		text = text.replace(/<br \/>/gmi, "");
		text = text.replace(/<@@1nl@@>/gmi, "<br>");
		text = text.replace(/<@@2nl@@>/gmi, "\n\n");
		text = text.replace(/<@@nl@@>/gmi, "\n");
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _html2wiki(e) {
		var text = e.content;
		// save some work, if the text is empty
		if (text === '') {
			return text;
		}
		// remove useless white spaces
		text = tinymce.util.Tools.trim(text);
		// wrap the text in an object to send it to event listeners
		var textObject = {text: text};
		// call the event listeners
		$(document).trigger('TinyMCEBeforeHtmlToWiki', [textObject]);
		// get the text back
		text = textObject.text;

		// normalize UTF8 spaces as of TinyMCE 3.4.9
		text = text.replace(/\u00a0/gi, '');

		// save content of pre tags
		text = _preservePres4wiki(text);

		// convert text decorations
		text = _textStyles2wiki(text);

		// preserve new lines
		text = _preserveNewLines4wiki(text);

		// convert images
		text = _image2wiki(text);

		//convert links
		text = _links2wiki(text);

		// convert divs
		text = _divs2wiki(text);

		// convert blocks 
		text = _blocks2wiki(text);

		// convert tables
		e.content = text;
		text = _tables2wiki(e);

		// write back content of <pre> tags.
		text = _recoverPres2wiki(text);

		// process new lines
		text = _newLines2wiki(text);

		// convert <pre>s inserted in Tiny MCE to lines with spaces in front
		text = _htmlPres2Wiki(text);

		// convert hrml entities in wiki code
		text = _htmlEntities2Wiki(text);
		
		// Cleanup von falschen Image-URLs
		// TODO MRG (02.11.10 23:44): i18n
		// TODO DC check if this is needed
/*		text = text.replace(/\/Image:/g, "Image:");
		text = text.replace(/\/Bild:/g, "Bild:");
		text = text.replace(/\/File:/g, "File:");
		text = text.replace(/\/Datei:/g, "Datei:");*/

		// wrap the text in an object to send it to event listeners
		textObject = {text: text};
		// call the event listeners
		$(document).trigger('TinyMCEAfterHtmlToWiki', [textObject]);
		// get the text back
		text = textObject.text;

		return text;
	}
	

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preserveTags4Html(text, e) {
		var mtext, regex, matcher, swt, i, pos, st, cmt,
			curlyBraceDepth, squareBraceDepth, templateDepth,
			squareBraceFirst, tempTemplate, innerText, id, htmlText, el,
			templateName, templateText, templateResult, templateNameLines,
			switchWikiText;
		var server = mw.config.get( "wgServer" ) ;
		var script = mw.config.get( 'wgScriptPath' ) + '/api.php';
		var title = mw.config.get( "wgCanonicalNamespace" ) + ':' + mw.config.get( "wgTitle" ) ;

		var ed = tinymce.get(e.target.id);
		if (ed == null) {
			ed = tinymce.activeEditor;
		}

/*		//now process special tags
		if (!_specialtags) {
			_specialtags = new Array();
		}*/
		// Tags without innerHTML need /> as end marker. Maybe this should be task of a preprocessor,
		// in order to allow mw style tags without /.
		regex = '<(' + _specialTagsList + ')[\\S\\s]*?((/>)|(>([\\S\\s]*?<\\/\\1>)))';
		matcher = new RegExp(regex, 'gmi');
		mtext = text;
		i = 0;
		st = '';
		var innerText = '';
		var retValue = false;
		var moreAttribs = '';
		var tagName = '';
		
		if (!_tags4Html) {
			_tags4Html = new Array();
		}
		if (!_tags4Wiki) {
			_tags4Wiki = new Array();
		}

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
					var tagHTML = data.parse.text["*"],
						tagWikiText = data.parse.wikitext["*"],
						displayTagWikiText,
						t,
						id,
						codeAttrs,
						el,
						tagText,
						searchText,
						replaceText;

					tagWikiText = $.trim(tagWikiText);
					if (tagWikiText.substring(0, 3) == '<p>') {
						tagWikiText = tagWikiText.substring(3, tagWikiText.length);
					}
					if (tagWikiText.substring(tagWikiText.length-4,tagWikiText.length) == '</p>') {
						tagWikiText = tagWikiText.substring(0, tagWikiText.length-4);
					}
					tagWikiText = $.trim(tagWikiText);
					displayTagWikiText = encodeURI(tagWikiText);

					t = Math.floor((Math.random() * 100000) + 100000) + i;
					id = "<@@@TAG"+ t + "@@@>";
					codeAttrs = {
						'id': id,
						'class': "mceNonEditable wikimagic tag",
						'title': displayTagWikiText ,
						'data-mw-type': "tag",
						'data-mw-id': t,
						'data-mw-name': tagName,
						'data-mw-wikitext': displayTagWikiText,
						'contenteditable': "false"
					};
					
					tagHTML = $.trim(tagHTML);
					tagHTML += '<div class="mceNonEditableOverlay" />';
					el = ed.dom.create('span', codeAttrs, tagHTML);
					tagText = el.outerHTML;
					tagWikiText = tagWikiText.replace(/[^A-Za-z0-9_]/g, '\\$&');
					searchText = new RegExp(tagWikiText, 'g');
					replaceText = id;
					_tags4Html[id] = tagText;
					_tags4Wiki[id] = displayTagWikiText;
					text = text.replace(
						searchText,
						replaceText
					);
				}
			});
			i++;
		}
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preserveTemplates4Html(text, e) {
		var mtext, 
			regex, 
			matcher, 
			i, 
			pos, 
			curlyBraceDepth = 0, 
			squareBraceDepth = 0, 
			templateDepth = 0,
			squareBraceFirst = false, 
			tempTemplate = '', 
			innerText, 
			id, 
			htmlText, 
			el,
			templateName, 
			templateText, 
			templateResult, 
			templateNameLines,
			templates = new Array(),
			checkedBraces = new Array(),
			server = mw.config.get( "wgServer" ),
			script = mw.config.get( 'wgScriptPath' ) + '/api.php',
			title = mw.config.get( "wgCanonicalNamespace" ) + ':' + mw.config.get( "wgTitle" ),
			ed = tinymce.get(e.target.id);
		
		if (ed == null) {
			ed = tinymce.activeEditor;
		}
		if (!_templates4Html) {
			_templates4Html = new Array();
		}
		if (!_templates4Wiki) {
			_templates4Wiki = new Array();
		}
		
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
					if (tempTemplate !== '' ) {
						templates[tempTemplate]=tempTemplate;
					}
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
		i = 0;
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
						var templateHTML = data.parse.text["*"],
							templateWikiText,
							displayTemplateWikiText,
							t,
							id,
							codeAttrs,
							el,
							searchText,
							replaceText;

						// DC remove leading and trailing <p>
						templateHTML = $.trim(templateHTML);
						templateHTML = templateHTML.replace(/<\/?p[^>]*>/g, "");

						templateHTML = $.trim(templateHTML);
						templateHTML = templateHTML.replace(/\&amp\;/gmi,'&');
						// DC remove href tags in returned html as links will screw up conversions
						templateHTML = templateHTML.replace(/\shref="([^"]*)"/gmi,'');
						templateHTML = templateHTML.replace(/(\r\n|\n|\r)/gm,"");

						templateWikiText = data.parse.wikitext["*"];
						templateWikiText = $.trim(templateWikiText);
						if (templateWikiText.substring(0, 3) == '<p>') {
							templateWikiText = templateWikiText.substring(3, templateWikiText.length);
						}
						if (templateWikiText.substring(templateWikiText.length-4,templateWikiText.length) == '</p>') {
							templateWikiText = templateWikiText.substring(0, templateWikiText.length-4);
						}
						templateWikiText = $.trim(templateWikiText);
						displayTemplateWikiText = encodeURI(templateWikiText);

						t = Math.floor((Math.random() * 100000) + 100000) + i;
						id = "<@@@TPL"+ t + "@@@>";
						codeAttrs = {
							'id': id,
							'class': "mceNonEditable wikimagic template",
							'title': templateWikiText,
							'data-mw-type': "template",
							'data-mw-id': t,
							'data-mw-name': templateName,
							'data-mw-wikitext': displayTemplateWikiText,
							'contenteditable': "false"
						};
						
						templateHTML += '<div class="mceNonEditableOverlay" />';
						el = ed.dom.create('span', codeAttrs, templateHTML);
						templateWikiText = templateWikiText.replace(/[^A-Za-z0-9_]/g, '\\$&');
						searchText = new RegExp(templateWikiText, 'g');
						templateText = el.outerHTML;
						replaceText = id;
						_templates4Html[id] = templateText;
						_templates4Wiki[id] = displayTemplateWikiText;
						text = text.replace(
							searchText,
							replaceText
						);
						i++;
					}
				});
			}
		}
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preserveComments4Html(text, e) {
		var mtext, regex, matcher, i, pos, cmt,
			i, innerText, id, htmlText, el;

		var ed = tinymce.get(e.target.id);
		if (ed == null) {
			ed = tinymce.activeEditor;
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
			id = "mw_switch:@@@CMT"+ i + "@@@";
			var codeAttrs = {
				'id': id,
				'class': "mceNonEditable wikimagic comment",
				'title': cmt[1],
				'data-mw-type': "comment",
				'data-mw-id': i,
				'data-mw-name': commentText,
				'data-mw-wikitext': cmt[0],
				'contenteditable': "false"
			};

			htmlText = ed.dom.createHTML('span', codeAttrs, '&#8493' );
			el = ed.dom.create('span', codeAttrs, '&#8493' );
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

		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preservePres4wiki(text, skipnowiki) {
		var i;

		_preTags = false;
		_preTags = text.match(/<pre[^>]*?(?!mw_pre_from_space)[^>]*?>([\S\s]*?)<\/pre>/gmi);

		if (_preTags) {
			for (i = 0; i < _preTags.length; i++) {
				text = text.replace(_preTags[i], "<@@@PRE" + i + "@@@>");
			}
		}

		_preTagsSpace = false;
		// @todo MRG (22.10.10 19:28): This should match pre class="space", narrow down (now matches everything)
		_preTagsSpace = text.match(/<pre[^>]+mw_pre_from_space[^>]+>([\S\s]*?)<\/pre>/gmi);
		if (_preTagsSpace) {
			for (i = 0; i < _preTagsSpace.length; i++) {
				text = text.replace(_preTagsSpace[i], "<@@@PRE_SPACE" + i + "@@@>");
			}
		}

		if ( skipnowiki ) return text;

		_nowikiTags = false;
		//
		_nowikiTags = text.match(/<nowiki>([\S\s]*?)<\/nowiki>/gmi);
		if (_nowikiTags) {
				for (i = 0; i < _nowikiTags.length; i++) {
						text = text.replace(_nowikiTags[i], "<@@@NOWIKI" + i + "@@@>");
//						_nowikiTags[i] = _nowikiTags[i].replace( "\n", "<span class='single_linebreak' title='single linebreak'>&para;<\/span>" );
						_nowikiTags[i] = _nowikiTags[i].replace( "\n", _slb );
				}
		}
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverPres2wiki(text) {
		var i, regex;

		if (_preTags) {
			for (var i = 0; i < _preTags.length; i++) {
				regex = '<@@@PRE' + i + '@@@>';
				text = text.replace(new RegExp(regex, 'gmi'), _preTags[i]);
			}
		}
		_preTags = false;

		//this is experimental support for pres with spaces
		if (_preTagsSpace) {
			for (i = 0; i < _preTagsSpace.length; i++) {
				regex = '<@@@PRE_SPACE' + i + '@@@>';
				text = text.replace(new RegExp(regex, 'gmi'), _preTagsSpace[i]);
			}
		}
		_preTagsSpace = false;

		//this is experimental support for nowiki
		if (_nowikiTags) {
			for (i = 0; i < _nowikiTags.length; i++) {
				regex = '<@@@NOWIKI' + i + '@@@>';
				text = text.replace( new RegExp(regex, 'gmi'), _nowikiTags[i]);
			}
		}
		_nowikiTags = false;

		// make sure pre starts in a separate line
		text = text.replace(/([^^])?\n?<pre/gi, "$1<@@nl@@><pre");
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _htmlEntities2Wiki(text) {
		var regex, matcher, mtext, i, ent;

		if (!_htmlEntities4Wiki) {
			_htmlEntities4Wiki = new Array();
		}

		// Tiny replaces &nbsp; by space, so we need to undo this
		text = text.replace(/<span class="mw_htmlentity">[\s\u00a0]<\/span>/gi, '<span class="mw_htmlentity">&nbsp;<\/span>');
		regex = '<span class="mw_htmlentity">(&[^;]*?;)<\/span>';
		matcher = new RegExp(regex, 'gmi');

		mtext = text;

		i = 0;
		while ((ent = matcher.exec(mtext)) !== null) {
			text = text.replace(ent[0], "<@@@HTML" + i + "@@@>");
			_htmlEntities4Wiki[i] = ent[1];
			i++;
		}

		// decode html entities of form &xxx;
		text = text.replace(/(&[^\s]*?;)/gmi, function($0) {
			return tinymce.DOM.decode($0);
		});

		// now recover ntml entities
		if (_htmlEntities4Wiki) {
			for (i = 0; i < _htmlEntities4Wiki.length; i++) {
				regex = '<@@@HTML' + i + '@@@>';
				text = text.replace(new RegExp(regex, 'gmi'), _htmlEntities4Wiki[i]);
			}
		}
		_htmlEntities4Wiki = false;

		//cleanup entity markers
		while (text.match(/<span class="mw_htmlentity">.+?<\/span>/gmi)) {
				text = text.replace(/(<span class="mw_htmlentity">)(.+?)(<\/span>)/gmi, '$2');
		}

		return text;
	}

	/**
	 *
	 * recover html template text from placeholders
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverTemplates2html(text) {
		var regex,
			templateLabel;
			
		if (_templates4Html) {
			for (templateLabel in _templates4Html) {
				regex = templateLabel;
				text = text.replace(new RegExp(regex, 'gmi'), _templates4Html[templateLabel]);
			}
		}
		return text;
	}

	/**
	 *
	 * recover html tag text from placeholdes
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverTags2html(text) {
		var regex,
			tagLabel;

		if (_tags4Html) {
			for (tagLabel in _tags4Html) {
				regex = tagLabel;
				text = text.replace(new RegExp(regex, 'gmi'), _tags4Html[tagLabel]);
			}
		}
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverHtmlEntities2Wiki(e) {
		var i, regex;
		var text = e.content;

		if (_htmlEntities4Wiki) {
			for (i = 0; i < _htmlEntities4Wiki.length; i++) {
				regex = '<@@@HTML' + i + '@@@>';
				text = text.replace(new RegExp(regex, 'gmi'), _htmlEntities4Wiki[i]);
			}
		}
		_htmlEntities4Wiki = false;

		// decode html entities of form &xxx;
		text = text.replace(/(&[^\s]*?;)/gmi, function($0) {
				return tinymce.DOM.decode($0);
			});
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverTags2Wiki(e) {
		var text = e.content,
			tagLabel,
			regex;

		if (_tags4Wiki){		
			for (tagLabel in _tags4Wiki) {
					regex = tagLabel;
					text = text.replace(new RegExp(regex, 'gmi'), decodeURI(_tags4Wiki[tagLabel]));
			}
		}

		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverTemplates2Wiki(e) {
		var text = e.content,
			templateLabel,
			regex;

		if (_templates4Wiki) {
			for (templateLabel in _templates4Wiki) {
				regex = templateLabel;
				text = text.replace(new RegExp(regex, 'gmi'), decodeURI(_templates4Wiki[templateLabel]));
			}
		}

		// cleanup templates in table markers
		text = text.replace(/data-mw-t.*?-tpl.*?="(.*?)"/gmi, "{{$1}}");

		return text;
	}


	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverComments2html(text) {
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


	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
/*	function _convertPreWithSpacesToTinyMce(text) {
		_preTagsSpace = new Array();
		text = _preservePres4wiki(text);

		// careful: this is greedy and goes on until it finds a line ending.
		// originally ended in (\n|$), however, this would result in only every other
		// line being recognized since the regex then matches line endings at the beginning
		// and at the end.
		// There is a lookahead for tables: ?!<t
		_preTagsSpace = text.match(/(^|\n\n?)( +(?!<t)\S[^\n]*)/gi);
		if (_preTagsSpace) {
			for (var i = 0; i < _preTagsSpace.length; i++) {
				//prevent HTML-Tables from being rendered as pre
				text = text.replace(_preTagsSpace[i], "<@@@PRE_SPACE" + i + "@@@>");
				// preserve newline at the beginning of a line
				var newlineAtBeginning = _preTagsSpace[i].charAt(0) == "\n";
				// trim pre content
				_preTagsSpace[i] = _preTagsSpace[i].replace( /\n/g, "").substr(1, _preTagsSpace[i].length);
				text = text.replace(
					"<@@@PRE_SPACE" + i + "@@@>",
					( newlineAtBeginning ? "\n" : "" ) + '<pre class="mw_pre_from_space">' + _preTagsSpace[i] + '</pre>'
				);
			}
		}

		// can be pre with a marker attribute "space"
		text = text.replace(/<\/pre>\s*?<pre[^>]*>/gmi, '\n');

		text = _recoverPres2wiki(text);
		return text;
	}*/
	
	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _htmlPres2Wiki(text) {
		var innerPre, innerPreLines;

		_preTagsSpace = text.match(/<pre[^>]+mw_pre_from_space[^>]+>([\S\s]*?)<\/pre>/gmi);

		if (_preTagsSpace) {
			for (var i = 0; i < _preTagsSpace.length; i++) {
				innerPre = _preTagsSpace[i];
				innerPre = innerPre.replace(/<pre[^>]*>/i, "");
				innerPre = innerPre.replace(/<\/pre>/i, "");
				innerPreLines = innerPre.split(/\n/i);

				// This is ugly, however, sometimes tiny uses br instead of line breaks
				if (innerPreLines.length === 1) {
					innerPreLines = innerPre.split(/<br \/>/i);
				}
				for (var j = 0; j < innerPreLines.length; j++) {
					innerPreLines[j] = " " + innerPreLines[j];
				}
				innerPre = innerPreLines.join("\n");
				text = text.replace(_preTagsSpace[i], innerPre);
			}
		}
		return text;
	}

	function __preserveSingleLinebreaks($0, $1, $2, $3) {
		// hr table heading comment div end-table | ol ul dl dt comment cell row
		// there was mw_comment:@@@ in there: |@@@PRE.*?@@@$|\|$|mw_comment:@@@|^
		// DC add in html tags that are allowed in wikicode eg </ol>, </ul>, </li>, <br />so far
//		if ($2.match(/(----$|\|\}$|=$|-->$|<\/div>$|<\/pre>$|<@@@PRE.*?@@@>$|<@@@TAG.*?@@@>$|<@@@CMT.*?@@@>$|\|$|^(#|\*|:|;|<\!--|\|\||\|-)|<\/ol>|<\/ul>|<\/li>|(^\s*$))/i)) {
		if ($2.match(/(----$|\|\}$|=$|-->$|<\/div>$|<\/pre>$|<@@@PRE.*?@@@>$|\|$|^(#|\*|:|;|<\!--|\|\||\|-)|<br \/>|(^\s*$))/i)) {
			return $0;
		}
		// careful: only considers the first 5 characters in a line
		// DC add in html tags that are allowed in wikicode eg <ol, <ul, <li, </ol>, </ul>, </li> so far
		// DC TODO are there any others?
//		if ($3.match(/(^(----|\||!|\{\||#|\*|:|;|=|<\!--|<div|<pre|@@@PR)|(^\s*$))/i)) {
//		if ($3.match(/(^(----|\||!|\{\||#|\*|:|;|=|<\!--|<div|<pre|<@@@P|<ol>|<ul|<li|<\/ol>|<\/ul>|<\/li>)|(^\s*$))/i)) {
		if ($3.match(/(^(----|\||!|\{\||#|\*|:|;|=|<\!--|<div|<pre|<@@@P|<@@@T|<@@@C)|(^\s*$))/i)) {
			return $0;
		}
		_processFlag = true;
		if (_useNrnlCharacter) {
			return $1 + $2 + _slb + $3;
		} else {
			return $1 + $2 + $3;
		}
	}

	/*
	 * Preprocess HTML in DOM form. This is mainly used to replace tags
	 * @param {String} text
	 * @returns {String}
	 */
	function _preprocessHtml2Wiki( e ) {
		// convert html text to DOM
		var text = e.content,
			$dom,
			htmlPrefilter = $.htmlPrefilter,
			regex = 'contenteditable="false">[\\S\\s]*?<div class="mceNonEditableOverlay"></div>',
			matcher = new RegExp(regex, 'gmi');

		$.htmlPrefilter = function( html ) {
  			return html.replace(matcher, 'contenteditable="false"><*****>' );
		};

		text = $.htmlPrefilter(text);
		
		$dom = $( "<div id='tinywrapper'>" + text + "</div>" );

		// replace spans of class variable with their contents
		$dom.find( "span[class*='variable']" ).replaceWith( function() {
			return $( this ).html();
		} );

		// replace spans of class special with their contents
		$dom.find( "span[class*='special']" ).replaceWith( function() {
			return $( this ).html();
		} );

		// replace spans for underlining with u tags
		$dom.find( "span[style*='text-decoration: underline']" ).replaceWith( function() {
			return "<u>" + $( this ).html() + "</u>";
		} );

		// replace spans for strikethrough with s tags
		$dom.find( "span[style*='text-decoration: line-through']" ).replaceWith( function() {
			return "<s>" + $( this ).html() + "</s>";
		} );

		// replace spans of class tag with a placeholder to preserve their contents
		$dom.find( "span[class*='tag']" ).replaceWith( function(a) {
			return this.id;
		});

		// replace spans of class template with a placeholder to preserve their contents
		$dom.find( "span[class*='template']" ).replaceWith( function(a) {
			return this.id;
		});

		// replace spans of class comment with their wikitext
		$dom.find( "span[class*='comment']" ).replaceWith( function(a) {
			return decodeURI(this.getAttribute("data-mw-wikitext"));
		});

		// replace spans of class switch with their wikitext
		$dom.find( "span[class*='switch']" ).replaceWith( function(a) {
			return decodeURI(this.getAttribute("data-mw-wikitext"));
		});

		//replace style span wrappers with inner html
		while ($dom.find( "span[id*='_mce_caret']" ).length > 0 ) {
			$dom.find( "span[id*='_mce_caret']" ).replaceWith( function() {
				return $( this ).html();
			} );
		}

		// convert DOM back to html text
		text = $dom.html();

		//cleanup entities in attribtues
		while ( text.match( /(\="[^"]*?)(<)([^"]*?")/gmi ) ) {
			text = text.replace( /(\="[^"]*?)(<)([^"]*?")/g, '$1&lt;$3' );
		}
		while ( text.match( /(\="[^"]*?)(>)([^"]*?")/gmi ) ) {
			text = text.replace( /(\="[^"]*?)(>)([^"]*?")/g, '$1&gt;$3' );
		}

		//remove &; encoding
		text = text.replace(/(&[^\s]*?;)/gmi, function($0) {
			return tinymce.DOM.decode($0);
		});

		return text;
	}
	
	/*
	 * Postprocess html; to wikitext by recovering wikitext from placeholders.
	 * @param {String} text
	 * @returns {String}
	 */
	function _postprocessHtml2Wiki( e ) {

		//recover special tags to wiki code from placeholders
		e.content = _recoverTags2Wiki(e);
		// recover templates to wiki code from placeholders
		e.content = _recoverTemplates2Wiki(e);

		return e.content
	}

	/**
	 * Event handler for "beforeSetContent"
	 * This is used to process the wiki code into html.
	 * @param {tinymce.ContentEvent} e
	 */
	function _onBeforeSetContent(e) {
		// if raw format is requested, this is usually for internal issues like
		// undo/redo. So no additional processing should occur. Default is 'html'
		if (e.format == 'raw' ) return;
		e.format = 'raw';
		e.content = _wiki2html(e);
	}

	/**
	 * Event handler for "getContent".
	 * This is used to process html into wiki code.
	 * @param {tinymce.ContentEvent} e
	 */
	function _onGetContent(e) {
		// if raw format is requested, this is usually for internal issues like
		// undo/redo. So no additional processing should occur. Default is 'html'
		if ( e.format == 'raw' ) return;
		e.format = 'raw';
		// If content has already been selected by the user, use that.
		if ( !e.selection ) {
			var ed = tinymce.get(e.target.id);
			e.content= ed.getContent({source_view: true, no_events: true, format: 'raw'});
		}
		//get rid of blank lines at end of text
		e.content = tinymce.util.Tools.trim(e.content);
		// preprocess spans in html using placeholders where needed
		e.content = _preprocessHtml2Wiki(e);
		// convert the html to wikicode
		e.content = _html2wiki(e);
		// postprocess to recover wikitext from placeholders
		e.content = _postprocessHtml2Wiki(e);
		//get rid of blank lines at end of text
		e.content = tinymce.util.Tools.trim(e.content);
	}

	function _onLoadContent(ed, o) {
/*		var internalLinks = [],
			internalLinksTitles = [],
			titles;
		
		$(this.dom.doc).find('a.mw-internal-link').each(function(){
			var href = $(this).attr('data-mce-href');
			
			if( !href ) {
				href = $(this).attr('href');
			}
			
			internalLinksTitles.push( decodeURIComponent(href).replace("_"," ") );
			internalLinks.push($(this));
		});

		$(document).trigger( 'TinyMCErLoadContentBeforeCheckLinks', [
			this,
			internalLinksTitles,
			internalLinks
		]);

		if( internalLinksTitles.length == 0 ) return;
		
		titles = decodeURIComponent(internalLinksTitles[0]).replace("_"," ");
		for( var i = 1; i < internalLinksTitles.length; i++ ) {
			titles += "|" + decodeURIComponent(internalLinksTitles[i].replace("_"," "));
		}
		// DC now go and check the links to see if pages exist 
		var server = mw.config.get( "wgServer" ) ;
		var script = mw.config.get( 'wgScriptPath' ) + '/api.php';
		var data = {'action': 'query','titles': titles,'format': 'json',};
		$.ajax({
			dataType: "json",
			url: script,
			data: data,
			async: false,
			success: function(data) {
				if (typeof data.query.pages == "undefined") {
					for( var i = 0; i < internalLinksTitles.length; i++ ) {
						internalLinks[i].addClass( 'new' );
					}
				} else {
					var pages = data.query.pages;
					for( var page in pages ) {
						if ( !(typeof pages[page].missing == "undefined" && typeof pages[page].invalid == "undefined") ) {
							var pageTitle = pages[page].title
							for( var i = 0; i < internalLinksTitles.length; i++ ) {
								if (pageTitle == decodeURIComponent(internalLinksTitles[i].replace("_"," ")) ) {
									internalLinks[i].addClass( 'new' );
									internalLinks[i].context.attributes["title"].value += " (page does not exist)";
								}
							}
						}
					}
				}
			}
		});*/
		return;
	}

	function insertSingleLinebreak() {
		var args,

		args = {format: 'raw'};
		_ed.undoManager.transact(function(){
			_ed.focus();
			_ed.selection.setContent(_slb,args);
			_ed.undoManager.add();
		});
	}
	
	function showWikiMagicDialog() {
		var selectedNode = _ed.selection.getNode(),
			nodeType = '',
			isWikimagic = '',
			value = '';
			
		if (typeof(selectedNode.attributes["data-mw-type"]) !== "undefined" ) {
			nodeType = selectedNode.attributes["data-mw-type"].value;
			isWikimagic = 
				nodeType == "template" || 
				nodeType == "switch" || 
				nodeType == "tag" ||
				nodeType == "comment" ;	
		}

		if (isWikimagic) {
			value = decodeURI(selectedNode.attributes["data-mw-wikitext"].value);
		} else {
			value = _ed.selection.getContent({format : 'text'});
		}
		
		_ed.windowManager.open({
			title: mw.msg('tinymce-wikimagic-title'),
			body: {
				type: 'textbox', 
				name: 'code', 
				size: 40, 
				label: 'Code value', 
				multiline: true,
				minWidth: _ed.getParam("code_dialog_width", 600),
				minHeight: _ed.getParam("code_dialog_height", 
				Math.min(tinymce.DOM.getViewPort().h - 200, 500)),
				spellcheck: false,
				style: 'direction: ltr; text-align: left',
				value: value
				},
			onsubmit: function(e) {
				var text = e.data.code;
				e.content = text;
				text = _wiki2html(e);				
				_ed.undoManager.transact(function(){
					_ed.focus();
					_ed.selection.setContent(text, {format: 'raw'});
					_ed.undoManager.add();
					_ed.format = 'raw';
				});
				return;
			}
		});
	}
	
	function showWikiSourceCodeDialog() {
		var originalValue = _ed.getContent({source_view: true});

		var win = _ed.windowManager.open({
			title: mw.msg("tinymce-wikisourcecode"),
			body: {
				type: 'textbox',
				name: 'code',
				multiline: true,
				minWidth: _ed.getParam("code_dialog_width", 600),
				minHeight: _ed.getParam("code_dialog_height", 
				Math.min(tinymce.DOM.getViewPort().h - 200, 500)),
				spellcheck: false,
				style: 'direction: ltr; text-align: left',
			},
			onSubmit: function(e) {
				// We get a lovely "Wrong document" error in IE 11 if we
				// don't move the focus to the editor before creating an undo
				// transation since it tries to make a bookmark for the current selection
				_ed.focus();

				_ed.undoManager.transact(function() {
					e.load = true;
					_ed.setContent(e.data.code,e);
				});
				_ed.selection.setCursorLocation();
				_ed.nodeChanged();
			}, 
		});

		// Gecko has a major performance issue with textarea
		// contents so we need to set it when all reflows are done
		win.find('#code').value(originalValue);
	}

	this.init = function(ed, url) {
		var editClass = ed.getParam("noneditable_editable_class", "mceEditable"); // Currently unused
		var nonEditClass = ed.getParam("noneditable_noneditable_class", "mceNonEditable");

		_userThumbsize = _thumbsizes[ mw.user ? mw.user.options.get('thumbsize') : _userThumbsize ];
		_ed = ed;
		_scriptPath = mw.config.get( 'wgScriptPath' );
		_specialTagsList = _ed.getParam("wiki_tags_list");
		_specialTagsList += _ed.getParam("additional_wiki_tags");

		ed.on('beforeSetContent', _onBeforeSetContent);
		ed.on('getContent', _onGetContent);
		ed.on('loadContent', _onLoadContent);

		//
		// add in non rendered new line functionality
		//
		_useNrnlCharacter = ed.getParam("wiki_non_rendering_newline_character");
//		_slb = '<span class="single_linebreak" title="single linebreak" contenteditable="false">' + _useNrnlCharacter + '<div class="mceNonEditableOverlay"></div></span>';
		_slb = '<span class="single_linebreak" title="single linebreak">' + _useNrnlCharacter + '</span>';

		if (_useNrnlCharacter) {
			ed.addButton('singlelinebreak', {
				icon: 'visualchars',
				tooltip: mw.msg("tinymce-insert-linebreak"),
				onclick:  insertSingleLinebreak
			});
	
			ed.addMenuItem('singlelinebreak', {
				icon: 'visualchars',
				text: 'Single linebreak',
				tooltip: mw.msg("tinymce-insert-linebreak"),
				context: 'insert',
				onclick: insertSingleLinebreak
			});
		}
		
		//
		// add in wikimagic functionality
		//
		ed.addButton('wikimagic', {
			icon: 'codesample',
			stateSelector: '.wikimagic',
			tooltip: mw.msg( 'tinymce-wikimagic' ),
			onclick: showWikiMagicDialog/*,
			stateSelector: 'a:not([href])'*/
		});

		ed.addMenuItem('wikimagic', {
			icon: 'codesample',
			text: 'Wikimagic',
			tooltip: mw.msg( 'tinymce-wikimagic' ),
			context: 'insert',
			onclick: showWikiMagicDialog
		});
	  
		ed.addCommand('mceWikimagic', showWikiMagicDialog);
	  
		// Add option to double-click on switches to get
		// "wikimagic" popup.
		ed.on('dblclick', function(e) {
			if (e.target.className.includes("wikimagic")) {
				tinyMCE.activeEditor.execCommand('mceWikimagic');
			}
		});
	  
		// Add option to double-click on non-editable overlay to get
		// "wikimagic" popup.
		ed.on('dblclick', function(e) {
			if (e.target.className == 'mceNonEditableOverlay' ) {
				tinyMCE.activeEditor.execCommand('mceWikimagic');
			}
		});
		
		//
		// add in wiki source code functionality
		//
		ed.addCommand("mceWikiCodeEditor", showWikiSourceCodeDialog);

		ed.addButton('wikisourcecode', {
			icon: 'code',
			tooltip: mw.msg('tinymce-wikisourcecode'),
			onclick: showWikiSourceCodeDialog
		});
	
		ed.addMenuItem('wikisourcecode', {
			icon: 'code',
			text: mw.msg('tinymce-wikisourcecode-title'),
			context: 'tools',
			onclick: showWikiSourceCodeDialog
		});

	};

	this.getInfo = function() {
		var info = {
			longname: 'TinyMCE WikiCode Parser',
			author: 'Hallo Welt! GmbH, Duncan Crane at Aoxomoxoa Limited & Yaron Koren at Wikiworks',
			authorurl: 'http://www.hallowelt.biz, https://www.aoxomoxoa.co.uk, https://wikiworks.com/', 
			infourl: 'http://www.hallowelt.biz, https://www.aoxomoxoa.co.uk, https://wikiworks.com/'
		};
		return info;
	};

};

tinymce.PluginManager.add('wikicode', MwWikiCode);
