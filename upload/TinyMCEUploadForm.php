<?php
/**
 * TinyMCEUploadWindow - used for uploading files from within TinyMCE.
 * This class is heavily based on the Page Forms extension's
 * PFUploadForm class, which in turn is heavily based on MediaWiki's
 * SpecialUpload class.
 *
 * @author Yaron Koren
 * @author Duncan Crane
 * @file
 * @ingroup TinyMCE
 */

/**
 * Sub class of HTMLForm that provides the form section of SpecialUpload
 */

/**
 * @ingroup PFSpecialPages
 */
class TinyMCEUploadForm extends HTMLForm {
	protected $mWatch;
	protected $mForReUpload;
	protected $mSessionKey;
	protected $mHideIgnoreWarning;
	protected $mDestWarningAck;
	
	protected $mSourceIds;

	## DC for TinyMCE
	protected $mDropSrc;
	protected $mSelect;
	protected $mNode;
	protected $mFile;
	protected $mHorizontalAlignment;
	protected $mVerticalAlignment;
	protected $mFormat;
	protected $mHeight;
	protected $mWidth;
	protected $mLink;
	protected $mAlt;
	protected $mTitle;
	## DC End


	public function __construct( $options = array() ) {
		$this->mWatch = !empty( $options['watch'] );
		$this->mForReUpload = !empty( $options['forreupload'] );
		$this->mSessionKey = isset( $options['sessionkey'] )
				? $options['sessionkey'] : '';
		$this->mHideIgnoreWarning = !empty( $options['hideignorewarning'] );
		$this->mDestFile = isset( $options['destfile'] ) ? $options['destfile'] : '';

		$this->mTextTop = isset( $options['texttop'] ) ? $options['texttop'] : '';
		$this->mTextAfterSummary = isset( $options['textaftersummary'] ) ? $options['textaftersummary'] : '';

/*		$sourceDescriptor = $this->getSourceSection();
		$descriptor = $sourceDescriptor
			+ $this->getDescriptionSection()
			+ $this->getOptionsSection();*/

## DC for TinyMCE
		$this->mSelect = isset( $options['pfSelect'] ) ? $options['pfSelect'] : '';
		$this->mNode = isset( $options['pfNode'] ) ? $options['pfNode'] : '';
		$inputID = isset( $options['pfInputID'] ) ? $options['pfInputID'] : '';
		$this->mDropSrc = isset( $options['pfDropSrc'] ) ? $options['pfDropSrc'] : '';

		// Initialise variables used if editing existing file link
		$this->mFile = $this->mDestFile;
		$this->mHorizontalAlignment = "right";
		$this->mVerticalAlignment = "middle";
		$this->mFormat = "thumb";
		$this->mLink = "";
		$this->mAlt = "";
		$this->mTitle = "";
		$this->mWidth = "";
		$this->mHeight = "";

		// If passed a valid select (ie valid wiki link) then we are editing an existing link
		if ( $this->mSelect ) {
			$nodestring = $this->mSelect;
			// Check the node is an internal wikki link and strip square brackets if it is
			if ( strpos( $nodestring, '[[' ) == 0 ) {
				$nodestring = trim( $nodestring , '[]');

				$nodearray = explode('|', $nodestring);
				if ( strpos( $nodearray[0], ':' ) > -1 ) {
					$nodefile = substr($nodearray[0],strpos($nodearray[0],':')+1);
					//Swap ' ' for '_'
					$this->mFile = $nodefile;
					$this->mDestFile = $nodefile;
					$i=0;
					for ( $i = 1; $i <= count( $nodearray ) - 1; $i++ ) {
						if ( in_array($nodearray[$i],array("left", "right", "center", "none"))) {
							$this->mHorizontalAlignment = $nodearray[$i];
						} elseif ( in_array( $nodearray[$i], array( "middle", "top", "bottom", "baseline", "sub", "super", "text-top", "text-bottom" ) ) ) {
							$this->mVerticalAlignment = $nodearray[$i];
						} elseif ( in_array( $nodearray[$i], array( "thumb", "border", "frame", "frameless" ) ) ) {
							$this->mFormat = $nodearray[$i];
## DC To Do link not picked up as part of Node so next bit doesen't work
						} elseif ( strpos( $nodearray[$i], 'link=' ) > -1 ) {
							$link = explode('=', $nodearray[$i]);
							$this->mLink = $link[1];
						} elseif ( strpos( $nodearray[$i], 'alt=' ) > -1 ) {
							$alt = explode('=', $nodearray[$i]);
							$this->mAlt = $alt[1];
						} elseif ( strpos( $nodearray[$i], 'px' ) > -1 ) {
							$dimensions = substr( $nodearray[$i] , 0, strlen($nodearray[$i])-2);
							$dimension = explode('x', $dimensions);
							if ( $dimension[0] > 0 ) {
								$this->mWidth = $dimension[0];
							}
							if ( count( $dimension) > 1 ) {
								if ( $dimension[1] > 0 ) {
									$this->mHeight = $dimension[1];
								}
							}
						} elseif ( $nodearray[$i] ) {
							$this->mTitle = $nodearray[$i];
						}
					}
				}

			}
		}

		$sourceDescriptor = $this->getSourceSection();
		$descriptor = $sourceDescriptor
			+ $this->getDescriptionSection()
			+ $this->getDisplayParamsSection()
			+ $this->getOptionsSection();
## DC end

		Hooks::run( 'UploadFormInitDescriptor', array( &$descriptor ) );
		parent::__construct( $descriptor, 'upload' );

		# Set some form properties
		$this->setSubmitText( wfMessage( 'tinymce-uploadbtn' )->text() );
		$this->setSubmitTooltip( 'tinymce-upload' );
## DC End
		$this->setSubmitName( 'wpUpload' );
		$this->setId( 'mw-upload-form' );

		# Build a list of IDs for javascript insertion
		$this->mSourceIds = array();
		foreach ( $sourceDescriptor as $key => $field ) {
			if ( !empty( $field['id'] ) )
				$this->mSourceIds[] = $field['id'];
		}
		// added for Page Forms
## DC for TinyMCE
		if ( isset( $options['pfInput'] ) ) $this->addHiddenField( 'pfInputID', $options['pfInputID'] );
		if ( isset( $options['pfDelimiter'] ) ) $this->addHiddenField( 'pfDelimiter', $options['pfDelimiter'] );
		if ( isset( $options['pfSelect'] ) ) $this->addHiddenField( 'pfNode', $options['pfSelect'] );
		if ( isset( $options['pfNode'] ) ) $this->addHiddenField( 'pfNode', $options['pfNode'] );
		if ( isset( $options['pfDropSrc'] ) ) $this->addHiddenField( 'pfDropSrc', $options['pfDropSrc'] );
##DC End
	}

