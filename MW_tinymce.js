var scriptPath = mw.config.get( 'wgScriptPath' );
var minimizeOnBlur = mw.config.get( 'wgTinyMCEMinimizeOnBlur' );

var tinyMCELanguage = mw.config.get( 'wgTinyMCELanguage' );
var tinyMCELangURL = null;
if ( tinyMCELanguage !== 'en' ) {
	tinyMCELangURL = scriptPath + '/extensions/TinyMCE/tinymce/langs/' +
		tinyMCELanguage + '.js';
}
var tinyMCEDirectionality = mw.config.get( 'wgTinyMCEDirectionality' );

function tinyMCEInitInstance(instance) {
	if ( minimizeOnBlur ) {
		var mcePane = $("textarea#" + instance.id).prev();
			mcePane.find(".mce-menubar .mce-container-body").hide("medium");
		// Keep a little "sliver" of the toolbar so that users see it.
		mcePane.find(".mce-menubar").css("height", "15px");
		mcePane.find(".mce-toolbar-grp").hide("medium");
	}
}

jQuery.getScript( scriptPath + '/extensions/TinyMCE/tinymce/tinymce.js',
  function() {
	$('#wpTextbox1, .tinymce').each( function() {
		$(this).before("<p><a class=\"toggleMCE\" data-current-state=\"enabled\" data-input-id=\"" +
			$(this).attr('id') + "\" href=\"javascript:void(0)\">Switch to basic editor</a></p>");
	});
	$('.toggleMCE').click( function() {
		tinymce.EditorManager.execCommand('mceToggleEditor', true, $(this).attr('data-input-id'));
		var currentState = $(this).attr('data-current-state');
		if ( currentState === 'enabled' ) {
			$(this).attr('data-current-state', 'disabled')
				.html("Switch to advanced editor");
		} else {
			$(this).attr('data-current-state', 'enabled')
				.html("Switch to basic editor");
		}
		// Prevent reload of the page.
		return false;
	});

      window.tinymce.init({ 
//          selector: '.tinymce',
          selector: '#wpTextbox1, .tinymce',
	  branding: false,
	  relative_urls: false,
	  remove_script_host: false,
	  document_base_url: mw.config.get( "wgServer" ),
  	  automatic_uploads: true,
          paste_data_images: true,
	  content_css: scriptPath + '/extensions/TinyMCE/MW_tinymce.css',
          theme_url: scriptPath + '/extensions/TinyMCE/tinymce/themes/modern/theme.js',
          skin_url: scriptPath + '/extensions/TinyMCE/tinymce/skins/lightgray',
          paste_word_valid_elements: 'b,strong,i,em,h1,h2,h3,h4,h5,table,thead,tfoot,tr,th,td,ol,ul,li,a,sub,sup,strike,br,del,div,p',
          invalid_elements : 'tbody',
          browser_spellcheck: true,
	  wikimagic_context_toolbar: true,
          contextmenu: "undo redo | cut copy paste insert | link wikiimageupload wikimagic inserttable | styleselect removeformat ",
          convert_fonts_to_spans: true,
  	  link_title: false,
	  link_assume_external_targets: true,
	  link_class_list: [
    		{title: 'External', value: 'external bs-external-link mceNonEditable'},
    		{title: 'Internal', value: 'internal bs-internal-link mceNonEditable'},
	  ],
          table_default_attributes: {
              class: 'contenttable'
          },
          height: 400,
          statusbar: false,
	  // the default text direction for the editor
	  directionality: tinyMCEDirectionality,
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
	  forced_root_block: 'P',
	  // keep current style on pressing return
	  keep_styles: true,
	  // save plugin
	  save_enablewhendirty: true,
	  //Allow style tags in body and unordered lists in spans (inline)
	  valid_children: "+span[ul]",
	  //set the id of the body tag in iframe to bodyContent, so styles do
	  //apply in a correct manner. This may be dangerous.
	  body_id: 'bodyContent',
          external_plugins: {
             'advlist': scriptPath + '/extensions/TinyMCE/tinymce/plugins/advlist/plugin.js',
             'anchor': scriptPath + '/extensions/TinyMCE/tinymce/plugins/anchor/plugin.js',
             'autolink': scriptPath + '/extensions/TinyMCE/tinymce/plugins/autolink/plugin.js',
             'charmap': scriptPath + '/extensions/TinyMCE/tinymce/plugins/charmap/plugin.js',
             'colorpicker': scriptPath + '/extensions/TinyMCE/tinymce/plugins/colorpicker/plugin.js',
             'contextmenu': scriptPath + '/extensions/TinyMCE/tinymce/plugins/contextmenu/plugin.js',
             'insertdatetime': scriptPath + '/extensions/TinyMCE/tinymce/plugins/insertdatetime/plugin.js',
             'lists': scriptPath + '/extensions/TinyMCE/tinymce/plugins/lists/plugin.js',
             'noneditable': scriptPath + '/extensions/TinyMCE/tinymce/plugins/noneditable/plugin.js',
             'preview': scriptPath + '/extensions/TinyMCE/tinymce/plugins/preview/plugin.js',
             'save': scriptPath + '/extensions/TinyMCE/tinymce/plugins/save/plugin.js',
             'searchreplace': scriptPath + '/extensions/TinyMCE/tinymce/plugins/searchreplace/plugin.js',
             'table': scriptPath + '/extensions/TinyMCE/tinymce/plugins/table/plugin.js',
             'textcolor': scriptPath + '/extensions/TinyMCE/tinymce/plugins/textcolor/plugin.js',
             'visualblocks': scriptPath + '/extensions/TinyMCE/tinymce/plugins/visualblocks/plugin.js',
             'wikicode': scriptPath + '/extensions/TinyMCE/tinymce/plugins/pf_wikicode/plugin.js',
             'wikilink': scriptPath + '/extensions/TinyMCE/tinymce/plugins/pf_link/plugin.js',
             //'wikimagic': scriptPath + '/extensions/TinyMCE/tinymce/plugins/pf_wikimagic/plugin.js',
             'wikipaste': scriptPath + '/extensions/TinyMCE/tinymce/plugins/pf_paste/plugin.js',
             'wikisourcecode': scriptPath + '/extensions/TinyMCE/tinymce/plugins/pf_code/plugin.js'
          },
          menubar: 'edit insert view format table tools',
          removed_menuitems: 'media',
          toolbar1: 'undo redo | cut copy paste insert | bold italic underline strikethrough forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | charmap singlelinebreak wikilink unlink table wikiimageupload wikimagic wikisourcecode | styleselect removeformat | searchreplace ',
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
          setup: function(editor) {

             	function insertImage() {
                	var editorid = editor.id;
		 	var node = editor.selection.getNode();
		 	var nodeID = node.id;
		 	if (node.nodeName == 'IMG') {
				var upLoadType = "local";
		 	} else {
				var upLoadType = "file";
		 	}

                 	var uploadform = scriptPath + '/index.php?title=Special:TinyMCEUploadWindow&pfInputID=' + editorid + 
				'&pfEditor=tinymce' + 
				'&pfSelect=' + editor.selection.getContent() + 
				'&pfNode=' + nodeID + 
				'&wpSourceType=' + upLoadType ;
                 	$.fancybox([
                      		uploadform
                      		], {
                         		'padding'           : 10,
                         		'type'              : 'iframe',//set type to iframe
                         		'overlayOpacity'    : 0.3,
                         		'overlayColor'      : 'grey',
                         		'speedIn'           : 50,
                         		'speedOut'          : 50,
                         		'width'             : 680,
                         		'height'            : 715
                 	});
                 	$.fancybox.resize;
             	}

             	function insertSingleLinebreak() {
			var slb = " <span class='single_linebreak' title='single linebreak'>&para;</span>  ";
			args = {format: 'raw'};
			editor.undoManager.transact(function(){
				editor.focus();
				editor.selection.setContent(slb,args);
				editor.undoManager.add();
			});
            	}

             	editor.addButton('wikiimageupload', {
                	icon: 'image',
			stateSelector: 'img',
                	tooltip: "Upload/insert wiki image",
                	onclick:  insertImage
             	});

            	editor.addButton('singlelinebreak', {
                 	icon: 'visualchars',
                 	tooltip: "Insert single linebreak and current position",
                 	onclick:  insertSingleLinebreak
             	});

	     	editor.addMenuItem('singlelinebreak', {
			icon: 'visualchars',
			text: 'Single linebreak',
			tooltip: 'Insert single linebreak at current position',
			context: 'insert',
			onclick: insertSingleLinebreak
	     	});
          },
          init_instance_callback: "tinyMCEInitInstance"
      });
});
