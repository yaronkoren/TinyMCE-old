<?php
/**
 * TinyMCEUploadWindow - used for uploading files from within a form.
 * This class is heavily based on the Page Forms extension's
 * PFUploadWindow class, which in turn is heavily based on MediaWiki's
 * SpecialUpload class.
 *
 * @author Yaron Koren
 * @author Duncan Crane
 * @file
 * @ingroup TinyMCE
 */
class TinyMCEUploadWindow extends UnlistedSpecialPage {

	/** Misc variables **/
	public $mRequest;			// The WebRequest or FauxRequest this form is supposed to handle
	public $mSourceType;

	/** @var UploadBase */
	public $mUpload;
	public $mLocalFile;
	public $mUploadClicked;

	protected $mTextTop;
	protected $mTextAfterSummary;

	/** User input variables from the "description" section **/
	public $mDesiredDestName;	// The requested target file name
	public $mComment;
	public $mLicense;

	/** User input variables from the root section **/
	public $mIgnoreWarning;
	public $mWatchthis;
	public $mCopyrightStatus;
	public $mCopyrightSource;

	/** Hidden variables **/
	public $mDestWarningAck;	// Reinstated from SpecialUpload
	public $mForReUpload;		// The user followed an "overwrite this file" link
	public $mCancelUpload;		// The user clicked "Cancel and return to upload form" button
	public $mTokenOk;
	public $uploadFormTextTop;	// Text injection points for hooks not using HTMLForm
	public $uploadFormTextAfterSummary;

	/** Used by TinyMCE **/
	public $mInsertExisting;	// The user clicked "Inser existing file" button
	public $mDropSrc;	// Set to true when using drag and drop to load an image from the internet
	public $mSelect;	// wiki text selected, may be a link to existing uploaded file 
	public $mNode;		// wiki link to existing uploaded file 
	public $mNodeParent;	// parent of wiki link to existing uploaded file in case image has link
	public $mAltText;	// Alternative text to display in img tag
	public $mTitle;		// Title text to display in img tag
	public $mWidth;		// Width to display in img tag
	public $mHeight;	// Height to display in img tag
	public $mCaption;	// Caption to display in img tag
	public $mLink;		// Link to display in img tag
	public $mHorizontalAlign;	// Horizontal alignment to display in img tag
	public $mVerticalAlign;	// Vertical alignment to display in img tag
	public $mFormat;	// Format to display in img tag
	public $mWikiFile;	// Name of existing wiki file to insert into TinyMCE editor

	/**
	 * Constructor : initialise object
	 * Get data POSTed through the form and assign them to the object
	 * @param WebRequest $request Data posted.
	 */
	public function __construct( $request = null ) {
		parent::__construct( 'TinyMCEUploadWindow', 'upload' );
		$this->loadRequest( is_null( $request ) ? $this->getRequest() : $request );
	}