	/**
	 * Get the descriptor of the fieldset that contains the file source
	 * selection. The section is 'source'
	 *
	 * @return array Descriptor array
	 */
	protected function getSourceSection() {
		if ( $this->mSessionKey ) {
			return array(
				'SessionKey' => array(
					'id' => 'wpSessionKey',
					'type' => 'hidden',
					'default' => $this->mSessionKey,
				),
				'SourceType' => array(
					'id' => 'wpSourceType',
					'type' => 'hidden',
					'default' => 'Stash',
				),
			);
		}

## DC for TinyMCE
		$canUploadByUrl = UploadFromUrl::isEnabled()
/*			&& $this->getUser()->isAllowed( 'upload_by_url' );*/
			&& ( UploadFromUrl::isAllowed( $this->getUser() ) === true )
			&& $this->getConfig()->get( 'CopyUploadsFromSpecialUpload' );
## DC Changed the next line to enable chosing previously uploaded file for insertion into TinyMCE editor window
		$radio = $canUploadByUrl ;
## DC End
		$selectedSourceType = strtolower( $this->getRequest()->getText( 'wpSourceType', 'File' ) );

		$descriptor = array();

		if ( $this->mTextTop ) {
			$descriptor['UploadFormTextTop'] = array(
				'type' => 'info',
				'section' => 'source',
				'default' => $this->mTextTop,
				'raw' => true,
			);
		}

		$maxUploadSizeFile = ini_get( 'upload_max_filesize' );
		$maxUploadSizeURL = ini_get( 'upload_max_filesize' );
		global $wgMaxUploadSize;
		if ( isset( $wgMaxUploadSize ) ) {
			if ( gettype( $wgMaxUploadSize ) == "array" ) {
				$maxUploadSizeFile = $wgMaxUploadSize['*'];
				$maxUploadSizeURL = $wgMaxUploadSize['url'];
			} else {
				$maxUploadSizeFile = $wgMaxUploadSize;
				$maxUploadSizeURL = $wgMaxUploadSize;
			}
		}

		$descriptor['UploadFile'] = array(
			'class' => 'TinyMCEUploadSourceField',
			'section' => 'source',
			'type' => 'file',
			'id' => 'wpUploadFile',
			'label-message' => 'sourcefilename',
			'upload-type' => 'File',
			'radio' => &$radio,
			'help' => wfMessage( 'upload-maxfilesize',
					$this->getLanguage()->formatSize(
						wfShorthandToInteger( $maxUploadSizeFile )
					)
				)->parse() . ' ' . wfMessage( 'upload_source_file' )->escaped(),
			'checked' => $selectedSourceType == 'file',
		);
		if ( $canUploadByUrl ) {
			$descriptor['UploadFileURL'] = array(
				'class' => 'UploadSourceField',
				'section' => 'source',
				'id' => 'wpUploadFileURL',
				'radio-id' => 'wpSourceTypeurl',
				'label-message' => 'sourceurl',
				'upload-type' => 'Url',
				'radio' => &$radio,
				'help' => wfMessage( 'upload-maxfilesize',
						$this->getLanguage()->formatSize( $maxUploadSizeURL )
					)->parse() . ' ' . wfMessage( 'upload_source_url' )->escaped(),
				'checked' => $selectedSourceType == 'url',
				'default' => $selectedSourceType == 'url' ? $this->mDropSrc : '',
			);
		}
## DC enable chosing previously uploaded file for insertion into TinyMCE editor window
		$descriptor['InsertLocalWikiUpload'] = array(
			'class' => 'TinyMCEUploadSourceField',
			'section' => 'source',
			'id' => 'wpInsertLocalFile',
			'radio-id' => 'wpSourceTypeLocal',
			'label-message' => 'tinymce-source-local-file',
			'upload-type' => 'Local',
			'radio' => &$radio,
			'help' => wfMessage( 'tinymce-source-insert-local-file'),
			'checked' => $selectedSourceType == 'local',
			'default' => $selectedSourceType == 'local' ? $this->mFile : '',
		);
## DC End
		Hooks::run( 'UploadFormSourceDescriptors', array( &$descriptor, &$radio, $selectedSourceType ) );

		$descriptor['Extensions'] = array(
			'type' => 'info',
			'section' => 'source',
			'default' => $this->getExtensionsMessage(),
			'raw' => true,
		);
		return $descriptor;
	}


