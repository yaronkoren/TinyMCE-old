<?php

/**
 * Note: When updating this file please also update extension.json with the same changes.
 */

/**
 * Default settings for TinyMCE.
 *
 * @file
 * @ingroup PF
 */

// In some versions of MW 1.25, there's a bug in which global variables
// set in LocalSettings.php do not override the settings in
// extension.json. For simplicity's sake, don't load extensions unless we're
// at version 1.27 or higher.
if ( version_compare( $GLOBALS['wgVersion'], '1.27c', '>' ) ) {
	if ( function_exists( 'wfLoadExtension' ) ) {
		wfLoadExtension( 'TinyMCE' );
		// Keep i18n globals so mergeMessageFileList.php doesn't break
		$GLOBALS['wgMessagesDirs']['TinyMCE'] = __DIR__ . '/i18n';
		/* wfWarn(
			'Deprecated PHP entry point used for TinyMCE extension. ' .
			'Please use wfLoadExtension instead, ' .
			'see https://www.mediawiki.org/wiki/Extension_registration for more details.'
		); */
		return;
	}
}

if ( defined( 'TINYMCE_VERSION' ) ) {
	// Do not load TinyMCE more than once.
	return 1;
}

define( 'TINYMCE_VERSION', '0.1' );

$GLOBALS['wgExtensionCredits']['hook'][] = array(
	'path' => __FILE__,
	'name' => 'TinyMCE',
	'version' => TINYMCE_VERSION,
	'author' => array( 'Hallo Welt', 'Duncan Crane', 'Yaron Koren' ),
	'url' => 'https://www.mediawiki.org/wiki/Extension:TinyMCE',
	'descriptionmsg' => 'tinymce-desc',
	'license-name' => 'GPL-2.0+'
);

# ##
# This is the path to your installation of TinyMCE as
# seen from the web. Change it if required ($wgScriptPath is the
# path to the base directory of your wiki). No final slash.
# #
$GLOBALS['wgExtensionFunctions'][] = function() {
	$GLOBALS['wgTinyMCEPartialPath'] = '/extensions/TinyMCE';
	$GLOBALS['wgTinyMCEScriptPath'] = $GLOBALS['wgScriptPath'] . $GLOBALS['wgTinyMCEPartialPath'];
};
# #

# ##
# This is the path to your installation of Page Forms as
# seen on your local filesystem. Used against some PHP file path
# issues.
# #
$GLOBALS['wgTinyMCEIP'] = dirname( __FILE__ );
# #

//$GLOBALS['wgHooks']['ResourceLoaderRegisterModules'][] = 'TinyMCEHooks::registerModules';
$GLOBALS['wgHooks']['MakeGlobalVariablesScript'][] = 'TinyMCEHooks::setGlobalJSVariables';
$GLOBALS['wgHooks']['SkinTemplateNavigation'][] = 'TinyMCEAction::displayTab';
$GLOBALS['wgHooks']['SkinEditSectionLinks'][] = 'TinyMCEHooks::addEditSectionLink';
$GLOBALS['wgHooks']['LinkEnd'][] = 'TinyMCEHooks::changeRedLink';
$GLOBALS['wgHooks']['EditPageBeforeEditToolbar'][] = 'TinyMCEHooks::removeDefaultToolbar';
$GLOBALS['wgHooks']['EditPage::showEditForm:initial'][] = 'TinyMCEHooks::addToEditPage';
$GLOBALS['wgHooks']['WikiEditorDisable'][] = 'TinyMCEHooks::disableWikiEditor';
$GLOBALS['wgHooks']['GetPreferences'][] = 'TinyMCEHooks::addPreference';
$GLOBALS['wgHooks']['PageForms::addRLModules'][] = 'TinyMCEHooks::addRLModules';

$GLOBALS['wgAutoloadClasses']['TinyMCEHooks'] = __DIR__ . '/TinyMCE.hooks.php';
$GLOBALS['wgAutoloadClasses']['TinyMCEAction'] = __DIR__ . '/TinyMCEAction.php';
$GLOBALS['wgAutoloadClasses']['TinyMCEUploadForm'] = __DIR__ . '/upload/TinyMCEUploadForm.php';
$GLOBALS['wgAutoloadClasses']['TinyMCEUploadSourceField'] = __DIR__ . '/upload/TinyMCEUploadSourceField.php';
$GLOBALS['wgAutoloadClasses']['TinyMCEUploadWindow'] = __DIR__ . '/upload/TinyMCEUploadWindow.php';
$GLOBALS['wgSpecialPages']['TinyMCEUploadWindow'] = 'TinyMCEUploadWindow';

$GLOBALS['wgActions']['tinymceedit'] = 'TinyMCEAction';

$GLOBALS['wgMessagesDirs']['TinyMCE'] = __DIR__ . '/i18n';

