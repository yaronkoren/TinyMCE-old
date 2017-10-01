<?php
/**
 * TinyMCEUploadSourceField - heavily based on the Page Forms extenion's
 * PFUploadSourceField class.
 *
 * @author Yaron Koren
 * @author Duncan Crane
 * @file
 * @ingroup TinyMCE
 */

/**
 * A form field that contains a radio box in the label.
 */
class TinyMCEUploadSourceField extends HTMLTextField {
	
	function getLabelHtml( $cellAttributes = array() ) {
		$id = "wpSourceType{$this->mParams['upload-type']}";
		$label = Html::rawElement( 'label', array( 'for' => $id ), $this->mLabel );

		//if ( !empty( $this->mParams['radio'] ) ) {
			$attribs = array(
				'name' => 'wpSourceType',
				'type' => 'radio',
				'id' => $id,
				'value' => $this->mParams['upload-type'],
			);
			
			if ( !empty( $this->mParams['checked'] ) )
				$attribs['checked'] = 'checked';
			$label .= Html::element( 'input', $attribs );
		//}

		return Html::rawElement( 'td', array( 'class' => 'mw-label' ), $label );
	}
	
	function getSize() {
		return isset( $this->mParams['size'] )
			? $this->mParams['size']
			: 60;
	}
	
	/**
	 * This page can be shown if uploading is enabled.
	 * Handle permission checking elsewhere in order to be able to show
	 * custom error messages.
	 *
	 * @param User $user
	 * @return bool
	 */
	public function userCanExecute( User $user ) {
		return UploadBase::isEnabled() && parent::userCanExecute( $user );
	}

}