	/**
	 * Get the messages indicating which extensions are preferred and prohibitted.
	 *
	 * @return string HTML string containing the message
	 */
	protected function getExtensionsMessage() {
		# Print a list of allowed file extensions, if so configured. We ignore
		# MIME type here, it's incomprehensible to most people and too long.
		global $wgCheckFileExtensions, $wgStrictFileExtensions,
		$wgFileExtensions, $wgFileBlacklist;

		if ( $wgCheckFileExtensions ) {
			if ( $wgStrictFileExtensions ) {
				# Everything not permitted is banned
				$extensionsList =
					'<div id="mw-upload-permitted">' .
						wfMessage( 'upload-permitted', $this->getLanguage()->commaList( $wgFileExtensions ) )->parse() .
					"</div>\n";
			} else {
				# We have to list both preferred and prohibited
				$extensionsList =
					'<div id="mw-upload-preferred">' .
						wfMessage( 'upload-preferred', $this->getLanguage()->commaList( $wgFileExtensions ) )->parse() .
					"</div>\n" .
					'<div id="mw-upload-prohibited">' .
						wfMessage( 'upload-prohibited', $this->getLanguage()->commaList( $wgFileBlacklist ) )->parse() .
					"</div>\n";
			}
		} else {
			# Everything is permitted.
			$extensionsList = '';
		}
		return $extensionsList;
	}