	/**
	 * Initialize instance variables from request and create an Upload handler
	 *
	 * @param WebRequest $request The request to extract variables from
	 */
	protected function loadRequest( $request ) {

		$this->mRequest = $request;
		$this->mSourceType = $request->getVal( 'wpSourceType', 'File' );

## DC set mUpload to wpUpload if this is a local file (not sure why just mustn't be empty)
		if ($this->mSourceType != "Local") {
			$this->mUpload = UploadBase::createFromRequest( $request );
		} else {
#			$this->mUpload = $request->getText( 'wpUpload' );;
			$this->mUpload = true;;
		}
## DC End
		$this->mUploadClicked = $request->wasPosted()
			&& ( $request->getCheck( 'wpUpload' )
			|| $request->getCheck( 'wpUploadIgnoreWarning' )
			|| $request->getText( 'pfDropSrc' ) );

		// Guess the desired name from the filename if not provided
## DC process depending on upload type eg file, url or wiki
		$this->mDesiredDestName = $request->getText( 'wpDestFile' );

		if ( !$this->mDesiredDestName ) {
			if ( $this->mSourceType == "File" ) {
				$this->mDesiredDestName = $request->getText( 'wpUploadFile' );
			} elseif ( $this->mSourceType == "Local" ) {
				$this->mDesiredDestName = $request->getText( 'wpInsertLocalWikiUpload' );
			} elseif ( $this->mSourceType == "Url" ) {
				// If dropSrc then use that otherwise use wpUploadFileURL 
				if ( $request->getText( 'pfDropSrc' ) ) {
					$this->mDesiredDestName = $request->getText( 'pfDropSrc') ;
				} else {
					$this->mDesiredDestName = $request->getText( 'wpUploadFileURL' );
				}
			}
		}

## DC End
#		$this->mComment	= $request->getText( 'wpUploadDescription' );
		$commentDefault = '';
		$commentMsg = wfMessage( 'upload-default-description' )->inContentLanguage();
		if ( !$this->mForReUpload && !$commentMsg->isDisabled() ) {
			$commentDefault = $commentMsg->plain();
		}
		$this->mComment = $request->getText( 'wpUploadDescription', $commentDefault );

		$this->mLicense	= $request->getText( 'wpLicense' );

		$this->mDestWarningAck = $request->getText( 'wpDestFileWarningAck' );
		$this->mIgnoreWarning = $request->getCheck( 'wpIgnoreWarning' )
			|| $request->getCheck( 'wpUploadIgnoreWarning' );
		$this->mWatchthis	= $request->getBool( 'wpWatchthis' );
		$this->mCopyrightStatus = $request->getText( 'wpUploadCopyStatus' );
		$this->mCopyrightSource = $request->getText( 'wpUploadSource' );

		$this->mForReUpload = $request->getBool( 'wpForReUpload' ); // updating a file
		$this->mCancelUpload = $request->getCheck( 'wpCancelUpload' )
					|| $request->getCheck( 'wpReUpload' ); // b/w compat
		$this->mInsertExisting	= $request->getCheck( 'wpInsertExistingFile' );
		$this->mDropSrc = $request->getVal( 'pfDropSrc', '' );


		// If it was posted check for the token (no remote POST'ing with user credentials)
		// TODO If it was a dropSrc then no form was used so set to token OK (CHECK is this secure?)
		$token = $request->getVal( 'wpEditToken' );
		if ( ( $this->mSourceType == 'File' || $this->mDropSrc ) && $token == null ) {
			// Skip token check for file uploads as that can't be faked via JS...
			// Some client-side tools don't expect to need to send wpEditToken
			// with their submissions, as that was new in 1.16.
			$this->mTokenOk = true;
		} else {
			$this->mTokenOk = $this->getUser()->matchEditToken( $token );
		}
		$this->uploadFormTextTop = '';
		$this->uploadFormTextAfterSummary = '';

		## DC for tinymce
		$this->mDropSrc = $request->getText( 'pfDropSrc' );
		$this->mSelect = $request->getText( 'pfSelect' );
		$this->mNode = $request->getText( 'pfNode' );
		$this->mAltText = $request->getText( 'wpAltText' );
		$this->mTitle = $request->getText( 'wpTitle' );
		$this->mWidth = $request->getText( 'wpWidth' );
		$this->mHeight = $request->getText( 'wpHeight' );
		$this->mCaption = $request->getText( 'wpCaption' );
		$this->mLink = $request->getText( 'wpLink' );
		$this->mHorizontalAlign = $request->getText( 'wpHorizontalAlignment' );
		$this->mVerticalAlign = $request->getText( 'wpVerticalAlignment' );
		$this->mFormat = $request->getText( 'wpFormat' );
		## DC end
//print_r($this);die;

	}

	/**
	 * Special page entry point
	 */
	public function execute( $par ) {
		//$this->useTransactionalTimeLimit();

		// Only output the body of the page.
		$this->getOutput()->setArticleBodyOnly( true );
		// This line is needed to get around Squid caching.
		$this->getOutput()->sendCacheControl();

		$this->setHeaders();
		$this->outputHeader();

		# Check uploading enabled
		if ( !UploadBase::isEnabled() ) {
			throw new ErrorPageError( 'uploaddisabled', 'uploaddisabledtext' );
		}

		# Check permissions
		$user = $this->getUser();
		$permissionRequired = UploadBase::isAllowed( $user );
		if ( $permissionRequired !== true ) {
			throw new PermissionsError( $permissionRequired );
		}

		# Check blocks
		if ( $this->getUser()->isBlocked() ) {
			throw new UserBlockedError( $this->getUser()->getBlock() );
		}

		# Check whether we actually want to allow changing stuff
		if ( wfReadOnly() ) {
			throw new ReadOnlyError();
		}

		# Unsave the temporary file in case this was a cancelled upload
		if ( $this->mCancelUpload ) {
			if ( !$this->unsaveUploadedFile() )
				# Something went wrong, so unsaveUploadedFile showed a warning
				return;
		}

		# Process upload or show a form
		if ( $this->mTokenOk && !$this->mCancelUpload
				&& ( $this->mUpload && $this->mUploadClicked ) ) {
			$this->processUpload();
		} else {

			# Backwards compatibility hook
			// Avoid PHP 7.1 warning from passing $this by reference
			$page = $this;
			if( !Hooks::run( 'UploadForm:initial', array( &$page ) ) ) {
				wfDebug( "Hook 'UploadForm:initial' broke output of the upload form" );
				return;
			}

			$this->showUploadForm( $this->getUploadForm() );
		}

# DC only cleanup if not local wiki file insert
		if ($this->mSourceType != "Local") {
			# Cleanup
			if ( $this->mUpload ) {
				$this->mUpload->cleanupTempFile();
			}
		}
## DC End
	}

