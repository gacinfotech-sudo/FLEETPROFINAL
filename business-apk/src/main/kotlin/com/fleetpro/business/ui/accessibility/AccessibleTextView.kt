package com.fleetpro.business.ui.accessibility

import android.content.Context
import android.graphics.Color
import android.os.Build
import android.util.AttributeSet
import android.util.TypedValue
import androidx.appcompat.widget.AppCompatTextView
import androidx.core.view.ViewCompat

class AccessibleTextView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : AppCompatTextView(context, attrs, defStyleAttr) {

    init {
        // Minimum text size for readability (SP)
        if (textSize < 14f) {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        }

        // Line height for better readability (1.5x is ideal)
        setLineSpacing(0f, 1.5f)

        // Configure for accessibility
        configureAccessibility()
    }

    private fun configureAccessibility() {
        // Enable selection for content
        isTextSelectable = true

        // Live region announcement
        ViewCompat.setAccessibilityLiveRegion(this, ViewCompat.ACCESSIBILITY_LIVE_REGION_POLITE)

        // Ensure sufficient contrast ratio (WCAG AA: 4.5:1 for normal text)
        validateContrast()
    }

    private fun validateContrast() {
        val textColor = currentTextColor
        val bgColor = context.resources.getColor(android.R.color.background_light, context.theme)

        val contrast = calculateContrastRatio(textColor, bgColor)
        if (contrast < 4.5) {
            // Adjust text color for better contrast if needed
            if (isColorBright(bgColor)) {
                setTextColor(Color.BLACK)
            } else {
                setTextColor(Color.WHITE)
            }
        }
    }

    private fun calculateContrastRatio(foreground: Int, background: Int): Double {
        val fgLum = calculateLuminance(foreground)
        val bgLum = calculateLuminance(background)

        val lighter = if (fgLum > bgLum) fgLum else bgLum
        val darker = if (fgLum > bgLum) bgLum else fgLum

        return (lighter + 0.05) / (darker + 0.05)
    }

    private fun calculateLuminance(color: Int): Double {
        val r = (Color.red(color) / 255.0).let { if (it <= 0.03928) it / 12.92 else Math.pow((it + 0.055) / 1.055, 2.0) }
        val g = (Color.green(color) / 255.0).let { if (it <= 0.03928) it / 12.92 else Math.pow((it + 0.055) / 1.055, 2.0) }
        val b = (Color.blue(color) / 255.0).let { if (it <= 0.03928) it / 12.92 else Math.pow((it + 0.055) / 1.055, 2.0) }

        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    private fun isColorBright(color: Int): Boolean {
        val luminance = calculateLuminance(color)
        return luminance > 0.5
    }

    fun setAccessibleHeading(level: Int, text: String) {
        this.text = text
        contentDescription = "Heading level $level: $text"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            announceForAccessibility("Heading level $level: $text")
        }
    }

    fun setAccessibleDescription(description: String) {
        contentDescription = description

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            announceForAccessibility(description)
        }
    }

    override fun onTextChanged(
        text: CharSequence?,
        start: Int,
        lengthBefore: Int,
        lengthAfter: Int
    ) {
        super.onTextChanged(text, start, lengthBefore, lengthAfter)
        validateContrast()
    }
}
