var server = 'https://' + mw.config.get( 'wgServer' ) + '/';
var scriptPath = mw.config.get( 'wgScriptPath' );
var extensionAssetsPath = mw.config.get( 'wgExtensionAssetsPath' );
var tinyMCEMacros = mw.config.get( 'wgTinyMCEMacros' );
var tinyMCETagList = mw.config.get( 'wgTinyMCETagList' );
var tinyMCELanguage = mw.config.get( 'wgTinyMCELanguage' );
var tinyMCELangURL = null;
if ( tinyMCELanguage !== 'en' ) {
	tinyMCELangURL = extensionAssetsPath + '/TinyMCE/tinymce/langs/' +
		tinyMCELanguage + '.js';
}
var mw_skin = mw.config.get( 'skin' );
var mw_skin_css = '/load.php?debug=false&lang=en-gb&modules=mediawiki.legacy.commonPrint%2Cshared%7Cmediawiki.sectionAnchor%7Cmediawiki.skinning.interface%7Cskins.' + mw_skin + '.styles&only=styles&skin=' + mw_skin ;

window.mwTinyMCEInit = function( tinyMCESelector ) {
	window.tinymce.init({ 
//		selector: '.tinymce',
		selector: tinyMCESelector,
		branding: false,
//		relative_urls: false,
//		remove_script_host: false,
//		document_base_url: server,
		tinyMCEMacros: tinyMCEMacros,
		automatic_uploads: true,
		paste_data_images: true,
		content_css: 
			[extensionAssetsPath + '/TinyMCE/MW_tinymce.css',
			scriptPath + mw_skin_css],
		theme_url: extensionAssetsPath + '/TinyMCE/tinymce/themes/modern/theme.js',
		skin_url: extensionAssetsPath + '/TinyMCE/tinymce/skins/lightgray',
		paste_word_valid_elements: 'b,strong,i,em,h1,h2,h3,h4,h5,table,thead,tfoot,tr,th,td,ol,ul,li,a,sub,sup,strike,br,del,div,p',
		invalid_elements: 'tbody',
		wiki_non_rendering_newline_character: '&para;', // set to false if you don't use non-rendering single new lines in wiki
		wiki_tags_list: tinyMCETagList, 
		additional_wiki_tags: '|ol|ul|li|h1|h2|h3|h4|h5|h6|ta|div',
		browser_spellcheck: true,
		wikimagic_context_toolbar: true,
		browsercontextmenu_context_toolbar: true,
		contextmenu: "undo redo | cut copy paste insert | link wikimagic inserttable | styleselect removeformat | browsercontextmenu",
		convert_fonts_to_spans: true,
		link_title: false,
		link_assume_external_targets: true,
		link_class_list: [
			{title: 'External', value: 'link external mw-external-link mceNonEditable'},
			{title: 'Internal', value: 'link internal mw-internal-link mceNonEditable'},
		],
		target_list: false,
		visual_table_class : "wikitable",
		table_default_attributes: {
			class: 'wikitable'
		},
		height: 400,
		statusbar: false,
		// the default text direction for the editor
		directionality: mw.config.get( 'wgTinyMCEDirectionality' ),
		// default language
		//language: 'en',
		language_url: tinyMCELangURL,
		// don't wrap the editable element?
		nowrap: false,
		// enable resizing for element like images, tables or media objects
		object_resizing: true,
		// the html mode for tag creation (we need xhtml)
		element_format: 'xhtml',
		// define the element what all inline elements needs to be wrapped in
		forced_root_block: 'p',
		forced_root_block_attrs: {
			'class': 'mw_paragraph'
		},
		// keep current style on pressing return
		keep_styles: true,
		// save plugin
		save_enablewhendirty: true,
		//Allow style tags in body and unordered lists in spans (inline)
		valid_children: "+span[ul]",
		//set the id of the body tag in iframe to bodyContent, so styles do
		//apply in a correct manner. This may be dangerous.
		body_id: 'bodyContent',
		//Allowable file typr for file picker
		file_picker_types: 'file image media', 
		//Enable/disable options in upload popup
		image_description: true,
		image_title: true,
		image_dimensions: true,
		image_advtab: true,
		image_class_list: [
    		{title: mw.msg("tinymce-upload-type-label-file"), value: 'File'},
    		{title: mw.msg("tinymce-upload-type-label-url"), value: 'URL'},
    		{title: mw.msg("tinymce-upload-type-label-wiki"), value: 'Wiki'}
		],
		external_plugins: {
			'anchor': extensionAssetsPath + '/TinyMCE/tinymce/plugins/anchor/plugin.js',
			'autolink': extensionAssetsPath + '/TinyMCE/tinymce/plugins/autolink/plugin.js',
			'autoresize': extensionAssetsPath + '/TinyMCE/tinymce/plugins/autoresize/plugin.js',
			'autosave': extensionAssetsPath + '/TinyMCE/tinymce/plugins/autosave/plugin.js',
			'charmap': extensionAssetsPath + '/TinyMCE/tinymce/plugins/charmap/plugin.js',
			'colorpicker': extensionAssetsPath + '/TinyMCE/tinymce/plugins/colorpicker/plugin.js',
			'contextmenu': extensionAssetsPath + '/TinyMCE/tinymce/plugins/contextmenu/plugin.js',
			'insertdatetime': extensionAssetsPath + '/TinyMCE/tinymce/plugins/insertdatetime/plugin.js',
			'lists': extensionAssetsPath + '/TinyMCE/tinymce/plugins/lists/plugin.js',
			'noneditable': extensionAssetsPath + '/TinyMCE/tinymce/plugins/noneditable/plugin.js',
			'preview': extensionAssetsPath + '/TinyMCE/tinymce/plugins/preview/plugin.js',
			'save': extensionAssetsPath + '/TinyMCE/tinymce/plugins/save/plugin.js',
			'searchreplace': extensionAssetsPath + '/TinyMCE/tinymce/plugins/searchreplace/plugin.js',
			'textcolor': extensionAssetsPath + '/TinyMCE/tinymce/plugins/textcolor/plugin.js',
			'visualblocks': extensionAssetsPath + '/TinyMCE/tinymce/plugins/visualblocks/plugin.js',
			'wikicode': extensionAssetsPath + '/TinyMCE/tinymce/plugins/mw_wikicode/plugin.js',
			'wikiupload': extensionAssetsPath + '/TinyMCE/tinymce/plugins/mw_upload/plugin.js',
//			'wikilink': extensionAssetsPath + '/TinyMCE/tinymce/plugins/mw_link/plugin.js',
			'wikipaste': extensionAssetsPath + '/TinyMCE/tinymce/plugins/mw_paste/plugin.js',
			'table': extensionAssetsPath + '/TinyMCE/tinymce/plugins/mw_table/plugin.js',
		},
		menubar: false, //'edit insert view format table tools',
		contextmenu_never_use_native: false,
		removed_menuitems: 'media',
		toolbar1: 'undo redo | cut copy paste insert | bold italic underline strikethrough subscript superscript forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | charmap singlelinebreak wikilink unlink table wikiupload wikimagic wikisourcecode | formatselect removeformat | searchreplace ',
		style_formats_merge: true,
		style_formats: [
			{title: "Table", items: [
				{title: "Sortable", selector: "table", classes: "sortable"},
				{title: "Wikitable", selector: "table", classes: "wikitable"},
				{title: "Contenttable", selector: "table", classes: "contenttable"},
			]},
			{title: "Cell", items: [
				{title: "Left", selector: "td", format: "alignleft", icon: "alignleft"},
				{title: "Center", selector: "td", format: "aligncenter", icon: "aligncenter"},
				{title: "Right", selector: "td", format: "alignright", icon: "alignright"},
				{title: "Align Top", selector: "td", styles: {verticalalign: "top"}},
				{title: "Align Middle", selector: "td", styles: {verticalalign: "middle"}},
				{title: "Align Bottom", selector: "td", styles: {verticalalign: "bottom"}}
			]},
				{title: "Pre", block: "pre", classes: "bs_pre_from_space" },
				{title: "Paragraph", block: "p" }
		],
		images_upload_credentials: true,
		autoresize_max_height: 400,
		setup: function(editor) {

	},
	init_instance_callback: function (instance) {
		// For some reason, in some installations this only works as an inline function,
		// instead of a named function defined elsewhere.
		var minimizeOnBlur = $("textarea#" + instance.id).hasClass( 'mceMinimizeOnBlur' );
		if ( minimizeOnBlur ) {
			var mcePane = $("textarea#" + instance.id).prev();
			// Keep a little sliver of the toolbar so that users see it.
			mcePane.find(".mce-toolbar-grp").css("height", "10px");
			mcePane.find(".mce-toolbar-grp .mce-flow-layout").hide("medium");
		}
	},
	file_picker_callback: function(cb, value, meta) {
		var input = document.createElement('input');
		input.setAttribute('type', 'file');
		input.onchange = function() {
			var file = this.files[0];
      
			var reader = new FileReader();
			reader.onload = function (e) {
				var fileContent = file;
				// call the callback and populate the src field with the file name
				// and srccontent field with the content of the file
				cb(e.target.result, { srccontent: fileContent, src: file.name });
			};
			reader.readAsDataURL(file);
		};
    
		input.click();
	}
    });
};

mwTinyMCEInit( '#wpTextbox1' );