	/**
	 * Show the main upload form.
	 *
	 * @param UploadForm $form
	 */
	protected function showUploadForm( $form ) {
		# Add links if file was previously deleted
		if (!$this->mDropSrc) { // DC only show form if not a drop operation
			if ( !$this->mDesiredDestName ) {
				$this->showViewDeletedLinks();
			}

			# $form->show();
			if ( $form instanceof HTMLForm ) {
				$form->show();
			} else {
				$this->getOutput()->addHTML( $form );
			}
		} // DC end silent drop operation
	}

	/**
	 * Get an UploadForm instance with title and text properly set.
	 *
	 * @param string $message HTML string to add to the form
	 * @param string $sessionKey Session key in case this is a stashed upload
	 * @return UploadForm
	 */
	protected function getUploadForm( $message = '', $sessionKey = '', $hideIgnoreWarning = false ) {
		# Initialize form
		$form = new TinyMCEUploadForm( array(
			'watch' => $this->watchCheck(),
			'forreupload' => $this->mForReUpload,
			'sessionkey' => $sessionKey,
			'hideignorewarning' => $hideIgnoreWarning,
			'texttop' => $this->uploadFormTextTop,
			'textaftersummary' => $this->uploadFormTextAfterSummary,
			'destfile' => $this->mDesiredDestName,
			'pfSelect' => $this->mSelect,
			'pfNode' => $this->mNode,
			'pfDropSrc' => $this->mDropSrc,
		) );
		$form->setTitle( $this->getTitle() );

		# Check the token, but only if necessary
		if ( !$this->mTokenOk && !$this->mCancelUpload
				&& ( $this->mUpload && $this->mUploadClicked ) ) {
			$form->addPreText( wfMessage( 'session_fail_preview' )->parse() );
		}

		# Add upload error message
		$form->addPreText( $message );
		
		# Add footer to form
		if ( !wfMessage( 'uploadfooter' )->isDisabled() ) {
			$uploadFooter = wfMessage( 'uploadfooter' )->plain();
			$form->addPostText( '<div id="mw-upload-footer-message">'
				. $this->getOutput()->parse( $uploadFooter ) . "</div>\n" );
		}

		return $form;
	}

	/**
	 * Shows the "view X deleted revivions link""
	 */
	protected function showViewDeletedLinks() {
		$title = Title::makeTitleSafe( NS_FILE, $this->mDesiredDestName );
		// Show a subtitle link to deleted revisions (to sysops et al only)
		if ( $title instanceof Title && ( $count = $title->isDeleted() ) > 0
			&& $this->getUser()->isAllowed( 'deletedhistory' ) ) {
			$link = wfMessage( $this->getUser()->isAllowed( 'delete' ) ? 'thisisdeleted' : 'viewdeleted' )
				->rawParams( $this->getSkin()->linkKnown(
					SpecialPage::getTitleFor( 'Undelete', $title->getPrefixedText() ),
					wfMessage( 'restorelink' )->numParams( $count )->escaped()
				)
			)->parse();
			$this->getOutput()->addHTML( "<div id=\"contentSub2\">{$link}</div>" );
		}

		// Show the relevant lines from deletion log (for still deleted files only)
		if ( $title instanceof Title && $title->isDeletedQuick() && !$title->exists() ) {
			$this->showDeletionLog( $this->getOutput(), $title->getPrefixedText() );
		}
	}