	/**
	 * Get the descriptor of the fieldset that contains the file description
	 * input. The section is 'description'
	 *
	 * @return array Descriptor array
	 */
	protected function getDescriptionSection() {
## DC for TinyMCE
		$cols = intval( $this->getUser()->getOption( 'cols' ) );
		if ( $this->getUser()->getOption( 'editwidth' ) ) {
			$this->getOutput()->addInlineStyle( '#mw-htmlform-description { width: 100%; }' );
		}
## DC End
		$descriptor = array(
			'DestFile' => array(
				'type' => 'text',
				'section' => 'description',
				'id' => 'wpDestFile',
				'label-message' => 'destfilename',
				'size' => 60,
## DC for TinyMCE
				'default' => $this->mDestFile,
				 # @todo FIXME: Hack to work around poor handling of the 'default' option in HTMLForm
				'nodata' => strval( $this->mDestFile ) !== '',
## DC End
			),
			'UploadDescription' => array(
				'type' => 'textarea',
				'section' => 'description',
				'id' => 'wpUploadDescription',
				'label-message' => $this->mForReUpload
					? 'filereuploadsummary'
					: 'fileuploadsummary',
				'cols' => ($cols*3/4)+1,
				'rows' => 4,
			),
/*
			'EditTools' => array(
				'type' => 'edittools',
				'section' => 'description',
			),
*/
			'License' => array(
				'type' => 'select',
				'class' => 'Licenses',
				'section' => 'description',
				'id' => 'wpLicense',
				'label-message' => 'license',
			),
		);

		if ( $this->mTextAfterSummary ) {
			$descriptor['UploadFormTextAfterSummary'] = array(
				'type' => 'info',
				'section' => 'description',
				'default' => $this->mTextAfterSummary,
				'raw' => true,
			);
		}

		if ( $this->mForReUpload )
			$descriptor['DestFile']['readonly'] = true;

		global $wgUseCopyrightUpload;
		if ( $wgUseCopyrightUpload ) {
			$descriptor['UploadCopyStatus'] = array(
				'type' => 'text',
				'section' => 'description',
				'id' => 'wpUploadCopyStatus',
				'label-message' => 'filestatus',
			);
			$descriptor['UploadSource'] = array(
				'type' => 'text',
				'section' => 'description',
				'id' => 'wpUploadSource',
				'label-message' => 'filesource',
			);
		}

		return $descriptor;
	}

	/**
	 * Get the descriptor of the fieldset that contains the display parameters when using tiny mce
	 * input. The section is 'description'
	 *
	 * @author DC
	 * @return array Descriptor array
	 */
	protected function getDisplayParamsSection() {
		$cols = intval( $this->getUser()->getOption( 'cols' ) );
		if ( $this->getUser()->getOption( 'editwidth' ) ) {
			$this->getOutput()->addInlineStyle( '#mw-htmlform-description { width: 100%; }' );
		}

		$descriptor = array(
			'AltText' => array(
				'type' => 'text',
				'section' => 'displayparams',
				'id' => 'wpAltText',
				'label-message' => 'tinymce-upload-alternate-text',
				'size' => 60,
				'default' => $this->mAlt,
			),
			'Title' => array(
				'type' => 'text',
				'section' => 'displayparams',
				'id' => 'wpTitle',
				'label-message' => 'tinymce-upload-title',
				'size' => 60,
				'default' => $this->mTitle,
			),
			'Link' => array(
				'type' => 'text',
				'section' => 'displayparams',
				'id' => 'wpLink',
				'label-message' => 'tinymce-upload-link',
				'size' => 60,
				'default' => $this->mLink,
			),
			'Width' => array(
				'type' => 'int',
				'section' => 'displayparams',
				'id' => 'wpWidth',
				'label-message' => 'tinymce-upload-width',
				'size' => 10,
				'default' => $this->mWidth,
			),
			'Height' => array(
				'type' => 'int',
				'section' => 'displayparams',
				'id' => 'wpHeight',
				'label-message' => 'tinymce-upload-height',
				'size' => 10,
				'default' => $this->mHeight,
			),
			'HorizontalAlignment' => array(
				'type' => 'select',
				'section' => 'displayparams',
				'id' => 'wpHorizontalAlign',
				'label-message' => 'tinymce-horizontal-align',
				'size' => 1,
				'options' => array(
					'Left' => 'left',
					'Center' => 'center',
					'Right' => 'right',
					'None' => 'none',
				),
				'default' => $this->mHorizontalAlignment,
			),
			'VerticalAlignment' => array(
				'type' => 'select',
				'section' => 'displayparams',
				'id' => 'wpVerticalAlign',
				'label-message' => 'tinymce-vertical-align',
				'size' => 1,
				'options' => array(
					'Middle' => 'middle',
		 			'Top' => 'top',
		 			'Bottom' => 'bottom',
 					'Baseline' => 'baseline',
					'Sub' => 'sub',
					'Super' => 'super',
					'Text top' => 'text-top',
					'Text bottom' => 'text-bottom',
				),
				'default' => $this->mVerticalAlignment,
			),
			'Format' => array(
				'type' => 'select',
				'section' => 'displayparams',
				'id' => 'wpFormat',
				'label-message' => 'tinymce-format',
				'size' => 1,
				'options' => array(
					'Thumb' => 'thumb',
					'Border' => 'border',
					'Frame' => 'frame',
 					'Frameless' => 'frameless',
				),
				'default' => $this->mFormat,
			),
		);

		return $descriptor;
	}

