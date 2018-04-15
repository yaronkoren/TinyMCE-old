<?php

use MediaWiki\MediaWikiServices;

/**
 * Handles the formedit action.
 *
 * @author Yaron Koren
 * @author Stephan Gambke
 * @file
 * @ingroup PF
 */

class TinyMCEAction extends Action {

	/**
	 * Return the name of the action this object responds to
	 * @return String lowercase
	 */
	public function getName() {
		return 'tinymceedit';
	}

	/**
	 * The main action entry point.
	 * @throws ErrorPageError
	 */
	public function show() {
		$title = $this->getTitle();
		$context = $this->getContext();
		$article = Article::newFromTitle( $title, $context );
		$editPage = new EditPage( $article );
		// Keep additional screens in this tab, instead of going to 'action=submit'.
		$editPage->action = 'tinymceedit';
		return $editPage->edit();
	}

	/**
	 * Execute the action in a silent fashion: do not display anything or release any errors.
	 * @return Bool whether execution was successful
	 */
	public function execute() {
		return true;
	}

	/**
	 * Adds an "action" (i.e., a tab) to edit the current article with
	 * TinyMCE.
	 */
	static function displayTab( $obj, &$links ) {
		global $wgRequest;

		$content_actions = &$links['views'];
		$title = $obj->getTitle();
		$context = $obj->getContext();

		if ( !isset( $title ) || !$title->userCan( 'edit' ) ) {
			return true;
		}

		if ( !TinyMCEHooks::enableTinyMCE( $title, $context ) ) {
			return true;
		}

		// Create the form edit tab, and apply whatever changes are
		// specified by the edit-tab global variables.
		if ( array_key_exists( 'edit', $content_actions ) ) {
			$content_actions['edit']['text'] = wfMessage( 'tinymce-editsource' )->text();
		}

		$class_name = ( $wgRequest->getVal( 'action' ) == 'tinymceedit' ) ? 'selected' : '';
		$tinyMCETab = array(
			'class' => $class_name,
			'text' => wfMessage( 'edit' )->text(),
			'href' => $title->getLocalURL( 'action=tinymceedit' )
		);

		// Find the location of the 'edit' tab, and add 'edit
		// with form' right before it.
		// This is a "key-safe" splice - it preserves both the keys
		// and the values of the array, by editing them separately
		// and then rebuilding the array. Based on the example at
		// http://us2.php.net/manual/en/function.array-splice.php#31234
		$tab_keys = array_keys( $content_actions );
		$tab_values = array_values( $content_actions );
		$edit_tab_location = array_search( 'edit', $tab_keys );

		// If there's no 'edit' tab, look for the 'view source' tab
		// instead.
		if ( $edit_tab_location == null ) {
			$edit_tab_location = array_search( 'viewsource', $tab_keys );
		}

		// This should rarely happen, but if there was no edit *or*
		// view source tab, set the location index to -1, so the
		// tab shows up near the end.
		if ( $edit_tab_location == null ) {
			$edit_tab_location = - 1;
		}
		array_splice( $tab_keys, $edit_tab_location, 0, 'tinymceedit' );
		array_splice( $tab_values, $edit_tab_location, 0, array( $tinyMCETab ) );
		$content_actions = array();
		for ( $i = 0; $i < count( $tab_keys ); $i++ ) {
			$content_actions[$tab_keys[$i]] = $tab_values[$i];
		}

		return true; // always return true, in order not to stop MW's hook processing!
	}

}