	/**
	 * Stashes the upload and shows the main upload form.
	 *
	 * Note: only errors that can be handled by changing the name or
	 * description should be redirected here. It should be assumed that the
	 * file itself is sane and has passed UploadBase::verifyFile. This
	 * essentially means that UploadBase::VERIFICATION_ERROR and
	 * UploadBase::EMPTY_FILE should not be passed here.
	 *
	 * @param string $message HTML message to be passed to mainUploadForm
	 */
	protected function recoverableUploadError( $message ) {
		$sessionKey = $this->mUpload->stashFile()->getFileKey();
		$message = '<h2>' . wfMessage( 'uploadwarning' )->escaped() . "</h2>\n" .
			'<div class="error">' . $message . "</div>\n";
		
		$form = $this->getUploadForm( $message, $sessionKey );
		$form->setSubmitText( wfMessage( 'upload-tryagain' )->text() );
		$this->showUploadForm( $form );
	}
	/**
	 * Stashes the upload, shows the main form, but adds an "continue anyway button"
	 *
	 * @param array $warnings
	 */
	protected function uploadWarning( $warnings ) {
#DC from specialupload
		if ( !$warnings || ( count( $warnings ) == 1
			&& isset( $warnings['exists'] )
			&& ( $this->mDestWarningAck || $this->mForReUpload ) )
		) {
			return false;
		}
#DC end

		$sessionKey = $this->mUpload->stashFile()->getFileKey();

		$warningHtml = '<h2>' . wfMessage( 'uploadwarning' )->escaped() . "</h2>\n"
			. '<ul class="warning">';
		foreach ( $warnings as $warning => $args ) {

#DC from specialupload
			if ( $warning == 'badfilename' ) {
				$this->mDesiredDestName = Title::makeTitle( NS_FILE, $args )->getText();
#DC end
			} elseif ( $warning == 'exists' ) {
				$msg = self::getExistsWarning( $args );
				$this->mDesiredDestName = $this->mLocalFile->getTitle()->getPartialURL();
			} elseif ( $warning == 'duplicate' ) {
				$msg = self::getDupeWarning( $args );
				$this->mDesiredDestName = $args[0]->getTitle()->getPartialURL();
			} elseif ( $warning == 'duplicate-archive' ) {
				$msg = "\t<li>" . wfMessage(
					'file-deleted-duplicate',
					array( Title::makeTitle( NS_FILE, $args )->getPrefixedText() )
				)->parse() . "</li>\n";
				$this->mDesiredDestName = $args[0]->getTitle()->getPartialURL();
			} else {
				if ( is_bool( $args ) ) {
					$args = array();
				} elseif ( !is_array( $args ) ) {
					$args = array( $args );
				}
				$msg = "\t<li>" . wfMessage( $warning, $args )->parse() . "</li>\n";
			}
			$warningHtml .= $msg;
		}
		$warningHtml .= "</ul>\n";
		$warningHtml .= wfMessage( 'uploadwarning-text' )->parseAsBlock();
		$this->mDesiredDestName = $this->mLocalFile->getTitle()->getPartialURL();
		$form = $this->getUploadForm( $warningHtml, $sessionKey, /* $hideIgnoreWarning */ true );
		$form->setSubmitText( wfMessage( 'upload-tryagain' )->text() );
		$form->addButton( 'wpInsertExistingFile', wfMessage( 'tinymce-insertbtn' )->text() );
		$form->addButton( 'wpUploadIgnoreWarning', wfMessage( 'ignorewarning' )->text() );
		$form->addButton( 'wpCancelUpload', wfMessage( 'reuploaddesc' )->text() );
## DC test to show warnings
		$this->mDropSrc = false;
## DC test end
		$this->showUploadForm( $form );
#DC from specialupload

		# Indicate that we showed a form
		return true;
#DC end
	}

	/**
	 * Show the upload form with error message, but do not stash the file.
	 *
	 * @param string $message
	 */
	protected function uploadError( $message ) {
		$message = '<h2>' . wfMessage( 'uploadwarning' )->escaped() . "</h2>\n" .
			'<div class="error">' . $message . "</div>\n";
		$this->showUploadForm( $this->getUploadForm( $message ) );
	}

