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

	/**
	 * Compiles a list of tags that must be passed by the editor.
	 * @global Language $wgLang
	 * @global OutputPage $wgOut
	 * @param Parser $oParser MediaWiki parser object.
	 * @return bool Allow other hooked methods to be executed. Always true.
	 */
	static function setGlobalJSVariables( &$vars, $out ) {

		global $wgTinyMCEEnabled;
		global $wgParser;

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

		return true;
	}

	/**
	 * Is there a less hacky way to do this, like stopping the toolbar
	 * creation before it starts?
	 */
	public static function removeDefaultToolbar( &$toolbar ) {
		$toolbar = null;
		return true;
	}

	public static function addToEditPage( EditPage &$editPage, OutputPage &$output ) {
		global $wgTinyMCEEnabled;

		$context = $editPage->getArticle()->getContext();
		$title = $editPage->getTitle();
		$namespace = $title->getNamespace();

		// @TODO - this should not be hardcoded.
		$wgTinyMCEEnabled = $namespace != NS_TEMPLATE && $namespace != PF_NS_FORM;
		if ( !$wgTinyMCEEnabled ) {
			return true;
		}

		$output->addModules( 'ext.tinymce' );
		return true;
	}

}