	/**
	 * Get the descriptor of the fieldset that contains the upload options,
	 * such as "watch this file". The section is 'options'
	 *
	 * @return array Descriptor array
	 */
	protected function getOptionsSection() {
		$descriptor = array(
			'Watchthis' => array(
				'type' => 'check',
				'id' => 'wpWatchthis',
				'label-message' => 'watchthisupload',
				'section' => 'options',
			)
		);
		if ( !$this->mHideIgnoreWarning ) {
			$descriptor['IgnoreWarning'] = array(
				'type' => 'check',
				'id' => 'wpIgnoreWarning',
				'label-message' => 'ignorewarnings',
				'section' => 'options',
			);
		}
		$descriptor['DestFileWarningAck'] = array(
			'type' => 'hidden',
			'id' => 'wpDestFileWarningAck',
			'default' => $this->mDestWarningAck ? '1' : '',
		);


		return $descriptor;

	}

	/**
	 * Add the upload JS and show the form.
	 */
	public function show() {
		$this->addUploadJS();
		parent::show();
		// disable output - we'll print out the page manually,
		// taking the body created by the form, plus the necessary
		// Javascript files, and turning them into an HTML page
		global $wgTitle, $wgLanguageCode,
		$wgXhtmlDefaultNamespace, $wgXhtmlNamespaces, $wgContLang;

		$out = $this->getOutput();

		$out->disable();
		$wgTitle = SpecialPage::getTitleFor( 'Upload' );

		$out->addModules( array(
			'mediawiki.action.edit', // For <charinsert> support
			'mediawiki.special.upload', // Extras for thumbnail and license preview.
			'mediawiki.legacy.upload', // For backward compatibility (this was removed 2014-09-10)
		) );

		$text = <<<END
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="{$wgXhtmlDefaultNamespace}"
END;
		foreach ( $wgXhtmlNamespaces as $tag => $ns ) {
			$text .= "xmlns:{$tag}=\"{$ns}\" ";
		}
		$dir = $wgContLang->isRTL() ? "rtl" : "ltr";
		$text .= "xml:lang=\"{$wgLanguageCode}\" lang=\"{$wgLanguageCode}\" dir=\"{$dir}\">";

		$text .= <<<END

<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<body>
{$out->getHTML()}
{$out->getBottomScripts()}
</body>
</html>

END;
		print $text;
	}

	/**
	 * Add upload JS to the OutputPage
	 */
	protected function addUploadJS() {
		$config = $this->getConfig();

		$useAjaxDestCheck = $config->get( 'UseAjax' ) && $config->get( 'AjaxUploadDestCheck' );
		$useAjaxLicensePreview = $config->get( 'UseAjax' ) &&
			$config->get( 'AjaxLicensePreview' ) && $config->get( 'EnableAPI' );
		$this->mMaxUploadSize['*'] = UploadBase::getMaxUploadSize();

		$scriptVars = array(
			'wgAjaxUploadDestCheck' => $useAjaxDestCheck,
			'wgAjaxLicensePreview' => $useAjaxLicensePreview,
			'wgUploadAutoFill' => !$this->mForReUpload &&
				// If we received mDestFile from the request, don't autofill
				// the wpDestFile textbox
				$this->mDestFile === '',
			'wgUploadSourceIds' => $this->mSourceIds,
			'wgCheckFileExtensions' => $config->get( 'CheckFileExtensions' ),
			'wgStrictFileExtensions' => $config->get( 'StrictFileExtensions' ),
			'wgCapitalizeUploads' => MWNamespace::isCapitalized( NS_FILE ),
			'wgMaxUploadSize' => $this->mMaxUploadSize,
		);

		$out = $this->getOutput();
		$out->addJsConfigVars( $scriptVars );
	}

	/**
	 * Empty function; submission is handled elsewhere.
	 *
	 * @return bool false
	 */
	function trySubmit() {
		return false;
	}

}