	/**
	 * Do the upload.
	 * Checks are made in SpecialUpload::execute()
	 */
	protected function processUpload() {
		## DC skip this lot if just inserting local file into TinyMCE window
		if ($this->mSourceType != "Local") {

			// Verify permissions
			$permErrors = $this->mUpload->verifyPermissions( $this->getUser() );
			if ( $permErrors !== true ) {
				return $this->getOutput()->showPermissionsErrorPage( $permErrors );
			}

			// Fetch the file if required
			$status = $this->mUpload->fetchFile();

			if ( !$status->isOK() ) {
				if ($this->mDropSrc) {
					$notOK = wfMessage( "tinymce-sideupload-drop-error", $this->mDropSrc )->text();
					echo json_encode($notOK);
				}
				return $this->showUploadForm( $this->getUploadForm( $this->getOutput()->parse( $status->getWikiText() ) ) );
			} else {
				if ($this->mDropSrc) {
					$notOK = "Uploading " . $this->mDropSrc . " directly from website is complete";
					echo json_encode($notOK);
				}
			}

			if( !Hooks::run( 'UploadForm:BeforeProcessing', array( &$this ) ) ) {
				wfDebug( "Hook 'UploadForm:BeforeProcessing' broke processing the file.\n" );
				// This code path is deprecated. If you want to break upload processing
				// do so by hooking into the appropriate hooks in UploadBase::verifyUpload
				// and UploadBase::verifyFile.
				// If you use this hook to break uploading, the user will be returned
				// an empty form with no error message whatsoever.
				return;
			}

			// Upload verification
			$details = $this->mUpload->verifyUpload();
			if ( $details['status'] != UploadBase::OK ) {
				return $this->processVerificationError( $details );
			}
	
			$this->mLocalFile = $this->mUpload->getLocalFile();

			// Check warnings if necessary
			if ( !$this->mIgnoreWarning ) {
				$warnings = $this->mUpload->checkWarnings();

				if ( count( $warnings ) ) {
					return $this->uploadWarning( $warnings );
				}
			}

			// Get the page text if this is not a reupload
			if ( !$this->mForReUpload ) {
				$pageText = self::getInitialPageText( $this->mComment, $this->mLicense,
					$this->mCopyrightStatus, $this->mCopyrightSource, $this->getConfig() );
			} else {
				$pageText = false;
			}

			$status = $this->mUpload->performUpload( $this->mComment, $pageText, $this->mWatchthis, $this->getUser() );
			if ( !$status->isGood() ) {
				return $this->uploadError( $this->getOutput()->parse( $status->getWikiText() ) );
			}
		}
		## DC End

		// $this->getOutput()->redirect( $this->mLocalFile->getTitle()->getFullURL() );
		// Page Forms change - output Javascript to either
		// fill in or append to the field in original form, and
		// close the window
		# Chop off any directories in the given filename
		if ( $this->mDesiredDestName ) {
			$basename = $this->mDesiredDestName;
		} elseif ( is_a( $this->mUpload, 'UploadFromFile' ) ) {
			// MediaWiki 1.24+?
			$imageTitle = $this->mUpload->getTitle();
			$basename = $imageTitle->getText();
		} else {
## DC not sure if mSrcName is defined anywhere so not sure what next line does?
#			$basename = $this->mSrcName;
			return $this->uploadError( wfMessage( 'tinymce-no-file-name' )->parse() );
		}
## DC not sure either of the next lines is correct as it breaks filenames with ' ' and '_' ?
#		$basename = str_replace( '_', ' ', $basename );
		$basename = str_replace( ' ', '_', $basename );
## DC end
## DC Check that file exists on wiki and send error if not
		if ( wfLocalFile( $basename ) && ( wfLocalFile( $basename )->exists() == false ) ) {
			return $this->uploadError( wfMessage( 'filenotfound' , $basename )->parse() );
		}
## DC generate hash path depending if its an upload or existing file
		$hashpath = wfLocalFile( $basename )->getHashPath();
# DC End
		$output = "";

		// DC skip output of image if dropSrc as TinyMCE takes care of displaying images when dragged and dropped
		if ( !$this->mDropSrc ) {
		// UTF8-decoding is needed for IE.
		// Actually, this doesn't seem to fix the encoding in IE
		// any more... and it messes up the encoding for all other
		// browsers. @TODO - fix handling in IE!
		//$basename = utf8_decode( $basename );

			global $wgUploadPath, $wgServer;

			$dUploadFile = $wgServer . $wgUploadPath . "/" . $hashpath . $basename ;
			$dDropSrc = $this->mDropSrc;
			$dAltTxt = $this->mAltText;
			$dTitle = $this->mTitle;
			$dWidth = $this->mWidth;
			$dHeight = $this->mHeight;
			$dCaption = $this->mCaption;
			$dLink = $this->mLink;
			$dNode = $this->mNode;
			$dHorizontalAlign = $this->mHorizontalAlign;
			$dVerticalAlign = $this->mVerticalAlign;
			$dFormat = $this->mFormat;
			$dStyle = "";
			$dClass = "";

			// In the first place we have to assume that "thumb" and "frame" floats
			// right, as this is MW default. May be overridden below.
			if ( $dFormat === 'thumb' || $dFormat === 'frame' ) {
				$dStyle .= 'border:1px solid #CCCCCC;';
				if ( $dFormat === 'thumb' ) {
					$dClass = 'thumb ';
				} else {
					$dClass = 'thumbimage ';
				}	
				if ( $dHorizontalAlign === 'none' ){
					$dStyle .= 'float:right;';
					$dStyle .= 'clear:right;';
					$dStyle .= 'margin-left:1.4em;';
				}
			} elseif ( $dFormat === 'border' ) {
				$dClass = 'thumbborder ';
			}
			if ( $dHorizontalAlign === 'center' ) {
				$dStyle .= 'display: block;';
				$dStyle .= 'float:none;';
				$dStyle .= 'clear:none;';
				$dStyle .= 'margin-left:auto;';
				$dStyle .= 'margin-right:auto;';
				if ($dWidth) { 
					$dStyle .= 'width:'.$dWidth.';';
				} else {
					$dStyle .= 'width:auto;';
				}
				if ($dHeight) { 
					$dStyle .= 'height:'.$dHeight.';';
				}
			} elseif ( $dHorizontalAlign === 'right' ) {
				$dClass .= 'tright ';
				$dStyle .= 'float:right;';
				$dStyle .= 'clear:right;';
				$dStyle .= 'margin-left:1.4em;';
			} elseif ( $dHorizontalAlign === 'left' ) {
				$dClass .= 'tleft ';
				$dStyle .= 'float:left;';
				$dStyle .= 'clear:left;';
				$dStyle .= 'margin-right:1.4em;';
			}

			if ( $dVerticalAlign ) {
				$dStyle .= 'vertical-align:' . $dVerticalAlign . ';';
			}

			$output = <<<END
		<script type="text/javascript">
		var style = {};
		style.float = 'center';
		var editor = top.tinymce.activeEditor;
		var nodeID = '$dNode';
		if (nodeID == "") {
			nodeID = "TinyMCE" + (Math.floor((Math.random() * 100000) + 100000));
		}
		var data = {
			src: '$dUploadFile',
			alt: '$dAltTxt',
			title: '$dTitle', 
			width: '$dWidth',
			height: '$dHeight',
			caption: '$dCaption',
			link: '$dLink',
			format: '$dFormat',
			style: '$dStyle',
			class: '$dClass',
			contentEditable: 'false',
			id: nodeID
		};
		if (nodeID == '$dNode') {
			editor.undoManager.transact(function(){
				editor.focus();
				editor.dom.setAttribs(editor.dom.get(nodeID),data);
				editor.undoManager.add();
			});
		} else {
			var el = editor.dom.create('img', data);
			if ('$dLink') {
				el = editor.dom.create('a', {href: '$dLink'}, el);
			}
			editor.undoManager.transact(function(){
				editor.focus();
				editor.selection.setNode(el);
				editor.undoManager.add();
			});
		}

END;

		// DC end not outputting image because its a dropSrc
		} else {
			$output .= <<<END
		input.val( '$basename' );
		input.change();
END;
		}
		$output .= <<<END
		parent.jQuery.fancybox.close();
	</script>

END;
		// $this->getOutput()->addHTML( $output );

		print $output;
		$img = null; // @todo: added to avoid passing a ref to null - should this be defined somewhere?

		Hooks::run( 'SpecialUploadComplete', array( &$this ) );
	}

