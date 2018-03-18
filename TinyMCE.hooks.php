<?php
/**
 * Static functions called by various outside hooks, as well as by
 * extension.json.
 *
 * @author Yaron Koren
 * @file
 * @ingroup TinyMCE
 */

class TinyMCEHooks {

	public static function registerExtension() {
		if ( defined( 'TINYMCE_VERSION' ) ) {
			// Do not load this extension more than once.
			return 1;
		}

		define( 'TINYMCE_VERSION', '0.1' );

		$GLOBALS['wgTinyMCEIP'] = dirname( __DIR__ ) . '/../';
	}

	/**
	 * Try to translate between MediaWiki's language codes and TinyMCE's -
	 * they're similar, but not identical. MW's are always lowercase, and
	 * they tend to use fewer country codes.
	 */
	static function mwLangToTinyMCELang( $mwLang ) {
		// 'en' gets special handling, because it's TinyMCE's
		// default language - it requires no language add-on.
		if ( $mwLang == null || $mwLang === 'en' ) {
			return 'en';
		}

		$tinyMCELanguages = array(
			'af_ZA',
			'ar', 'ar_SA',
			'az',
			'eu',
			'be',
			'bn_BD',
			'bs',
			'bg_BG',
			'ca',
			'cs', 'cs_CZ',
			'cy',
			'da',
			'de',
			'de_AT',
			'dv',
			'el',
			'en_CA', 'en_GB',
			'eo',
			'es', 'es_AR', 'es_MX',
			'et',
			'eu',
			'fa',
			'fa_IR',
			'fi',
			'fo',
			'fr_FR', 'fr_CH',
			'ga',
			'gd',
			'gl',
			'he_IL',
			'hi_IN',
			'hr',
			'hu_HU',
			'hy',
			'id',
			'is_IS',
			'it',
			'ja',
			'ka_GE',
			'kab',
			'kk',
			'km_KH',
			'ko',
			'ko_KR',
			'ku',
			'ku_IQ',
			'lb',
			'lt',
			'lv',
			'mk_MK',
			'ml', 'ml_IN',
			'mn_MN',
			'nb_NO',
			'nl',
			'pl',
			'pt_BR', 'pt_PT',
			'ro',
			'ru', 'ru_RU', 'ru@petr1708',
			'si_LK',
			'sk',
			'sl_SI',
			'sr',
			'sv_SE',
			'ta', 'ta_IN',
			'tg',
			'th_TH',
			'tr', 'tr_TR',
			'tt',
			'ug',
			'uk', 'uk_UA',
			'uz',
			'vi', 'vi_VN',
			'zh_CN', 'zh_CN.GB2312', 'zh_TW',
		);

		foreach ( $tinyMCELanguages as $tinyMCELang ) {
			if ( $mwLang === strtolower( $tinyMCELang ) ||
				$mwLang === substr( $tinyMCELang, 0, 2 ) ) {
				return $tinyMCELang;
			}
		}

		// If there was no match found, see if there's a matching
		// "fallback language" for the current language - like
		// 'fr' for 'frc'.
		$fallbackLangs = Language::getFallbacksFor( $mwLang );
		foreach ( $fallbackLangs as $fallbackLang ) {
			if ( $fallbackLang === 'en' ) {
				continue;
			}
			foreach ( $tinyMCELanguages as $tinyMCELang ) {
				if ( $fallbackLang === strtolower( $tinyMCELang ) ||
					$fallbackLang === substr( $tinyMCELang, 0, 2 ) ) {
					return $tinyMCELang;
				}
			}
		}

		return 'en';
	}

	static function setGlobalJSVariables( &$vars, $out ) {
		global $wgTinyMCEEnabled, $wgTinyMCEMacros;
		global $wgParser, $wgCheckFileExtensions, $wgStrictFileExtensions;
		global $wgFileExtensions, $wgFileBlacklist;
		global $wgEnableUploads;

		if ( !$wgTinyMCEEnabled ) {
			return true;
		}

		$context = $out->getContext();

		$extensionTags = $wgParser->getTags();
		$specialTags = '';
		foreach ( $extensionTags as $tagName ) {
			if ( ( $tagName == 'pre' ) || ($tagName == 'nowiki') ) {
				continue;
			}
			$specialTags .= $tagName . '|';
		}

		$defaultTags = array(
			"includeonly", "onlyinclude", "noinclude" //Definitively MediaWiki core
		);

		$tinyMCETagList = $specialTags . implode( '|', $defaultTags );

		$vars['wgTinyMCETagList'] = $tinyMCETagList;

		$mwLanguage = $context->getLanguage()->getCode();
		$tinyMCELanguage = self::mwLangToTinyMCELang( $mwLanguage );
		$vars['wgTinyMCELanguage'] = $tinyMCELanguage;
		$directionality = $context->getLanguage()->getDir();
		$vars['wgTinyMCEDirectionality'] = $directionality;
		$vars['wgCheckFileExtensions'] = $wgCheckFileExtensions;
		$vars['wgStrictFileExtensions'] = $wgStrictFileExtensions;
		$vars['wgFileExtensions'] = $wgFileExtensions;
		$vars['wgFileBlacklist'] = $wgFileBlacklist;
		$vars['wgEnableUploads'] = $wgEnableUploads;

		$user = $context->getUser();

		if ($user->isAllowed('upload')) {
			$userMayUpload = true;
		} else {
			$userMayUpload = false;
		}
		$vars['wgTinyMCEUserMayUpload'] = $userMayUpload;

		if ($user->isAllowed('upload_by_url')) {
			$userMayUploadFromURL = true;
		} else {
			$userMayUploadFromURL= false;
		}
		$vars['wgTinyMCEUserMayUploadFromURL'] = $userMayUploadFromURL;

		if ($user->isBlocked()) {
			$userIsBlocked = true;
		} else {
			$userIsBlocked = false;
		}
		$vars['wgTinyMCEUserIsBlocked'] = $userIsBlocked ;

		$jsMacroArray = array();
		foreach ( $wgTinyMCEMacros as $macro ) {
			if ( !array_key_exists( 'name', $macro ) || !array_key_exists( 'text', $macro ) ) {
				continue;
			}

			$imageURL = null;
			if ( array_key_exists( 'image', $macro ) ) {
				if ( strtolower( substr( $macro['image'], 0, 4 ) ) === 'http' ) {
					$imageURL = $macro['image'];
				} else {
					$imageFile =  wfLocalFile( $macro['image'] );
					$imageURL = $imageFile->getURL();
				}
			}
			$jsMacroArray[] = array(
				'name' => $macro['name'],
				'image' => $imageURL,
				'text' => htmlentities( $macro['text'] )
			);
		}
		$vars['wgTinyMCEMacros'] = $jsMacroArray;

		return true;
	}

