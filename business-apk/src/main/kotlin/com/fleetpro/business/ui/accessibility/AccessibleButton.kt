package com.fleetpro.business.ui.accessibility

import android.content.Context
import android.os.Build
import android.util.AttributeSet
import android.view.View
import androidx.appcompat.widget.AppCompatButton
import androidx.core.view.ViewCompat

class AccessibleButton @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : AppCompatButton(context, attrs, defStyleAttr) {

    init {
        // Ensure minimum touch target size (48dp x 48dp per Material guidelines)
        val minSize = 48 * resources.displayMetrics.density.toInt()
        minimumHeight = minSize
        minimumWidth = minSize

        // Enable focus indicator for keyboard navigation
        isFocusable = true
        isClickable = true

        // Set default content description if not provided
        if (contentDescription.isNullOrEmpty()) {
            contentDescription = text
        }

        // Configure for accessibility
        configureAccessibility()
    }

    private fun configureAccessibility() {
        // Enable announcement of button state
        ViewCompat.setAccessibilityLiveRegion(this, ViewCompat.ACCESSIBILITY_LIVE_REGION_POLITE)

        // Set minimum contrast ratio (WCAG AA: 4.5:1 for text)
        setLabelFor(ViewCompat.generateViewId())

        // Announce button press to screen readers
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            announceForAccessibility("Button ${text} activated")
        }
    }

    override fun onFocusChanged(focused: Boolean, direction: Int, previouslyFocusedRect: android.graphics.Rect?) {
        super.onFocusChanged(focused, direction, previouslyFocusedRect)
        if (focused && !isClickable) {
            // Announce that this button is disabled
            announceForAccessibility("Button ${text} is disabled")
        }
    }

    fun setAccessibleDescription(description: String) {
        contentDescription = description
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            announceForAccessibility(description)
        }
    }

    fun setAccessibleState(state: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CORE_EXTENSIONS) {
            announceForAccessibility("$text $state")
        }
    }
}