	/**
	 * Get the initial image page text based on a comment and optional file status information
	 */
	public static function getInitialPageText( $comment = '', $license = '', $copyStatus = '', $source = '' ) {
		global $wgUseCopyrightUpload;
		if ( $wgUseCopyrightUpload ) {
			$licensetxt = '';
			if ( $license !== '' ) {
				$licensetxt = '== ' . wfMessage( 'license-header' )->inContentLanguage()->text() . " ==\n" . '{{' . $license . '}}' . "\n";
			}
			$pageText = '== ' . wfMessage ( 'filedesc' )->inContentLanguage()->text() . " ==\n" . $comment . "\n" .
				'== ' . wfMessage( 'filestatus' )->inContentLanguage()->text() . " ==\n" . $copyStatus . "\n" .
				"$licensetxt" .
				'== ' . wfMessage( 'filesource' )->inContentLanguage()->text() . " ==\n" . $source ;
		} else {
			if ( $license !== '' ) {
				$filedesc = $comment === '' ? '' : '== ' . wfMessage( 'filedesc' )->inContentLanguage()->text() . " ==\n" . $comment . "\n";
				$pageText = $filedesc .
					'== ' . wfMessage( 'license-header' )->inContentLanguage()->text() . " ==\n" . '{{' . $license . '}}' . "\n";
			} else {
				$pageText = $comment;
			}
		}
		return $pageText;
	}

	/**
	 * See if we should check the 'watch this page' checkbox on the form
	 * based on the user's preferences and whether we're being asked
	 * to create a new file or update an existing one.
	 *
	 * In the case where 'watch edits' is off but 'watch creations' is on,
	 * we'll leave the box unchecked.
	 *
	 * Note that the page target can be changed *on the form*, so our check
	 * state can get out of sync.
	 */
	protected function watchCheck() {
		if ( $this->getUser()->getOption( 'watchdefault' ) ) {
			// Watch all edits!
			return true;
		}
##DC reinstated fromSpecialUpload
		$desiredTitleObj = Title::makeTitleSafe( NS_FILE, $this->mDesiredDestName );
		if ( $desiredTitleObj instanceof Title && $this->getUser()->isWatched( $desiredTitleObj ) ) {
			// Already watched, don't change that
			return true;
		}
##DC end
		$local = wfLocalFile( $this->mDesiredDestName );
		if ( $local && $local->exists() ) {
			// We're uploading a new version of an existing file.
			// No creation, so don't watch it if we're not already.
			return $this->getUser()->isWatched( $local->getTitle() );
		} else {
			// New page should get watched if that's our option.
			return $this->getUser()->getOption( 'watchcreations' );
		}
	}