	/**
	 * Adds an "edit" link for TinyMCE, and renames the current "edit"
	 * link to "edit source", for all sections on the page, if it's
	 * editable with TinyMCE in the first place.
	 */
	public static function addEditSectionLink( $skin, $title, $section, $tooltip, &$links, $lang ) {
		if ( !isset( $title ) || !$title->userCan( 'edit' ) ) {
			return true;
		}

		$context = $skin->getContext();
		if ( !TinyMCEHooks::enableTinyMCE( $title, $context ) ) {
			return true;
		}

		foreach ( $links as &$link ) {
			if ( $link['query']['action'] == 'edit' ) {
				$newLink = $link;
				$link['text'] = $skin->msg( 'tinymce-editsectionsource' )->parse();
			}
		}
		$newLink['query']['action'] = 'tinymceedit';
		$links = array_merge( array( 'tinymceeditsection' => $newLink ), $links );

		return true;
	}

	/**
	 * Sets broken/red links to point to TinyMCE edit page, if they
	 * haven't been customized already.
	 *
	 * @param Linker $linker
	 * @param Title $target
	 * @param array $options
	 * @param string $text
	 * @param array &$attribs
	 * @param bool &$ret
	 * @return true
	 */
	static function changeRedLink( $linker, $target, $options, $text, &$attribs, &$ret ) {
		// If it's not a broken (red) link, exit.
		if ( !in_array( 'broken', $options, true ) ) {
			return true;
		}
		// If the link is to a special page, exit.
		if ( $target->getNamespace() == NS_SPECIAL ) {
			return true;
		}

		// This link may have been modified already by Page Forms or
		// some other extension - if so, leave it as it is.
		if ( strpos( $attribs['href'], 'action=edit&' ) === false ) {
			return true;
		}

		global $wgOut;
		if ( !TinyMCEHooks::enableTinyMCE( $target, $wgOut->getContext() ) ) {
			return true;
		}

		$attribs['href'] = $target->getLinkURL( array( 'action' => 'tinymceedit', 'redlink' => '1' ) );

		return true;
	}

	/**
	 * Is there a less hacky way to do this, like stopping the toolbar
	 * creation before it starts?
	 */
	public static function removeDefaultToolbar( &$toolbar ) {
		global $wgTinyMCEEnabled;
		if ( $wgTinyMCEEnabled ) {
			$toolbar = null;
		}
		return true;
	}

	public static function enableTinyMCE( $title, $context ) {
		if ( $title->getNamespace() == NS_TEMPLATE ) {
			return false;
		}

		if ( $context->getRequest()->getCheck('undo') ) {
			return false;
		}

		if ( !$context->getUser()->getOption( 'tinymce-use' ) ) {
			return false;
		}

		// Give other extensions a chance to disable TinyMCE for this page.
		if ( !Hooks::run( 'TinyMCEDisable', array( $title ) ) ) {
			return false;
		}

		return true;
	}

	public static function addToEditPage( EditPage &$editPage, OutputPage &$output ) {
		global $wgTinyMCEEnabled;

		$wgTinyMCEEnabled = false;

		$context = $editPage->getArticle()->getContext();
		$title = $editPage->getTitle();

		$action = Action::getActionName( $context );
		if ( $action == 'edit' || $action == 'submit' ) {
			return true;
		}

		if ( self::enableTinyMCE( $title, $context ) ) {
			$wgTinyMCEEnabled = true;
			$output->addModules( 'ext.tinymce' );
		}

		if ( !$wgTinyMCEEnabled ) {
			return true;
		}

		$output->addModules( 'ext.tinymce' );

		$output->addHTML( Html::rawElement( 'p', null, wfMessage( 'tinymce-notice' )->parse() ) );

		return true;
	}

	public static function disableWikiEditor( $editPage ) {
		global $wgTinyMCEEnabled;

		if ( $wgTinyMCEEnabled ) {
			return false;
		}
		return true;
	}

	public static function addPreference( $user, &$preferences ) {
		$preferences['tinymce-use'] = array(
			'type' => 'toggle',
			'label-message' => 'tinymce-preference', // a system message
			'section' => 'editing/advancedediting',
		);

		return true;
	}

	public static function addRLModules( &$otherModules ) {
		$otherModules[] = 'ext.tinymce';
		return true;
	}

}
