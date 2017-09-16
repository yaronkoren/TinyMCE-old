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
$GLOBALS['wgHooks']['EditPageBeforeEditToolbar'][] = 'TinyMCEHooks::removeDefaultToolbar';
$GLOBALS['wgHooks']['EditPage::showEditForm:initial'][] = 'TinyMCEHooks::addToEditPage';

$GLOBALS['wgAutoloadClasses']['TinyMCEHooks'] = __DIR__ . '/TinyMCE.hooks.php';

$GLOBALS['wgMessagesDirs']['TinyMCE'] = __DIR__ . '/i18n';

// Register client-side modules.
$wgTinyMCEResourceTemplate = array(
	'localBasePath' => __DIR__,
	'remoteExtPath' => 'TinyMCE'
);
$GLOBALS['wgResourceModules'] += array(
	'ext.tinymce' => $wgTinyMCEResourceTemplate + array(
		'scripts' => 'MW_tinymce.js',
		'styles' => 'MW_tinymce.css'
	)
);

// PHP fails to find relative includes at some level of inclusion:
// $pathfix = $IP . $GLOBALS['wgTinyMCEScriptPath'];