	/**
	 * Provides output to the user for a result of UploadBase::verifyUpload
	 *
	 * @param array $details Result of UploadBase::verifyUpload
	 * @throws MWException
	 */
	protected function processVerificationError( $details ) {
		global $wgFileExtensions;

		switch( $details['status'] ) {

			/** Statuses that only require name changing **/
			case UploadBase::MIN_LENGTH_PARTNAME:
				$this->recoverableUploadError( wfMessage( 'minlength1' )->escaped() );
				break;
			case UploadBase::ILLEGAL_FILENAME:
				$this->recoverableUploadError( wfMessage( 'illegalfilename',
					$details['filtered'] )->parse() );
				break;
			case UploadBase::OVERWRITE_EXISTING_FILE:
				$this->recoverableUploadError( wfMessage( $details['overwrite'] )->parse() );
				break;
##DC reinstate from SpecialUpload
			case UploadBase::FILENAME_TOO_LONG:
				$this->showRecoverableUploadError( $this->msg( 'filename-toolong' )->escaped() );
				break;
			case UploadBase::WINDOWS_NONASCII_FILENAME:
				$this->showRecoverableUploadError( $this->msg( 'windows-nonascii-filename' )->parse() );
				break;
##DC end
			case UploadBase::FILETYPE_MISSING:
				$this->recoverableUploadError( wfMessage( 'filetype-missing' )->parse() );
				break;
			/** Statuses that require reuploading **/
			case UploadBase::FILE_TOO_LARGE:
				$this->showUploadForm( $this->getUploadForm( wfMessage( 'file-too-large' )->escaped() ) );
				break;
			case UploadBase::EMPTY_FILE:
				$this->showUploadForm( $this->getUploadForm( wfMessage( 'emptyfile' )->escaped() ) );
				break;
			case UploadBase::FILETYPE_BADTYPE:
/*				$finalExt = $details['finalExt'];
				$this->uploadError(
					wfMessage( 'filetype-banned-type',
						htmlspecialchars( $finalExt ), // @todo Double escaping?
						implode(
							wfMessage( 'comma-separator' )->text(),
							$wgFileExtensions
						)
					)->numParams( count( $wgFileExtensions ) )->parse()
				);
*/
				break;
##DC reinstate frm SpecialUpload
				$msg = $this->msg( 'filetype-banned-type' );
				if ( isset( $details['blacklistedExt'] ) ) {
					$msg->params( $this->getLanguage()->commaList( $details['blacklistedExt'] ) );
				} else {
					$msg->params( $details['finalExt'] );
				}
				$extensions = array_unique( $this->getConfig()->get( 'FileExtensions' ) );
				$msg->params( $this->getLanguage()->commaList( $extensions ),
					count( $extensions ) );

				// Add PLURAL support for the first parameter. This results
				// in a bit unlogical parameter sequence, but does not break
				// old translations
				if ( isset( $details['blacklistedExt'] ) ) {
					$msg->params( count( $details['blacklistedExt'] ) );
				} else {
					$msg->params( 1 );
				}

				$this->showUploadError( $msg->parse() );
				break;
##DC End
			case UploadBase::VERIFICATION_ERROR:
				unset( $details['status'] );
				$code = array_shift( $details['details'] );
				$this->uploadError( wfMessage( $code, $details['details'] )->parse() );
				break;
			case UploadBase::HOOK_ABORTED:
/*				$error = $details['error'];
				$this->uploadError( wfMessage( $error )->parse() );
				break;
*/
##DC reinstate from SpecialUpload
				if ( is_array( $details['error'] ) ) { # allow hooks to return error details in an array
					$args = $details['error'];
					$error = array_shift( $args );
				} else {
					$error = $details['error'];
					$args = null;
				}

				$this->showUploadError( $this->msg( $error, $args )->parse() );
				break;
##DC End
			default:
				throw new MWException( __METHOD__ . ": Unknown value `{$details['status']}`" );
		}
	}

	/**
	 * Remove a temporarily kept file stashed by saveTempUploadedFile().
	 * @access private
	 * @return success
	 */
	protected function unsaveUploadedFile() {
		if ( !( $this->mUpload instanceof UploadFromStash ) )
			return true;
		$success = $this->mUpload->unsaveUploadedFile();
		if ( ! $success ) {
			$this->getOutput()->showFileDeleteError( $this->mUpload->getTempPath() );
			return false;
		} else {
			return true;
		}
	}

