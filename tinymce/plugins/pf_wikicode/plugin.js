/**
 * VisualEditor extension
 *
 * Wiki code to HTML and vice versa parser
 *
 * @author     Markus Glaser <glaser@hallowelt.com>
 * @author     Sebastian Ulbricht
 * @author     Duncan Crane <duncan.crane@aoxomoxoa.co.uk>
 * @version    2.22.0

 * @package    Bluespice_Extensions
 * @subpackage VisualEditor - adapted and extended for use with PageForms extension of Mediawiki by Duncan Crane
 * @copyright  Copyright (C) 2016 Hallo Welt! GmbH, All rights reserved.
 * @license    http://www.gnu.org/copyleft/gpl.html GNU Public License v2 or later
 * @filesource
 */

/*global tinymce:true */
/*global mw:true */
/*global BlueSpice:true */

/*TODO: dc Fix so images always retain their aspect ratio when constrained by width or height as they do in mediawiki */

var BsWikiCode = function() {

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
		_templates,
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
		_specialtags,
		/**
		 *
		 * @type Array
		 */
		_switches,
		/**
		 *
		 * @type Array
		 */
		_entities,
		/**
		 * List of available thumbnail sizes
		 * @type Array
		 */
		_thumbsizes = ['120', '150', '180', '200', '250', '300'],
		/**
		 * Needed to fetch image urls from the server
		 * @type String
		 */
		_imageDummyUrl = '',
		/**
		 * One of the thumbnail sizes, choosen by the user in Spezial:Preferences
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
		_ed = null;

		var me = this;

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
			'class': "bs-ve-image",
			'border': 0,
			//'width': _userThumbsize,
			//HAD: display:inline-block; //Future: only CSS class
			'style':"cursor:move;"
		};
	};

	function _makeDataAttributeObject( obj ) {
		var data = {};
		for ( var property in obj ) {
			data['data-bs-'+property] = obj[property];
		}
		return data;
	}

	String.prototype.format = function () {
		var args = arguments;
		return this.replace(/{(\d+)}/g, function(match, number) {
			return typeof args[ number ] !== 'undefined' ? args[number] : match;
		});
	};

	$(document).on( "BSVisualEditorRenderSpecialTag", function( event, sender, type, st ){
		if ( type != 'bs:checklist' ) return false;
		var ed = tinymce.activeEditor;
		var specialtag = ed.dom.createFragment( st[0] ).childNodes[0];

		var cbt = ed.dom.getAttrib( specialtag, 'type', 'checkbox' );
		var valueText = ed.dom.getAttrib( specialtag, 'value', 'false' );
		var listText = ed.dom.getAttrib( specialtag, 'list', '' );

		var innerText;
		if ( cbt == 'checkbox' ) {
			if ( valueText == 'checked' ) {
				innerText = BsChecklist.makeCheckbox( true );
			} else {
				innerText = BsChecklist.makeCheckbox( false );
			}
		} else if ( cbt == 'list' ) {
			innerText = BsChecklist.makeSelectbox(
				BsChecklist.getOptionsList( listText ) , valueText
			);
		}

		var moreAttribs = 'data-bs-value="'+valueText+'"';
		moreAttribs += ' data-bs-cbtype="'+cbt+'"';

		return {
			innerText: innerText,
			moreAttribs: moreAttribs
		};
	});

	$(document).on( "BSVisualEditorRecoverSpecialTag", function( event, sender, specialTagMatch, innerText )	{
		if( specialTagMatch == null ) return false;
		var valueregex = '<.*?data-bs-value="(.*?)"[^>]*?>';
		var valueMatcher = new RegExp( valueregex, '' );
		var value = valueMatcher.exec( specialTagMatch[1] );
		var valueText;
		if ( value ) {
			valueText = value[1];
		} else {
			valueText = '';
		}
		var newInnerText = innerText.replace( /value="(.*?)"/, 'value="'+valueText+'"' );
		return {
			innerText: newInnerText
		}
	});

	$(document).on( "BSVisualEditorClickSpecialTag", function( event, sender, ed, e, dataname ){
		if ( dataname == 'bs:checklist' ) {
			var cbtype = ed.dom.getAttrib( e.target.parentNode, 'data-bs-cbtype' );
	
			if ( !cbtype ) {
				cbtype = 'checkbox';
			}

			var value = ed.dom.getAttrib( e.target.parentNode, 'data-bs-value' );
	
			if ( cbtype == 'checkbox' ) {
				if ( value == 'checked' ) {
					value = 'false';
					ed.dom.setStyle(e.target, 'background-image', "url('"+BsChecklist.checkboxImage+"')" );
				} else {
					value = 'checked';
					ed.dom.setStyle( e.target, 'background-image', "url('"+BsChecklist.checkboxImageChecked+"')" );
				}
			}

			ed.dom.setAttrib( e.target.parentNode, 'data-bs-value', value );
		}
	});

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

	function _image2html(link) {
		// @todo inline stylings taken from MediaWiki and adapted to TinyMCE markup. Not nice...
		var htmlImageObject = $('<img />').attr( me.makeDefaultImageAttributesObject() ),
			wikiImageObject = me.makeWikiImageDataObject(),
			parts = link.split("|"), part = '',
			unsuffixedValue, dimensions, kvpair, key, value, src, imgParts,
			imgName;

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

			if ($.inArray(part, ['thumb', 'mini', 'miniatur']) !== -1) {
				wikiImageObject.thumb = true;
				continue;
			}

			if ($.inArray(part, ['right', 'rechts']) !== -1) {
				wikiImageObject.left = false;
				wikiImageObject.right = true;
				wikiImageObject.align = 'right';
				continue;
			}

			if ($.inArray(part, ['left', 'links']) !== -1) {
				wikiImageObject.right = false;
				wikiImageObject.left = true;
				wikiImageObject.align = 'left';
				continue;
			}

			if ($.inArray(part, ['center', 'zentriert']) !== -1) {
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

			if ($.inArray(part, ['none', 'ohne']) !== -1) {
				wikiImageObject.none = true;
				continue;
			}

			if ($.inArray(part, ['frame', 'gerahmt']) !== -1) {
				wikiImageObject.frame = true;
				continue;
			}

			if ($.inArray(part, ['frameless', 'rahmenlos']) !== -1) {
				wikiImageObject.frameless = true;
				continue;
			}

			if ($.inArray(part, ['border', 'rand']) !== -1) {
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

			if ($.inArray(key, ['upright', 'hochkant']) !== -1) {
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


		// Workaround for HW#2013020710000217.
		// This is more a bug of InsertFile and should be fixed there.
		// @todo Check if this is still needed. In REL_1.21 the code for
		//       adding an alt tag in InsertFile has changed.
/*		if (wikiImageObject.caption) {
			htmlImageObject.attr('title', wikiImageObject.caption);
		}*/

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
		}

		return htmlImageObject[0].outerHTML;
	}

	function _image2wiki(text) {
		var images = text.match(/(<a([^>]*?)>)?<img([^>]*?)\/?>(<\/a>)?/gi);
		if (!images)
			return text;

		for (var i = 0; i < images.length; i++) {
			var image, htmlImageObject, wikiImageObject,
				attributes, attribute, wikiText, imageCaption,
				size, property, value;

			image = images[i];

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
				var pos = src.lastIndexOf("/");
				var srcfile = "File:" + src.slice(pos+1);
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

	//Make public available?
	//this.image2wiki = _image2wiki;

	function _links2html(text) {
		// internal links
		var links, link, linkNoWrap, linkParts, linkTarget, linkLabel, linkHtml,
			targetParts, fileExtension, targetTextParts, nsText, nsId,
			linkTargetParts, protocol, targetText,
			namespaces = mw.config.get('wgNamespaceIds'),
			imageExtensions = mw.config.get('wgFileExtensions'),
			anchorFormat = '<a href="{0}" data-mce-href="{5}" title="{6}" data-bs-type="{2}" class="{3}" data-bs-wikitext="{4}">{1}</a>';

		links = text.match(/\[\[([^\]]*?)\]\]/gi);
		var pos = 0;
		var squareBraceDepth = 0;
		var checkedBraces = new Array();
		var linkDepth = 0;
		var tempTemplate = '';
		var squareBraceFirst = false;
		var _links = new Array();
		for (pos = 0; pos < text.length; pos++) {
			if (text[pos] === '[') {
				squareBraceDepth++;
				if ( checkedBraces.indexOf(pos) == -1 && text[pos + 1] === '[') {
					checkedBraces.push(pos + 1);
					linkDepth++;
				}
			}

			// Caution: this matches only from the second curly brace.
			if (linkDepth && !squareBraceFirst) {
				if (linkDepth > 1 && text[pos] == '|' ) tempTemplate = tempTemplate + '@@PIPE@@';
				//if (text[pos] == '|' ) tempTemplate = tempTemplate + '@@PIPE@@';
				else tempTemplate = tempTemplate + text[pos];
			}
			if (text[pos] === ']') {
				squareBraceDepth--;
				if ( checkedBraces.indexOf(pos-1) == -1 && text[pos - 1] === ']') {
					checkedBraces.push(pos);
					linkDepth--;
				}
				if (linkDepth === 0 && !squareBraceFirst) {
					if (tempTemplate !== '')
						_links.push(tempTemplate);
					tempTemplate = '';
				}
			}
		}

		links = _links;

		if (links) {
			for (var i = 0; i < links.length; i++) {
				link = links[i].substr(2, links[i].length - 4);
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

				linkHtml = anchorFormat.format(
					encodeURI( 'bs://' + linkTarget ),//escape(linkTarget),	// href
					linkLabel,					// <a>linkLabel</a>
					'internal_link',				// data-bs-type
					'internal bs-internal-link mceNonEditable',	// class
					encodeURI( $('<div/>').text(link).html() ),	// data-bs-wikitext
					encodeURI( linkTarget ),			// data-mce-href
					linkTarget,					// title
				);

				targetParts = linkTarget.split(":");
				if (targetParts.length > 1) {
					nsText = targetParts[0];
					nsId = namespaces[nsText.toLowerCase()];
/* dc images namespace is always 6 so lets just test for that instead
					if (nsId === bs.ns.NS_IMAGE) {
*/
					if (nsId === 6) {
						targetTextParts = linkTarget.split(".");
						fileExtension = targetTextParts[targetTextParts.length - 1];
/* dc since its already in the wiki text lets assume that it is an image file for now
						if ($.inArray(fileExtension.toLowerCase(), imageExtensions) !== -1) {
							linkHtml = _image2html(link);
						}
*/
						linkHtml = _image2html(link);
					}
				}

				link = link.replace( "@@PIPE@@", "|" );
				text = text.replace("[[" + link + "]]", linkHtml);
			}
		}

		//Also find protocol independent links

		links = text.match(/\[([^\]]*)(:)?\/\/([^\]]*?)\]/gi);
		if (links) {
			for (i = 0; i < links.length; i++) {
				linkNoWrap = links[i].substr(1, links[i].length - 2);

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
					'external_link',				// data-bs-type
					'external bs-external-link mceNonEditable bs-protocol-'+protocol,// class
					$( '<div/>' ).text( link ).html(),		// data-bs-wikitext
					encodeURI( linkTarget.replace( /%20/g, ' ' ) ),	// data-mce-href
					$( '<div/>' ).text( linkLabel ).html()		// title
				);
				text = text.replace("[" + linkNoWrap + "]", linkHtml);
			}
		}
		return text;
	}

	function _links2wiki(text) {
		var links, linkwiki, type, target, label,
			link, hrefAttr, inner, typeAttr, validProtocol, wikitext;

		links = text.match(/<a(.*?)<\/a>/gi);
		linkwiki = '';
		if (links) {
			for (var i = 0; i < links.length; i++) {
				type = false;
				target = false;
				label = false;

				link = links[i];

				hrefAttr = link.match(/href="(.*?)"/i);
				if (!hrefAttr) {
					//This is an anchor tag which is not supported.
					text = text.replace(links[i], "");
					continue;
				}
				if (hrefAttr) {
					target = decodeURI( hrefAttr[1] );
					// 03.03.2014 STM ??? target = target; //unescape(target);
				}
				// @todo <br /> br-tags bereits in insertLink abfangen oder hier einfÃ¼gen
				inner = link.match(/>(.*?)<\/a>/i);
				if (inner) {
					label = inner[1];
					label = label.replace(/<br.*?\/>/gi, '');
					// label comes with encoded html entities, so we need to decode this here.
					// Otherwise, resolution of special characters like umlauts won't work.
					label = $('<textarea />').html(label).text();
				}

				//TODO: Maybe we should relay on classes instead?
				typeAttr = link.match(/data-bs-type="(.*?)"/i);
				if (typeAttr) {
					type = decodeURI( typeAttr[1] );
				}

				wikitext = link.match(/data-bs-wikitext="(.*?)"/i);
				if (wikitext) {
					wikitext = decodeURI( wikitext[1] );
				}

				if (wikitext) {
					if (wikitext.indexOf("|") == wikitext.length-1) {
						if (wikitext.replace(/(.*:)?([^,\(]*)(.*)\|/, "$2") == label) {
							label = "";
						}
					}
				}

				if (type === "internal_link") {
					if (target === label ) { //TinyMCE3: tinymce.activeEditor.dom.decode(label)
						linkwiki = "[[" + target + "]]";
					} else {
						linkwiki = "[[" + target + "|" + label + "]]";
					}
				} else {
					//TinyMCE seems to eat double slashes of no-http (https,
					//or protocol independent) hrefs.
					//This is a ugly fix, it may have side effects
					validProtocol = target.match(/\:\/\//i);
					if( validProtocol == null ) {
						if( target.match(/file\:\//i) ) { // even uglier - file:///
							target = target.replace( ':/', ':///' );
						} else {
							target = target.replace( ':/', '://' );
						}
					}
					//if( label == target ) {
					//	linkwiki = "[" + target + "]";
					//} else {
					target = target.replace( / /g, '%20' );
					if ( type === "external_link" && wikitext.indexOf(" ") == -1 && unescape( label.match(/^\[\d+\]$/) ) ) {
						linkwiki = "[" + target + "]";
					} else {
						linkwiki = "[" + target + " " + label + "]";
					}
					//}
				}
				text = text.replace(links[i], linkwiki);
			}
		}

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
	function _tablesAttrCleanUp(attr, elm) {
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
	function _tables2html(text) {
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
		// there is an IE bug with split: split(\n) will not produce an extra element with \n\n.
		// therefore, some blindtext is inserted which is removed at the end of this section
		// in first pass, some double empty lines remain, therefore, a second pass is necessary
		text = text.replace(/\n\n/gmi, "\n@@blindline@@\n");
		text = text.replace(/\n\n/gmi, "\n@@blindline@@\n");

		// images or links in tables may contain | in their attributes, esp. in bs-data-*. These
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
							innerLines = innerLines + lines[i] + "\n";
							lines.splice(i, 1);
							i--;
						} else if (lines[i].match(/^\|\}/gi)) {
							if (nestLevel > 1) {
								innerLines = innerLines + lines[i] + "\n";
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
							innerLines = innerLines + lines[i] + "\n";
							lines.splice(i, 1);
							i--;
						}
					}
					i++;
					innerTable = _tables2html(innerLines);
					lines.splice(i, 0, innerTable);
					continue;
				}
				tableAttr = line[0].substr(2, line[0].length);
				if (tableAttr !== '') {
					tableAttr = " " + tableAttr;
				}
				lines[i] = "<table" + tableAttr + ">";
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
				lines[i] = closeLine + "</table>" + line[0].substr(2, line[0].length);
				inTr = inTd = inTh = inTable = false;
			} else if ((i === (start + 1)) && (line = lines[i].match(/^\|\+(.*)/gi))) {
				lines[i] = "<caption>" + line[0].substr(2) + "</caption>";
			} else if (line = lines[i].match(/^\|\-(.*)/gi)) {
				endTd = '';
				attr = _tablesAttrCleanUp(line[0].substr(2, line[0].length), 'row');
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
						tdAttr = _tablesAttrCleanUp(cont[0], 'cell');
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
						tdAttr = _tablesAttrCleanUp(cont[0], 'cell');
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
		text = text.replace(/@@blindline@@/gmi, '');
		text = text.replace(/@@pipe@@/gmi, '|');

		return text;
	}

	function _tables2wiki(text) {
		//cleanup thead and tbody tags. Caution: Must be placed before th cleanup because of
		//regex collision

		text = text.replace(/<(\/)?tbody([^>]*)>/gmi, "");
		text = text.replace(/<(\/)?thead([^>]*)>/gmi, "");
		text = text.replace(/<(\/)?tfoot([^>]*)>/gmi, "");

/* DC use {{!}} instead of | since this will be a value passed to a template
		text = text.replace(/\n?<table([^>]*)>/gmi, "\n{|$1");
		text = text.replace(/\n?<\/table([^>]*)>/gi, "\n|}");
		text = text.replace(/\n?<caption([^>]*)>/gmi, "\n|+$1");
		text = text.replace(/\n?<\/caption([^>]*)>/gmi, "");

		text = text.replace(/\n?<tr([^>]*)>/gmi, "\n|-$1");
		text = text.replace(/\n?<\/tr([^>]*)>/gmi, "");

		text = text.replace(/\n?<th([^>]*)>/gmi, "\n!$1|");
		text = text.replace(/\n?<\/th([^>]*)>/gmi, "");

		text = text.replace(/\n?<td([^>]*)>/gmi, "\n|$1|");
		// @todo \n raus??
		text = text.replace(/\n?<\/td([^>]*)>/gmi, "");

		text = text.replace(/\|\|&nbsp;/gi, "||");*/
/* DC use {{!}} instead of | since this will be a value passed to a template*/
		text = text.replace(/\n?<table([^>]*)>/gmi, "\n{{{!}}$1");
		text = text.replace(/\n?<\/table([^>]*)>/gi, "\n{{!}}}");
		text = text.replace(/\n?<caption([^>]*)>/gmi, "\n{{!}}+$1");
		text = text.replace(/\n?<\/caption([^>]*)>/gmi, "");

		text = text.replace(/\n?<tr([^>]*)>/gmi, "\n{{!}}-$1");
		text = text.replace(/\n?<\/tr([^>]*)>/gmi, "");

		text = text.replace(/\n?<th([^>]*)>/gmi, "\n!$1{{!}}");
		text = text.replace(/\n?<\/th([^>]*)>/gmi, "");

		text = text.replace(/\n?<td([^>]*)>/gmi, "\n{{!}}$1{{!}}");
		// @todo \n raus??
		text = text.replace(/\n?<\/td([^>]*)>/gmi, "");

		text = text.replace(/\|\|&nbsp;/gi, "{{!}}{{!}}");

		return text;
	}

	/**
	 * Converts MW list markers to HTML list open tags
	 *
	 * @param {String} lastList
	 * @param {String} cur
	 * @returns {String}
	 */
	function _openList(lastList, cur) {
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
	function _closeList(lastList, cur) {
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
	function _continueList(lastList, cur) {
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

	function _blockLevels2html(text) {
		var
			lines = text.split("\n"),
			lastList = '',
			line = '',
			inParagraph = false,
			inBlock = false,
			matchStartTags = false,
			matchEndTags = false,
			emptyLineCount = 0,
			emptyLineBefore = false,
			emptyLine = false,
			emptyLineAfter = false,
			lastLine = false;

                // Walk through text line by line
		for (var i = 0; i < lines.length; i++) {
			// Prevent REDIRECT from being rendered as list
			line = lines[i].match(/^(\*|#(?!REDIRECT)|:|;)+/);
			lastLine = (i == lines.length - 1);

                        //Special Line --
			if (line && line !== '') {
				lines[i] = lines[i].replace(/^(\*|#|:|;)*\s*(.*?)$/gmi, "$2");
				if (line[0].indexOf(':') === 0) {
					if (line[0].length === lastList.length) {
						lines[i] = _continueList(lastList, line[0]) + lines[i];
					}
					if (line[0].length > lastList.length) {
						lines[i] = _openList(lastList, line[0]) + lines[i];
					}
					if (line[0].length < lastList.length) {
						lines[i] = _closeList(lastList, line[0]) + lines[i];
					}
				} else {
					if (line[0].length === lastList.length) {
						lines[i] = _continueList(lastList, line[0]) + lines[i];
					}
					if (line[0].length > lastList.length) {
						lines[i] = _openList(lastList, line[0]) + lines[i];
					}
					if (line[0].length < lastList.length) {
						lines[i] = _closeList(lastList, line[0]) + '<li>' + lines[i];
					}
				}
				lastList = line[0];

				if (inParagraph) {
					lines[i] = '</p>' + lines[i];
					inParagraph = false;
				}

			} else { //Normal Line processing
				emptyLine = lines[i].match(/^(\s|&nbsp;)*$/);
				if (emptyLine) {
					emptyLineCount++;
				} else {
					emptyLineCount = 0;
				}

				emptyLineAfter = false;
				if (i < lines.length - 1) {
					emptyLineAfter = lines[i + 1].match(/^(\s|&nbsp;)*$/);
				}

				if (lastList.length > 0) {
					lines[i - 1] = lines[i - 1] + _closeList(lastList, '');
					lastList = '';
					if (emptyLine) {
						emptyLineBefore = true;
						continue;
					}
				}

				matchStartTags = false;
				matchEndTags = false;

				matchStartTags = lines[i].match(/^(<table|<blockquote|<h1|<h2|<h3|<h4|<h5|<h6|<pre|@@@PRE|<tr|<td|<p|<div|<ul|<ol|<li|<\/tr|<\/td|<\/th|<hr)/gi);
				// Achtung!! Habe gegenÃ¼ber MW-Parser hier td und th und /table rausgenommen. Wenn das mal gut geht... Nachtrag: ist mom. obsolet
				matchEndTags = lines[i].match(/(<\/blockquote|<\/h1|<\/h2|<\/h3|<\/h4|<\/h5|<\/h6|<\/?div|<hr|<\/pre|@@@PRE|<\/p|<\/li|<\/ul|<\/ol|<\/?center|<td|<th|<\/table)/gi);

				// hopefully temporary measure. divs with one or two empty lines in between are rendered correctly using these two variables
				var specialClosematchBefore = false;
				var specialClosematchTwoBefore = false;
				if (i > 0) {
					specialClosematchBefore = lines[i - 1].match(/(<\/div)/gi);
				}
				if (i > 1) {
					specialClosematchTwoBefore = lines[i - 2].match(/(<\/div)/gi);
				}

				// if a tag is in beforeBlock, an extra linebreak is inserted on second empty line.
				// use this, if lines seem to vanish
				// do not use hr here
				var beforeBlock = false;
				if (i < lines.length - 1) {
					beforeBlock = lines[i + 1].match(/^(<blockquote|<ul|<ol|<h1|<h2|<h3|<h4|<h5|<h6|<pre|@@@PRE|<td|<table|<tr|<div|\*|#|:|\{\|)/gi);
				}

				if (matchStartTags) {
					inBlock = true;
				}
				if (matchEndTags) {
					inBlock = false;
				}

				if (emptyLine) {
					emptyLineBefore = true;

					if (inParagraph) {
						lines[i] = lines[i] + '</p>';
						inParagraph = false;
					} else {
						//this is experimental (09.07.2009 MRG)
						if (emptyLineCount === 1 && (emptyLineAfter || specialClosematchBefore)) {
							continue;
						}

						if ((emptyLineCount % 2 === 0) && (emptyLineAfter || beforeBlock || specialClosematchTwoBefore)) {
							lines[i] = lines[i] + '<p class="bs_emptyline_first"><br class="bs_emptyline_first"/>';
						} else {
							if (!lastLine) {
								lines[i] = lines[i] + '<p class="bs_emptyline"><br class="bs_emptyline"/>';
							}
						}
						inParagraph = true;
					}
					continue;

				}

				if (!matchStartTags && !inParagraph && !inBlock && !matchEndTags) {
					lines[i] = '<p>' + lines[i];
					inParagraph = true;
				} else if (!matchStartTags && emptyLineBefore && !inBlock && !matchEndTags && inParagraph) {
					lines[i] = '</p><p>' + lines[i];
					inParagraph = true;
				}

				if (matchStartTags && inParagraph) {
					lines[i] = '</p>' + lines[i];
					inParagraph = false;
				}

				// 090929-- MRG. this was deactivated. Highly experimental!!
				// @todo Plays anybody still with that or can it go to trash?
				if (false && matchEndTags && !inParagraph && !inBlock) {
					lines[i] = lines[i] + '<p>';
					inParagraph = true;
				}

				if (i === (lines.length - 1)) {
					if (inParagraph) {
						inParagraph = false;
						lines[i] = lines[i] + '</p>';
					}
				}

				emptyLineBefore = false;
			}
		}

		return lines.join("\n");
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
		return lineStart + "<h" + level.length + ">" + content + "</h" + level.length + ">\n";
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _wiki2html(text) {

		// save some work, if the text is empty
		if (text === '') {
			return text;
		}
		// wrap the text in an object to send it to event listeners
		var textObject = {text: text};
		// call the event listeners
		$(document).trigger('BsVisualEditorBeforeWikiToHtml', [textObject]);
		// get the text back
		text = tinymce.util.Tools.trim(textObject.text);
		// @todo it's done before in _preprocessWiki2Html, can we save this step?
		text = _preservePres(text);

		//normalize line endings to \n
		text = text.replace(/\r\n/gi, '\n');

		// table preprocessing -- this is used to make sure every cell begins in a single line
		// do not use m flag here in order to get ^ as line beginning
		// @todo: should this be placed in tables2html?? and is a split at || in this function not obsolete?
		text = text.replace(/(^|.+?)(\|\|)/gi, '$1\n\|');
		text = text.replace(/\n\|\}\n?/gmi, '\n\|\}\n');

		// br preprocessing
		text = text.replace(/<br(.*?)>/gi, function(match, p1, offset, string) {
			return '<br data-attributes="' + encodeURI(p1) + '" />'; // @todo: Use JSON.stringify when dropping IE7 support
		});

		// simple formatting
		// the ^' fixes a problem with combined bold and italic markup
		text = text.replace(/'''([^'\n][^\n]*?)'''([^']?)/gmi, '<strong>$1</strong>$2');
		text = text.replace(/''([^'\n][^\n]*?)''([^']?)/gmi, '<em>$1</em>$2');

		/*
		 text = text.replace(/(^|\n)?========(.+?)========(\n+|$)/gmi, '$1<h8>$2</h8>\n');
		 text = text.replace(/(^|\n)?=======(.+?)=======(\n+|$)/gmi, '$1<h7>$2</h7>\n');
		 text = text.replace(/(^|\n)?======(.+?)======(\n+|$)/gmi, '$1<h6>$2</h6>\n');
		 text = text.replace(/(^|\n)?=====(.+?)=====(\n+|$)/gmi, '$1<h5>$2</h5>\n');
		 text = text.replace(/(^|\n)?====(.+?)====(\n+|$)/gmi, '$1<h4>$2</h4>\n');
		 text = text.replace(/(^|\n)?===(.+?)===(\n+|$)/gmi, '$1<h3>$2</h3>\n');
		 text = text.replace(/(^|\n)?==(.+?)==(\n+|$)/gmi, '$1<h2>$2</h2>\n');
		 text = text.replace(/(^|\n)?=(.+?)=(\n+|$)/gmi, '$1<h1>$2</h1>\n');
		 */

		// faster replacement for header processing
		// One regexp to rule them all, on regexp to find them,
		// one regexp to bring them all and in html bind them!!!
		text = text.replace(/(^|\n)((?:=){1,6})\s*(.+?)\s*\2(?:\n+|$)/img, _wikiHeader2html);

		// horizontal rule
		text = text.replace(/^\n?----\n?/gmi, "\n<hr>\n");

		// process links
		text = _links2html(text);

		// process tables
		text = _tables2html(text);

		// We need this additional line in order to clean up the last blocklevel
		text = text + "\n";

		// process block levels
		text = _blockLevels2html(text); //TODO: Fix missing break here, add <br /> for simple linebreaks

		// @todo check this, might be unneccessary
		text = text.replace(/<div style='text-align:left'>(.*?)<\/div>/gmi, "<div align='left'>$1</div>");
		text = text.replace(/<div style='text-align:right'>(.*?)<\/div>/gmi, "<div align='right'>$1</div>");
		text = text.replace(/<div style='text-align:center'>(.*?)<\/div>/gmi, "<div align='center'>$1</div>");
		text = text.replace(/<div style='text-align:justify'>(.*?)<\/div>/gmi, "<div align='justify'>$1</div>");

		// delete additional line feeds
		text = text.replace(/\n/gi, "");

		// fill empty table cells
		// @todo maybe in the _table2html method
		text = text.replace(/<td([^>]*)>(\s|<br([^>]*)>)*<\/td>/gmi, '<td$1><br mce_bogus="1" /></td>');
		text = text.replace(/<th([^>]*)>\s*<\/th>/gmi, '<th$1><br mce_bogus="1" /></th>');

		//check if text ends with </table>, need to insert something after the table
		//otherwise you won't be able to write after the table
		if (text.indexOf("</table>", text.length - 8) !== -1)
			text += "<br mce_bogus='1' />";

		// clean up bogus code when spans are in a single line
		text = text.replace(/<p>((<span([^>]*)>\s*)+)<\/p>/gmi, '$1');
		text = text.replace(/<p>((<\/span>\s*)+)<\/p>/gmi, '$1');

		//Write back content of <pre> tags.
		text = _recoverPres(text);

		//In some cases (i.e. Editor.insertContent('<img ... />') ) the content
		//is not parsed. We do not want to append any stuff in this case.
		if( text == textObject.text || text == '<p>'+textObject.text+'</p>' ) {
			text = textObject.text;
		}
		else {
			//<p> is neccessary to fix Ticket#2010111510000021. do not use <p>
			//in the complementary line in html2wiki
			text = text + '<p><br class="bs_lastline" /></p>';
		}

		// this reverts the line above. otherwise undo/redo will not work
		text = text.replace(/<p><br [^>]*bs_lastline[^>]*><\/p>/gmi, '');
		text = text.replace(/<br data-attributes="" \/>/gmi, '<br/>');
		text = text.replace(/<br data-attributes="[^>]*data-mce-bogus[^>]*" \/>/gmi, '');
		text = text.replace(/<br [^>]*data-mce-bogus="1"[^>]*>/gmi, '');

		// wrap the text in an object to send it to event listeners
		textObject = {text: text};
		// call the event listeners
		$(document).trigger('BSVisualEditorAfterWikiToHtml', [textObject]);
		// get the text back
		text = textObject.text;

		return text;
	}

	function _htmlFindList(text) {
		return text.search(/(<ul|<ol|<li( |>)|<\/?dl|<\/?dt|<blockquote[^>]*?>|<\/li( |>)|<\/ul|<\/ol|<\/blockquote|<p( |>)|<\/p( |>)|<h[1-6]|<hr)/);
	}
	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _html2wiki(text) {
		// save some work, if the text is empty
		if (text === '') {
			return text;
		}
		// remove useless white spaces
		text = tinymce.util.Tools.trim(text);
		// wrap the text in an object to send it to event listeners
		var textObject = {text: text};
		// call the event listeners
		$(document).trigger('BSVisualEditorBeforeHtmlToWiki', [textObject]);
		// get the text back
		text = textObject.text;
		// Normalize UTF8 spaces as of TinyMCE 3.4.9
		text = text.replace(/\u00a0/gi, '');
		//Save content of pre tags
		text = _preservePres(text);

		text = text.replace(/\n/gi, "");

		text = text.replace(/<strong>(.*?)<\/strong>/gmi, "'''$1'''");
		text = text.replace(/<b>(.*?)<\/b>/gmi, "'''$1'''");
		text = text.replace(/<em>(.*?)<\/em>/gmi, "''$1''");
		text = text.replace(/<i>(.*?)<\/i>/gmi, "''$1''");
		//underline needs no conversion
		text = text.replace(/<strike>(.*?)<\/strike>/gi, "<s>$1</s>");
/*		text = text.replace(/<span style="text-decoration: line-through;">(.*?)<\/span>/gi, "<s>$1</s>");
		text = text.replace(/<span style="text-decoration: underline;">(.*?)<\/span>/gi, "<u>$1</u>");*/
		//sub and sup need no conversion

		text = text.replace(/<br class="bs_emptyline_first"[^>]*>/gmi, "@@br_emptyline_first@@");

		// if emptyline_first is no longer empty, change it to a normal p
		text = text.replace(/<p class="bs_emptyline_first"[^>]*>&nbsp;<\/p>/gmi, '<p>@@br_emptyline_first@@</p>'); // TinyMCE 4
		text = text.replace(/<p class="bs_emptyline_first"[^>]*>(.*?\S+.*?)<\/p>/gmi, "<p>$1</p>");
		text = text.replace(/<p class="bs_emptyline_first"[^>]*>.*?<\/p>/gmi, "<p>@@br_emptyline_first@@</p>");
		text = text.replace(/<br class="bs_emptyline"[^>]*>/gmi, "@@br_emptyline@@");
		// if emptyline is no longer empty, change it to a normal p
		text = text.replace(/<p class="bs_emptyline"[^>]*>&nbsp;<\/p>/gmi, '<p>@@br_emptyline@@</p>'); // TinyMCE 4
		text = text.replace(/<p class="bs_emptyline"[^>]*>(.*?\S+.*?)<\/p>/gmi, "<p>$1</p>");
		text = text.replace(/<p class="bs_emptyline"[^>]*>(.*?)<\/p>/gmi, "<p>@@br_emptyline@@</p>");
		text = text.replace(/<br mce_bogus="1"\/>/gmi, "");

		text = text.replace(/<br.*?>/gi, function(match, offset, string) {
			var attributes = $(match).attr('data-attributes');
			if (typeof attributes === 'undefined' || attributes == "") {
				attributes = ' /';
			}
			return '<br' + decodeURI(attributes) + '>';
		});

		text = text.replace(/(<span class="variable">(.*?)<\/span>)/gmi, "$2");
		text = text.replace(/(<span class="special">(.*?)<\/span>)/gmi, "$2");

		text = _image2wiki(text);
		text = _links2wiki(text);

		// @todo this needs to be placed in front of the blocklevel or put within
		text = text.replace(/\n?<p style="([^"]*?)">(.*?)<\/p>/gmi, "\n<div style='$1'>$2</div>\n");
		text = text.replace(/\n?<p style="text-align:\s?left;?">(.*?)<\/p>/gmi, "\n<div style='text-align: left'>$1</div>\n");
		text = text.replace(/\n?<p style="text-align:\s?right;?">(.*?)<\/p>/gmi, "\n<div style='text-align: right'>$1</div>\n");
		text = text.replace(/\n?<p style="text-align:\s?center;?">(.*?)<\/p>/gmi, "\n<div style='text-align: center'>$1</div>\n");
		text = text.replace(/\n?<p style="text-align:\s?justify;?">(.*?)<\/p>/gmi, "\n<div style='text-align: justify'>$1</div>\n");

		text = text.replace(/<\/div>\n?/gmi, "</div>\n");

		text = text.replace(/\n?<p style=('|")padding-left: 30px;('|")>([\S\s]*?)<\/p>/gmi, "<blockquote>$3</blockquote>");
		text = text.replace(/\n?<p style=('|")padding-left: 60px;('|")>([\S\s]*?)<\/p>/gmi, "<blockquote><blockquote>$3</blockquote>");
		text = text.replace(/\n?<p style=('|")padding-left: 90px;('|")>([\S\s]*?)<\/p>/gmi, "<blockquote><blockquote><blockquote>$3</blockquote>");

		text = text.replace(/\n?<div style=('|")padding-left: 30px;('|")>([\S\s]*?)<\/div>/gmi, "<blockquote>$3</blockquote>");
		text = text.replace(/\n?<div style=('|")padding-left: 60px;('|")>([\S\s]*?)<\/div>/gmi, "<blockquote><blockquote>$3</blockquote>");
		text = text.replace(/\n?<div style=('|")padding-left: 90px;('|")>([\S\s]*?)<\/div>/gmi, "<blockquote><blockquote><blockquote>$3</blockquote>");

		//replace simple divs by p
		text = text.replace(/<div>(.*?)<\/div>/gmi, "<p>$1</p>");

		var listTag, currentPos, nextPos, oldText;
		listTag = '';

		// careful in the upcoming code: .*? does not match newline, however, [\s\S] does.
		nextPos = _htmlFindList(text);
		while (nextPos !== -1) {
			oldText = text;
			switch (text.substr(nextPos, 2).toLowerCase()) {
				case '<p' :

					// Todo: putting these lines straight in row might lead to strange behaviour
					currentPos = text.search(/<p[^>]*>(<span[^>]*bs_comment[^>]*>[\s\S]*?<\/span>[\s\S]*?)<\/p>/mi);
					if (currentPos === nextPos) {
						text = text.replace(/<p[^>]*>(<span[^>]*bs_comment[^>]*>[\s\S]*?<\/span>[\s\S]*?)<\/p>/mi, "$1");
					}
					currentPos = text.search(/<p(\s+[^>]*?)?>\s*(\s|<br ?\/>)\s*<\/p>/mi);
					if (currentPos === nextPos) {
						text = text.replace(/\n?<p(\s+[^>]*?)?>\s*(\s|<br ?\/>)\s*<\/p>/mi, "\n\n");
					}
					currentPos = text.search(/<p(\s+[^>]*?)?>(\s| |&nbsp;)*?<\/p>/mi);
					if (currentPos === nextPos) {
						text = text.replace(/\n?<p(\s+[^>]*?)?>(\s| |&nbsp;)*?<\/p>/mi, "\n\n");
					}
					//THIS IS EXPERIMENTAL: If anything breaks, put in a second \n at the end
					currentPos = text.search(/<p(\s+[^>]*?)?>([\s\S]*?)<\/p>/mi);
					if (currentPos === nextPos) {
						text = text.replace(/\n?<p(\s+[^>]*?)?>([\s\S]*?)<\/p>/mi, "\n$2\n\n");
					}
					break;
			}
			switch (text.substr(nextPos, 3)) {
				case '</p' :
					text = text.replace(/<\/p>/, "");
					break;
				case '<h1' :
					text = text.replace(/\n?<h1.*?>(.*?)<\/h1>\n?/mi, "\n=$1=\n");
					break;
				case '<h2' :
					text = text.replace(/\n?<h2.*?>(.*?)<\/h2>\n?/mi, "\n==$1==\n");
					break;
				case '<h3' :
					text = text.replace(/\n?<h3.*?>(.*?)<\/h3>\n?/mi, "\n===$1===\n");
					break;
				case '<h4' :
					text = text.replace(/\n?<h4.*?>(.*?)<\/h4>\n?/mi, "\n====$1====\n");
					break;
				case '<h5' :
					text = text.replace(/\n?<h5.*?>(.*?)<\/h5>\n?/mi, "\n=====$1=====\n");
					break;
				case '<h6' :
					text = text.replace(/\n?<h6.*?>(.*?)<\/h6>\n?/mi, "\n======$1======\n");
					break;
				case '<hr' :
					text = text.replace(/\n?<hr.*?>/mi, "\n----");
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
					text = text.replace(/<dt[^>]*?>/, "\n" + listTag + " ");
					break;
				case '<li' :
					if (text.search(/<li[^>]*?>\s*(<ul[^>]*?>|<ol[^>]*?>)/) === nextPos) {
						text = text.replace(/<li[^>]*?>/, "");
					} else {
						text = text.replace(/\n?<li[^>]*?>/mi, "\n" + listTag + " ");
					}
					break;
			}

			switch (text.substr(nextPos, 4)) {
				case '<blo' :
					listTag = listTag + ':';
					if (text.search(/(<blockquote[^>]*?>\s*(<ul>|<ol>))|(<blockquote[^>]*?>\s*<blockquote[^>]*?>)/) === nextPos) {
						text = text.replace(/<blockquote[^>]*?>/, "");
					} else {
						text = text.replace(/\n?<blockquote[^>]*?>/mi, "\n" + listTag + " ");
					}
					break;
				case '</ul'	:
					listTag = listTag.substr(0, listTag.length - 1);
					if (listTag.length > 0) {
						text = text.replace(/<\/ul>/, "");
					} else {
						text = text.replace(/<\/ul>/, "\n");
					}
					break;
				case '</ol' :
					listTag = listTag.substr(0, listTag.length - 1);
					//prevent newline after last blockquote
					if (listTag.length > 0) {
						text = text.replace(/<\/ol>/, "");
					} else {
						text = text.replace(/<\/ol>/, "\n");
					}
					break;
				case '</dl' :
					listTag = listTag.substr(0, listTag.length - 1);
					//prevent newline after last blockquote
					if (listTag.length > 0) {
						text = text.replace(/<\/dl>/, "");
					} else {
						text = text.replace(/<\/dl>/, "\n");
					}
					break;
				case '</dt' :
					listTag = listTag.substr(0, listTag.length - 1);
					text = text.replace(/<\/dt>/, "");
					break;
				case '</li' :
					text = text.replace(/\n?<\/li>/mi, "\n");
					break;
				case '</bl' :
					listTag = listTag.substr(0, listTag.length - 1);
					if (text.search(/<\/blockquote>\s*<blockquote[^>]*?>/) === nextPos) {
						text = text.replace(/\n?<\/blockquote>\s*<blockquote[^>]*?>/, "\n<blockquote>");
					} else if (text.search(/<\/blockquote>\s*<\/blockquote>/) === nextPos) {
						text = text.replace(/<\/blockquote>/, "");
					} else if (text.search(/<\/blockquote>\s*<\/li>/) === nextPos) {
						text = text.replace(/<\/blockquote>/, "");
					} else {
						//prevent newline after last blockquote //if no * or # is present
						if (listTag.length > 0) {
							text = text.replace(/<\/blockquote>/, "\n" + listTag + " ");
						} else {
							text = text.replace(/<\/blockquote>/, "\n");
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
				alert('Sorry, an infinite loop occurred. The editor had to shut down.\nPlease check your wiki page for errors.');
				break;
			}
		}
		text = _tables2wiki(text);

		text = text.replace(/\n?@@br_emptyline_first@@/gmi, "\n");
		text = text.replace(/\n?@@br_emptyline@@/gmi, "");
		// Cleanup von falschen Image-URLs
		// TODO MRG (02.11.10 23:44): i18n
		text = text.replace(/\/Image:/g, "Image:");
		text = text.replace(/\/Bild:/g, "Bild:");
		text = text.replace(/\/File:/g, "File:");
		text = text.replace(/\/Datei:/g, "Datei:");
		// Write back content of <pre> tags.
		text = _recoverPres(text);
		// make sure pre starts in a separate line
		text = text.replace(/([^^])?\n?<pre/gi, "$1\n<pre");

		// Cleanup empty lines that exists if enter was pressed within an aligned paragraph
		// However, leave empty divs with ids or classes
		text = text.replace(/<div (?!(id|class))[^>]*?>(\s|&nbsp;)*<\/div>/gmi, "");
		// Cleanup am Schluss lÃ¶scht alle ZeilenumbrÃ¼che und Leerzeilen/-Zeichen am Ende.
		// Important: do not use m flag, since this makes $ react to any line ending instead of text ending
		text = text.replace(/((<p( [^>]*?)?>(\s|&nbsp;|<br\s?\/>)*?<\/p>)|<br\s?\/>|\s)*$/gi, "");
		text = text.replace(/<br [^>]*bs_lastline[^>]*>/gmi, '');
		text = text.replace(/<br data-attributes="" ?\/?>/gmi, '<br/>');
		text = text.replace(/<br data-attributes="[^>]*data-mce-bogus[^>]*" ?\/?>/gmi, '');
		text = text.replace(/<br data-attributes="[^>]*data-attributes[^>]*" ?\/?>/gmi, '<br/>');
		text = text.replace(/<br [^>]*data-mce-bogus="1"[^>]*>/gmi, '');
		text = text.replace(/^\n*/gi, '');

		// wrap the text in an object to send it to event listeners
		textObject = {text: text};
		// call the event listeners
		$(document).trigger('BSVisualEditorAfterHtmlToWiki', [textObject]);
		// get the text back
		text = textObject.text;

		return text;
	}
	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preserveSpecialTags(text, e) {
		var mtext, regex, matcher, swt, i, pos, specialTagsList, st, cmt,
			curlyBraceDepth, squareBraceDepth, templateDepth,
			squareBraceFirst, tempTemplate, innerText, id, htmlText, el,
			templateName, templateText, templateResult, templateNameLines, switchWikiText;
		var ed = tinymce.get(e.target.id);
		var switches = new Array();
		if (!_switches) {
			_switches = new Array();
		}

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
			id = "bs_switch:@@@SWT"+ i + "@@@";
			var codeAttrs = {
				'id': id,
				'class': "mceNonEditable wikimagic switch",
				'title': switchWikiText,
				'data-bs-type': "switch",
				'data-bs-id': i,
				'data-bs-name': aSwitch, 
				'data-bs-wikitext': switchWikiText,
				'contenteditable': "false"
			};

			htmlText = ed.dom.createHTML('span', codeAttrs, '&sect;');
			el = ed.dom.create('span', codeAttrs, '&sect;');
			var searchText = new RegExp(switchWikiText, 'g');
			var replaceText = el.outerHTML;
			text = text.replace(
				searchText,
				replaceText
			);
			i++;
		}

		curlyBraceDepth = 0;
		squareBraceDepth = 0;
		templateDepth = 0;
		squareBraceFirst = false;
		tempTemplate = '';
		_templates = new Array();
		var templates = new Array();
		var checkedBraces = new Array();

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
						_templates.push(tempTemplate);
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
if (false) {
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
						templateHTML = templateHTML.substring(3, templateHTML.length)
						templateHTML = templateHTML.substring(0, templateHTML.length-5)
						templateHTML = templateHTML.replace(/\&amp\;/gmi,'&');
						// DC remove href tags in returned html as links will screw up conversions
						templateHTML = templateHTML.replace(/\shref="([^"]*)"/gmi,'');
						var templateWikiText = data.parse.wikitext["*"];
						var t = Math.floor((Math.random() * 100000) + 100000);
						var id = "bs_template:@@@TPL"+ t + "@@@";
						var codeAttrs = {
							'id': id,
							'class': "mceNonEditable wikimagic template",
							'title': templateWikiText,
							'data-bs-type': "template",
							'data-bs-id': i,
							'data-bs-name': templateName,
							'data-bs-wikitext': templateWikiText,
							'contenteditable': "false"
						};

						var htmlText = ed.dom.createHTML('span', codeAttrs, templateHTML);
						var el = ed.dom.create('span', codeAttrs, templateHTML);
						var sText = new RegExp('\\|', 'g');
						var rText = '\\|';
						templateWikiText = templateWikiText.replace(
							sText ,
							rText
						);
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
		}

		//quirky. Needs to be there for the occasional second pass of cleanup
		if (!_specialtags) {
			_specialtags = new Array();
		}
		specialTagsList = mw.config.get('wgPageFormsTinyTagList');
		// Tags without innerHTML need /> as end marker. Maybe this should be task of a preprocessor, in order to allow mw style tags without /.
		regex = '<(' + specialTagsList + ')[\\S\\s]*?((/>)|(>([\\S\\s]*?<\\/\\1>)))';
		matcher = new RegExp(regex, 'gmi');
		mtext = text;
		i = 0;
		st = '';

		var innerText = '';
		var retValue = false;
		var moreAttribs = '';

		while ((st = matcher.exec(mtext)) !== null) {

			retValue = $(document).triggerHandler( 'BSVisualEditorRenderSpecialTag', [this, st[1], st] );
			if ( retValue ) {
				innerText = retValue.innerText;
				moreAttribs = retValue.moreAttribs;
			} else {
				innerText = '&lt; ' + st[1] + ' &gt;';
			}
			text = text.replace(
				st[0],
				'<span class="mceNonEditable tag" id="bs_specialtag:@@@ST' + i + '@@@" data-bs-name="' + st[1] + '" data-bs-type="tag" data-bs-id="' + i + '" ' + moreAttribs + '>'
				//+ '&lt; ' + st[1] + ' &gt;'
				+ innerText
				+ '</span>'
				);
			_specialtags[i] = st[0];
			i++;
		}

		if (!_comments) {
			_comments = new Array();
		}

		mtext = text;
		regex = "(^|\\n)?<!--([\\S\\s]+?)-->(\\n|$)?";
		matcher = new RegExp(regex, 'gmi');
		i = 0;
		cmt = '';
		while ((cmt = matcher.exec(mtext)) !== null) {
			_comments[i] = cmt[0];

			if (cmt[3]) {
				if (cmt[3].charCodeAt(0) === 10) {
					cmt[3] = "\n";
				}
			} else {
				cmt[3] = '';
			}

			if (cmt[1]) {
				if (cmt[1].charCodeAt(0) === 10) {
					cmt[1] = "\n";
				}
			} else {
				cmt[1] = '';
			}

			innerText = cmt[2] + cmt[3];
			// @todo MRG (20.12.12 01:49): This is adapted to german needs. Other languages might want other characters
			innerText = innerText.replace(/[^a-zA-Z0-9Ã¤Ã¶Ã¼Ã„Ã–ÃœÃŸ\(\)_]/gmi, " ");
			text = text.replace(
				cmt[0],
				cmt[1]
				+ '<span class="mceNonEditable comment" id="bs_comment:@@@CMT'
				+ i + '@@@" data-bs-type="comment" data-bs-id="' + i + '">'
				+ innerText
				+ '</span>'
				+ cmt[3]
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
	function _recoverSpecialTags(text, e) {
		var matcher, nlBefore, nlAfter, i;
		var ed = tinymce.get(e.target.id);

		// this must be in inverse order as preserveSpecialTags
		// in order to allow for nested constructions

		if (_specialtags) {
			for (i = 0; i < _specialtags.length; i++) {
				matcher = new RegExp('(<span[^>]*?id=(\'|")bs_specialtag:@@@ST' + i + '@@@(\'|")[^>]*?>)(.*?)<\\/\s*?span\s*?>', 'gmi');
				var currentState = matcher.exec(text);
				var innerText = _specialtags[i];
				var retValue = $(document).triggerHandler( 'BSVisualEditorRecoverSpecialTag', [this, currentState, innerText] );
				if ( retValue ) {
					innerText = retValue.innerText;
				}

				text = text.replace(matcher, innerText);
			}
		}

		var templates = tinymce.util.Tools.grep(ed.dom.select('span'), function(elm) {
			return elm && elm.className === "mceNonEditable wikimagic template";
		});

		if (templates) {
			for (i = 0; i < templates.length; i++) {
				var templateText = templates[i].outerHTML;
				templateText = templateText.replace(/\&amp\;/gmi,'&');
				templateText = templateText.replace(/ contenteditable="false"/gmi,'')
				templateText = templateText.replace(/<a.*\/a>/gmi,'');
				templateText = templateText.replace(/"data-mce-href=".*"/gmi,'');
				text = text.replace(templateText, templates[i].attributes["data-bs-wikitext"].value);
			}
		}

		if (_comments) {
			for (i = 0; i < _comments.length; i++) {
				nlBefore = '';
				nlAfter = '';
				if (_comments[i].charAt(0) === "\n") {
					nlBefore = "\\n?";
				}

				if (_comments[i].charAt(_comments[i].length - 1) === "\n") {
					nlAfter = "\\n?"; //Otherwise line feeds would be eaten up. Nom, nom...
				}

				matcher = new RegExp(nlBefore + '<span[^>]*?id=(\'|")bs_comment:@@@CMT' + i + '@@@(\'|")[^>]*?>([\\S\\s]*?)<\\/\\s*?span\\s*?>' + nlAfter, 'gi');
				text = text.replace(matcher, _comments[i]);
			}
		}

		var switches = tinymce.util.Tools.grep(ed.dom.select('span'), function(elm) {
			return elm && elm.className === "mceNonEditable wikimagic switch";
		});

		if (switches) {
			for (i = 0; i < switches.length; i++) {
				var switchText = switches[i].outerHTML;
				switchText = switchText.replace(/\&amp\;/gmi,'&');
				switchText = switchText.replace(/ contenteditable="false"/gmi,'')
				switchText = switchText.replace(/<a.*\/a>/gmi,'');
				switchText = switchText.replace(/"data-mce-href=".*"/gmi,'');
				text = text.replace(switchText, switches[i].attributes["data-bs-wikitext"].value);
			}
		}
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preservePres(text, skipnowiki) {
		var i;

		_preTags = false;
		_preTags = text.match(/<pre[^>]*?(?!bs_pre_from_space)[^>]*?>([\S\s]*?)<\/pre>/gmi);

		if (_preTags) {
			for (i = 0; i < _preTags.length; i++) {
				text = text.replace(_preTags[i], "@@@PRE" + i + "@@@");
			}
		}

		_preTagsSpace = false;
		// @todo MRG (22.10.10 19:28): This should match pre class="space", narrow down (now matches everything)
		_preTagsSpace = text.match(/<pre[^>]+bs_pre_from_space[^>]+>([\S\s]*?)<\/pre>/gmi);
		if (_preTagsSpace) {
			for (i = 0; i < _preTagsSpace.length; i++) {
				text = text.replace(_preTagsSpace[i], "@@@PRE_SPACE" + i + "@@@");
			}
		}

		if ( skipnowiki ) return text;

		_nowikiTags = false;
		//
		_nowikiTags = text.match(/<nowiki>([\S\s]*?)<\/nowiki>/gmi);
		if (_nowikiTags) {
				for (i = 0; i < _nowikiTags.length; i++) {
						text = text.replace(_nowikiTags[i], "@@@NOWIKI" + i + "@@@");
						_nowikiTags[i] = _nowikiTags[i].replace( "\n", "<span class='single_linebreak' title='single linebreak'>&para;<\/span> " );
				}
		}


		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverPres(text) {
		var i, regex, replacer;

		if (_preTags) {
			for (var i = 0; i < _preTags.length; i++) {
				regex = '@@@PRE' + i + '@@@';
				replacer = new RegExp(regex, 'gmi');

				// \n works in IE. In FF, this is not neccessary.
				if ( navigator.appName == 'Microsoft Internet Explorer' ) {
					text = text.replace(replacer, "\n" + _preTags[i]);
				} else {
					text = text.replace(replacer, _preTags[i]);
				}
			}
		}
		_preTags = false;

		//this is experimental support for pres with spaces
		if (_preTagsSpace) {
			for (i = 0; i < _preTagsSpace.length; i++) {
				regex = '@@@PRE_SPACE' + i + '@@@';
				replacer = new RegExp(regex, 'gmi');

				// \n works in IE. In FF, this is not neccessary.
				if ( navigator.appName == 'Microsoft Internet Explorer' ) {
					text = text.replace(replacer, "\n" + _preTagsSpace[i]);
				} else {
					text = text.replace(replacer, _preTagsSpace[i]);
				}
			}
		}
		_preTagsSpace = false;

		//this is experimental support for nowiki
		if (_nowikiTags) {
				for (i = 0; i < _nowikiTags.length; i++) {
						regex = '@@@NOWIKI' + i + '@@@';
						replacer = new RegExp(regex, 'gmi');

						// \n works in IE. In FF, this is not neccessary.
						if ( navigator.appName == 'Microsoft Internet Explorer' ) {
								text = text.replace(replacer, "\n" + _nowikiTags[i]);
						} else {
								text = text.replace(replacer, _nowikiTags[i]);
						}
				}
		}
		_nowikiTags = false;

		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preserveEntities(text) {
		var regex, matcher, mtext, i, ent;

		if (!_entities) {
			_entities = new Array();
		}

		// Tiny replaces &nbsp; by space, so we need to undo this
		text = text.replace(/<span class="bs_htmlentity">[\s\u00a0]<\/span>/gi, '<span class="bs_htmlentity">&nbsp;<\/span>');
		regex = '<span class="bs_htmlentity">(&[^;]*?;)<\/span>';
		matcher = new RegExp(regex, 'gmi');

		mtext = text;

		i = 0;
		while ((ent = matcher.exec(mtext)) !== null) {
			text = text.replace(ent[0], "@@@ENTITY" + i + "@@@");
			_entities[i] = ent[1];
			i++;
		}
		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _recoverEntities(text) {
		var i, regex, replacer;

		if (_entities) {
			for (i = 0; i < _entities.length; i++) {
				regex = '@@@ENTITY' + i + '@@@';
				replacer = new RegExp(regex, 'gmi');
				text = text.replace(replacer, _entities[i]);
			}
		}
		_entities = false;

		return text;
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _convertPreWithSpacesToTinyMce(text) {
		_preTagsSpace = new Array();
		text = _preservePres(text);

		// careful: this is greedy and goes on until it finds a line ending.
		// originally ended in (\n|$), however, this would result in only every other
		// line being recognized since the regex then matches line endings at the beginning
		// and at the end.
		// There is a lookahead for tables: ?!<t
		_preTagsSpace = text.match(/(^|\n\n?)( +(?!<t)\S[^\n]*)/gi);
		if (_preTagsSpace) {
			for (var i = 0; i < _preTagsSpace.length; i++) {
				//prevent HTML-Tables from being rendered as pre
				text = text.replace(_preTagsSpace[i], "@@@PRE_SPACE" + i + "@@@");
				// preserve newline at the beginning of a line
				var newlineAtBeginning = _preTagsSpace[i].charAt(0) == "\n";
				// trim pre content
				_preTagsSpace[i] = _preTagsSpace[i].replace( /\n/g, "").substr(1, _preTagsSpace[i].length);
				text = text.replace(
					"@@@PRE_SPACE" + i + "@@@",
					( newlineAtBeginning ? "\n" : "" ) + '<pre class="bs_pre_from_space">' + _preTagsSpace[i] + '</pre>'
				);
			}
		}

		// can be pre with a marker attribute "space"
		text = text.replace(/<\/pre>\s*?<pre[^>]*>/gmi, '\n');

		text = _recoverPres(text);
		return text;
	}
	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _convertTinyMceToPreWithSpaces(text) {
		var innerPre, innerPreLines;

		_preTagsSpace = text.match(/<pre[^>]+bs_pre_from_space[^>]+>([\S\s]*?)<\/pre>/gmi);

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
		// there was bs_comment:@@@ in there: |@@@PRE.*?@@@$|\|$|bs_comment:@@@|^
		if ($2.match(/(----$|\|\}$|=$|-->$|<\/div>$|<\/pre>$|@@@PRE.*?@@@$|\|$|^(#|\*|:|;|<\!--|\|\||\|-)|(^\s*$))/i)) {
			return $0;
		}
		// careful: only considers the first 5 characters in a line
		if ($3.match(/(^(----|\||!|\{\||#|\*|:|;|=|<\!--|<div|<pre|@@@PR)|(^\s*$))/i)) {
			return $0;
		}
		_processFlag = true;
		return $1 + $2 + " <span class='single_linebreak' title='single linebreak'>&para;<\/span> " + $3;
	}

	/**
	 *
	 */
	function _loadImageRealUrls() {
		var image;
		var content;
		var ed = _ed;
		var server = mw.config.get( "wgServer" ) ;
		var script = mw.config.get( 'wgScriptPath' ) + '/api.php';
		for( var i = 0; i < _images.length; i ++ ) {
			image = _images[i];
			image["imageName"] = decodeURIComponent(image["imageName"]);

			$.getJSON(
				script,
				{
					'action': 'query',
					'format': 'json',
					'prop': 'imageinfo',
					'iiprop': 'url',
					'titles': 'File:' + image.imageName
				},
				function( data ) {
					if ( data.query && data.query.pages ) {
						var pages = data.query.pages;	
						for ( var p in pages ) { 														if (p == -1) {
								//error in lookup
								// Todo: i18n
								var response = pages["-1"];
								var reason = response["invalidreason"];
								var title = response["title"]
								alert('Sorry there was an error looking up ' + title + '. ' + reason);
							} else {
								var info = pages[p].imageinfo;
								var imageurl = info[0].url;
								var imageparts = pages[p].title.split(':');
								var images = ed.getBody().getElementsByTagName('img');
								for( var i = 0; i < images.length; i++ ) {
									//We process only matching nodes
									var part1 = decodeURI( images[i].src );
									var part2 = decodeURI( server + _imageDummyUrl + '?' + imageparts[1]) ;
									part2 = part2.replace(/ /g,"_");
									if ( part1 !== part2 ) {
										continue;
									}
									//Last but not least set the url to the correct image
									images[i].src = imageurl.replace(/&amp;/g, '&');
								}
							}
						}
					}

				}
			);
		}
	}

	/**
	 *
	 * @param {String} text
	 * @returns {String}
	 */
	function _preprocessWiki2Html(text, e) {
		// normalize line endings to \n
		text = text.replace(/\r\n/gmi, "\n");

		/* DC because the table may be part of a template parameter {{!}} may
		have been used instead of | so do this substitution first*/
		text = text.replace(/{{!}}/gmi, "|");

		// cleanup tables
		text = text.replace(/(\{\|[^\n]*?)\n+/gmi, "$1\n");
		text = text.replace(/(\|-[^\n]*?)\n+/gmi, "$1\n");

		// cleanup old entity markers
		while (text.match(/<span class="bs_htmlentity">.+?<\/span>/gmi)) {
			text = text.replace(/(<span class="bs_htmlentity">)(.+?)(<\/span>)/gmi, '$2');
		}

		text = text.replace(/(<span class="bs_htmlentity">)/gmi, '');

		while (text.match(/(<span ([^>]*?)>)(\1)[^>]*?<\/span><\/span>/gmi)) {
			text = text.replace(/(<span [^>]*?>)(\1)([^>]*?)(<\/span>)<\/span>/gmi, '$1$3$4');
		}

		while (text.match(/<span class="toggletext">[\s\S]*?<\/span>/gmi)) {
			text = text.replace(/<span class="toggletext">([\s\S]*?)<\/span>/gmi, '$1');
		}

		// mark templates in table headers, as they cannot be rendered
		var i = 0;
		while (text.match(/^(\{\|.*?)(\{\{(.*?)\}\})(.*?)$/gmi)) {
			text = text.replace(/^(\{\|.*?)(\{\{(.*?)\}\})(.*?)$/gmi, '$1 data-bs-table-tpl'+i+'="$3"$4');
			i++;
		}

		// mark templates in row definitions, as they cannot be rendered
		var i = 0;
		while (text.match(/^(\|-.*?)(\{\{(.*?)\}\})(.*?)$/gmi)) {
			text = text.replace(/^(\|-.*?)(\{\{(.*?)\}\})(.*?)$/gmi, '$1 data-bs-tr-tpl'+i+'="$3"$4');
			i++;
		}

		// mark templates in header definitions, as they cannot be rendered
		var i = 0;
		while (text.match(/^(!.*?)(\{\{(.*?)\}\})(.*?\|)/gmi)) {
			text = text.replace(/^(!.*?)(\{\{(.*?)\}\})(.*?\|)/gmi, '$1 data-bs-th-tpl'+i+'="$3"$4');
			i++;
		}

		// mark templates in cell definitions, as they cannot be rendered
		var i = 0;
		while (text.match(/^(\|.*?)(\{\{(.*?)\}\})(.*?\|)/gmi)) {
			text = text.replace(/^(\|.*?)(\{\{(.*?)\}\})(.*?\|)/gmi, '$1 data-bs-td-tpl'+i+'="$3"$4');
			i++;
		}

		//special tags before pres prevents spaces in special tags like GeSHi to take effect
		text = _preserveSpecialTags(text, e);

		//cleanup linebreaks in tags except comments
		text = text.replace(/(<[^!][^>]+?)(\n)([^<]+?>)/gi, "$1$3");

		//preserve entities that were orignially html entities
		text = text.replace(/(&[^\s;]+;)/gmi, '<span class="bs_htmlentity">$1</span>');

		// remove replacement in external links. this must be done in a loop since there might be more
		// & in an url
		while (text.match(/(\[[^\]]+?)<span class="bs_htmlentity">(.+?)<\/span>([^\]]+?])/gmi)) {
			text = text.replace(/(\[[^\]]+?)<span class="bs_htmlentity">(.+?)<\/span>([^\]]+?])/gmi, '$1$2$3');
		}

		text = _convertPreWithSpacesToTinyMce(text);
		text = _preservePres(text, false);

		do {
			_processFlag = false;
			// (^|\n|>| ): only last word. Used to be \b, but this matches @ which is unwanted
			text = text.replace(/(^|\n|>| )([^\n]+)\n([^\n]{1,5})/gi, __preserveSingleLinebreaks);

		} while (_processFlag);

		text = _recoverPres(text);
		return text;
	}

	/*
	 * Preprocess HTML in DOM form. This is mainly used to replace tags
	 * @param {String} text
	 * @returns {String}
	 */
	function _preprocessHtml2Wiki( text ) {
		// convert html text to DOM
		var $dom = $( "<div id='tinywrapper'>" + text + "</div>" );

		// perform the actual preprocessing
		$dom.find( "span[style*='text-decoration: underline']" ).replaceWith( function() {
			return "<u>" + $( this ).html() + "</u>";
		} );
		$dom.find( "span[style*='text-decoration: line-through']" ).replaceWith( function() {
			return "<s>" + $( this ).html() + "</s>";
		} );

		// convert DOM to html text
		text = $dom.html();

		//cleanup entities in attribtues
		while ( text.match( /(\="[^"]*?)(<)([^"]*?")/gmi ) ) {
			text = text.replace( /(\="[^"]*?)(<)([^"]*?")/g, '$1&lt;$3' );
		}
		while ( text.match( /(\="[^"]*?)(>)([^"]*?")/gmi ) ) {
			text = text.replace( /(\="[^"]*?)(>)([^"]*?")/g, '$1&gt;$3' );
		}

		return text;
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
		if (e.load) {
			e.content = _preprocessWiki2Html(e.content, e);
		}
		_images = []; //Reset the images "array"
		e.content = _wiki2html(e.content, e);
		_loadImageRealUrls();

	}

	/**
	 * Event handler for "getContent".
	 * This is used to process html into wiki code.
	 * @param {tinymce.ContentEvent} e
	 */
	function _onGetContent(e) {
		// if raw format is requested, this is usually for internal issues like
		// undo/redo. So no additional processing should occur. Default is 'html'
		if (e.format == 'raw' ) return;
		if (e.format != 'raw') e.format = 'wiki';

		e.content = _preprocessHtml2Wiki( e.content );

		// process the html to wikicode
		e.content = _html2wiki(e.content);

/* DC removed the if test as this breaks the code function saving the wiki code properly when using the wikicodeplugin		if (e.save) {*/
			e.content = _convertTinyMceToPreWithSpaces(e.content);
			// recover linebreaks
			// use . here: blank would not match in IE
			e.content = e.content.replace(/ ?<span[^>]*class="single_linebreak" title="single linebreak"[^>]*>(&nbsp;|.|&para;)<\/span> ?/g, "\n");

			e.content = _preserveEntities(e.content);

			e.content = e.content.replace(/(&[^\s]*?;)/gmi, function($0) {
				return tinymce.DOM.decode($0);
			});
			//do not use o.content = ed.dom.decode(o.content);
			// it breaks conversion from html to wiki
			e.content = _recoverEntities(e.content);

			//cleanup entity markers
			while (e.content.match(/<span class="bs_htmlentity">.+?<\/span>/gmi)) {
				e.content = e.content.replace(/(<span class="bs_htmlentity">)(.+?)(<\/span>)/gmi, '$2');
			}

			e.content = _recoverSpecialTags(e.content, e);

			// cleanup templates in table markers
			e.content = e.content.replace(/data-bs-t.*?-tpl.*?="(.*?)"/gmi, "{{$1}}");
/*		}*/

	}

	function _onLoadContent(ed, o) {
		var internalLinks = [];
		var internalLinksTitles = [];
		$(this.dom.doc).find('a.bs-internal-link').each(function(){
			var href = $(this).attr('data-mce-href');
			if( !href ) {
				href = $(this).attr('href');
			}
			internalLinksTitles.push( decodeURIComponent(href).replace("_"," ") );
			internalLinks.push($(this));
		});

		$(document).trigger( 'BSVisualEditorLoadContentBeforeCheckLinks', [
			this,
			internalLinksTitles,
			internalLinks
		]);

		if( internalLinksTitles.length == 0 ) return;
		var titles = decodeURIComponent(internalLinksTitles[0]).replace("_"," ");
		for( var i = 1; i < internalLinksTitles.length; i++ ) {
			titles += "|" + decodeURIComponent(internalLinksTitles[i].replace("_"," "));
		}
		/*DC now go and check the links to see if pages exist */
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
		});
	}

	this.getInfo = function() {
		var info = {
			longname: 'BlueSpice WikiCode Parser adapted for PageForms',
			author: 'Hallo Welt! GmbH & Duncann Crane at Aoxomoxoa Limited',
			authorurl: 'http://www.hallowelt.biz, https://www.aoxomoxoa.co.uk',
			infourl: 'http://www.hallowelt.biz, https://www.aoxomoxoa.co.uk'
		};
		return info;
	};

	this.init = function(ed, url) {
		_userThumbsize = _thumbsizes[ mw.user ? mw.user.options.get('thumbsize') : 3 ];
		_imageDummyUrl = '/'/*dc removed this dependency on BS bs.em.paths.get('BlueSpiceFoundation')
			+'/resources/bluespice/images/bs-ajax-loader-pik-blue.gif'*/;
		_ed = ed;

		ed.on('beforeSetContent', _onBeforeSetContent);
		ed.on('getContent', _onGetContent);
		ed.on('loadContent', _onLoadContent);

		ed.on('click', function(e) {
			var dataname = ed.dom.getAttrib(e.target.parentNode, 'data-bs-name');
			if ( dataname ) {
				$(document).triggerHandler( 'BSVisualEditorClickSpecialTag', [this, ed, e, dataname] );
			}
		});
		ed.on('mouseDown', function(e){
			var body = ed.getBody();
			if(jQuery(e.target).hasClass('bsClickableElement')){
				jQuery(body).attr({'contenteditable': false});
			}else{
				jQuery(body).attr({'contenteditable': true});
			}
		});

	};

	this.getSpecialTagList = function() {
		return _specialtags;
	};

	this.pushSpecialTagList = function( item ) {
		_specialtags.push( item );
	}

	this.getTemplateList = function() {
		return _templates;
	};

	this.getSwitchList = function() {
		return _switches;
	};
};

tinymce.PluginManager.add('wikicode', BsWikiCode);