// Register client-side modules.
$wgTinyMCEResourceTemplate = array(
	'localBasePath' => __DIR__,
	'remoteExtPath' => 'TinyMCE'
);
$GLOBALS['wgResourceModules'] += array(
	'ext.tinymce' => $wgTinyMCEResourceTemplate + array(
		'scripts' => 'MW_tinymce.js',
		'styles' => 'MW_tinymce.css',
		'dependencies' => array(
			'ext.tinymce.core',
			'ext.tinymce.fancybox'
		),
		'messages' => array(
			'tinymce-upload',
			'tinymce-upload-title',
			'tinymce-upload-title-general',
			'tinymce-upload-title-image',
			'tinymce-upload-type-label',
			'tinymce-upload-type-label-file',
			'tinymce-upload-type-label-url',
			'tinymce-upload-type-label-wiki',
			'tinymce-upload-type-tooltip',
			'tinymce-upload-source-label',
			'tinymce-upload-source-tooltip',
			'tinymce-upload-destination-label',
			'tinymce-upload-destination-tooltip',
			'tinymce-upload-summary-label',
			'tinymce-upload-summary-tooltip',
			'tinymce-upload-link-label',
			'tinymce-upload-link-tooltip',
			'tinymce-upload-alttext-label',
			'tinymce-upload-alttext-tooltip',
			'tinymce-upload-dimensions-label',
			'tinymce-upload-dimensions-tooltip',
			'tinymce-upload-dimensions-constrain-text',
			'tinymce-upload-dimensions-width-label',
			'tinymce-upload-dimensions-height-label',
			'tinymce-upload-vertalign-label',
			'tinymce-upload-vertalign-tooltip',
			'tinymce-upload-vertalign-middle-text',
			'tinymce-upload-vertalign-top-text',
			'tinymce-upload-vertalign-bottom-text',
			'tinymce-upload-vertalign-baseline-text',
			'tinymce-upload-vertalign-sub-text',
			'tinymce-upload-vertalign-super-text',
			'tinymce-upload-vertalign-texttop-text',
			'tinymce-upload-vertalign-textbottom-text',
			'tinymce-upload-horizontalalign-label',
			'tinymce-upload-horizontalalign-tooltip',
			'tinymce-upload-horizontalalign-left-text',
			'tinymce-upload-horizontalalign-centre-text',
			'tinymce-upload-horizontalalign-right-text',
			'tinymce-upload-horizontalalign-none-text',
			'tinymce-upload-format-label',
			'tinymce-upload-format-tooltip',
			'tinymce-upload-format-thumb-text',
			'tinymce-upload-format-border-text',
			'tinymce-upload-format-frame-text',
			'tinymce-upload-format-frameless-text',
			'tinymce-upload-alert-uploads-not-enabled',
			'tinymce-upload-alert-uploads-not-allowed',
			'tinymce-upload-alert-error-uploading-to-wiki',
			'tinymce-upload-alert-file-type-not-allowed',
			'tinymce-upload-alert-unknown-error-uploading',
			'tinymce-upload-alert-error-uploading',
			'tinymce-upload-alert-warnings-encountered',
			'tinymce-upload-alert-destination-filename-not-allowed',
			'tinymce-upload-alert-destination-filename-already-exists',
			'tinymce-upload-alert-duplicate-file',
			'tinymce-upload-alert-other-warning',
			'tinymce-upload-alert-correct-and-try-again',
			'tinymce-upload-alert-destination-filename-needed',
			'tinymce-upload-alert-source-or-destination-undefined',
			'tinymce-upload-confirm-file-already-exists',
			'tinymce-upload-confirm-file-not-on-wiki',
			'tinymce-upload-confirm-ignore-warnings',
			'tinymce-upload-menu-item-text',
			'tinymce-wikicode-alert-image-not-found-on-wiki',
			'tinymce-wikicode-alert-image-request-invalid',
			'tinymce-wikicode-alert-image-request-unknown-error',
			'tinymce-wikicode-alert-infinte-loop',
			'tinymce-openlink',
			'tinymce-wikimagic',
			'tinymce-wikimagic-title',
			'tinymce-wikisourcecode',
			'tinymce-wikisourcecode-title',
			'tinymce-link-title-label',
			'tinymce-link-display-text-label',
			'tinymce-link-link-list-label',
			'tinymce-link-url-page-label',
			'tinymce-link-link-list-none',
			'tinymce-link-target-none',
			'tinymce-link-target-new-window',
			'tinymce-link-target-label',
			'tinymce-link-rel-label',
			'tinymce-link-type-label',
			'tinymce-link-page-not-found',
			'tinymce-link-want-to-email',
			'tinymce-link-want-to-link-external',
			'tinymce-link-link-button-tooltip',
			'tinymce-link-link-remove-button-tooltip',
			'tinymce-link-open-link',
			'tinymce-link-context-menu',
			'tinymce-link',
			'tinymce-insert-linebreak',
		)
	),
	'ext.tinymce.core' => $wgTinyMCEResourceTemplate + array(
		'scripts' => 'tinymce/tinymce.js'
	),
	'ext.tinymce.fancybox' => $wgTinyMCEResourceTemplate + array(
		'scripts' => 'fancybox/jquery.fancybox.js',
		'styles' => 'fancybox/jquery.fancybox.css',
		'dependencies' => 'ext.tinymce.browser'
	),
	'ext.tinymce.browser' => $wgTinyMCEResourceTemplate + array(
		'scripts' => 'jquery.browser.js'
	)

);

$wgDefaultUserOptions['tinymce-use'] = 1;

// PHP fails to find relative includes at some level of inclusion:
// $pathfix = $IP . $GLOBALS['wgTinyMCEScriptPath'];

$GLOBALS['wgTinyMCEEnabled'] = false;
$GLOBALS['wgTinyMCEMacros'] = array();