	/*** Functions for formatting warnings ***/

	/**
	 * Formats a result of UploadBase::getExistsWarning as HTML
	 * This check is static and can be done pre-upload via AJAX
	 *
	 * @param array $exists The result of UploadBase::getExistsWarning
	 * @return string Empty string if there is no warning or an HTML fragment
	 * consisting of one or more <li> elements if there is a warning.
	 */
	public static function getExistsWarning( $exists ) {
		if ( !$exists )
			return '';

		$file = $exists['file'];
		$filename = $file->getTitle()->getPrefixedText();
		$warning = array();

		if ( $exists['warning'] == 'exists' ) {
			// Exact match
			$warning[] = '<li>' . wfMessage( 'fileexists', $filename )->parse() . '</li>';
		} elseif ( $exists['warning'] == 'page-exists' ) {
			// Page exists but file does not
			$warning[] = '<li>' . wfMessage( 'filepageexists', $filename )->parse() . '</li>';
		} elseif ( $exists['warning'] == 'exists-normalized' ) {
			$warning[] = '<li>' . wfMessage( 'fileexists-extension', $filename,
				$exists['normalizedFile']->getTitle()->getPrefixedText() )->parse() . '</li>';
		} elseif ( $exists['warning'] == 'thumb' ) {
			// Swapped argument order compared with other messages for backwards compatibility
			$warning[] = '<li>' . wfMessage( 'fileexists-thumbnail-yes',
				$exists['thumbFile']->getTitle()->getPrefixedText(), $filename )->parse() . '</li>';
		} elseif ( $exists['warning'] == 'thumb-name' ) {
			// Image w/o '180px-' does not exists, but we do not like these filenames
			$name = $file->getName();
			$badPart = substr( $name, 0, strpos( $name, '-' ) + 1 );
			$warning[] = '<li>' . wfMessage( 'file-thumbnail-no', $badPart )->parse() . '</li>';
		} elseif ( $exists['warning'] == 'bad-prefix' ) {
			$warning[] = '<li>' . wfMessage( 'filename-bad-prefix', $exists['prefix'] )->parse() . '</li>';
		} elseif ( $exists['warning'] == 'was-deleted' ) {
			# If the file existed before and was deleted, warn the user of this
			$ltitle = SpecialPage::getTitleFor( 'Log' );
			$llink = Linker::linkKnown(
				$ltitle,
				wfMessage( 'deletionlog' )->escaped(),
				array(),
				array(
					'type' => 'delete',
					'page' => $filename
				)
			);
			$warning[] = '<li>' . wfMessage( 'filewasdeleted' )->rawParams( $llink )->parse() . '</li>';
		}

		return implode( "\n", $warning );
	}

	/**
	 * Get a list of warnings
	 *
	 * @param string local filename, e.g. 'file exists', 'non-descriptive filename'
	 * @return array list of warning messages
	 */
	public static function ajaxGetExistsWarning( $filename ) {
		$file = wfFindFile( $filename );
		if ( !$file ) {
			// Force local file so we have an object to do further checks against
			// if there isn't an exact match...
			$file = wfLocalFile( $filename );
		}
		$s = '&#160;';
		if ( $file ) {
			$exists = UploadBase::getExistsWarning( $file );
			$warning = self::getExistsWarning( $exists );
			if ( $warning !== '' ) {
				$s = "<ul>$warning</ul>";
			}
		}
		return $s;
	}

	/**
	 * Render a preview of a given license for the AJAX preview on upload
	 *
	 * @param string $license
	 * @return string
	 */
	public static function ajaxGetLicensePreview( $license ) {
		global $wgParser, $wgUser;
		$text = '{{' . $license . '}}';
		$title = Title::makeTitle( NS_FILE, 'Sample.jpg' );
		$options = ParserOptions::newFromUser( $wgUser );

		// Expand subst: first, then live templates...
		$text = $wgParser->preSaveTransform( $text, $title, $wgUser, $options );
		$output = $wgParser->parse( $text, $title, $options );

		return $output->getText();
	}

	/**
	 * Construct a warning and a gallery from an array of duplicate files.
	 */
	public static function getDupeWarning( $dupes ) {
		if ( $dupes ) {
			global $wgOut;
			$msg = "<gallery>";
			foreach ( $dupes as $file ) {
				$title = $file->getTitle();
				$msg .= $title->getPrefixedText() .
					"|" . $title->getText() . "\n";
			}
			$msg .= "</gallery>";
			return "<li>" .
				wfMessage( "file-exists-duplicate" )->numParams( count( $dupes ) )->parseAsBlock() .
				$wgOut->parse( $msg ) .
				"</li>\n";
		} else {
			return '';
		}
	}
}
