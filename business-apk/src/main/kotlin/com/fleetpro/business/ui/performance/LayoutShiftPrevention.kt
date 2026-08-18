package com.fleetpro.business.ui.performance

import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.recyclerview.widget.RecyclerView

class LayoutShiftPrevention {
    companion object {
        /**
         * Reserve space for images before they load to prevent layout shift
         * Aspect ratio: 16:9 = 0.5625, 1:1 = 1.0, 4:3 = 0.75
         */
        fun reserveImageSpace(imageView: ImageView, aspectRatio: Float = 0.5625f) {
            val width = imageView.layoutParams.width
            if (width > 0) {
                val height = (width / aspectRatio).toInt()
                imageView.layoutParams.height = height
                imageView.requestLayout()
            }
        }

        /**
         * Create a placeholder for loading content
         */
        fun createPlaceholder(container: ViewGroup, heightDp: Int) {
            val heightPx = (heightDp * container.resources.displayMetrics.density).toInt()
            val placeholder = View(container.context).apply {
                setBackgroundColor(container.resources.getColor(android.R.color.darker_gray, null))
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    heightPx
                )
            }
            container.addView(placeholder)
        }

        /**
         * Reserve space for text to prevent layout shift when content loads
         */
        fun reserveTextSpace(textView: TextView, lineCount: Int = 2, minHeight: Int? = null) {
            val minHeightPx = minHeight ?: (lineCount * textView.lineHeight)
            textView.minHeight = minHeightPx
            textView.setLines(lineCount)
        }

        /**
         * Apply safe margins to prevent cutoff on notched devices
         */
        fun applyNotchSafePadding(view: View, topPadding: Int, rightPadding: Int) {
            view.setPadding(
                view.paddingLeft,
                view.paddingTop + topPadding,
                view.paddingRight + rightPadding,
                view.paddingBottom
            )
        }

        /**
         * Prevent layout shift in RecyclerView by fixing item decorations
         */
        fun stabilizeRecyclerViewLayout(recyclerView: RecyclerView) {
            // Disable layout animations during initial load
            recyclerView.itemAnimator?.apply {
                addDuration = 0
                removeDuration = 0
                moveDuration = 0
                changeDuration = 0
            }

            // Set fixed size if possible
            recyclerView.setHasFixedSize(true)
        }

        /**
         * Create content skeleton (placeholder) for smooth loading
         */
        fun createContentSkeleton(container: ViewGroup) {
            // Add shimmer effect views or skeleton screens
            val skeleton = LinearLayout(container.context).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            }

            // Add skeleton line 1
            val line1 = View(container.context).apply {
                setBackgroundColor(container.resources.getColor(android.R.color.darker_gray, null))
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    16
                ).apply {
                    bottomMargin = 8
                }
            }
            skeleton.addView(line1)

            // Add skeleton line 2
            val line2 = View(container.context).apply {
                setBackgroundColor(container.resources.getColor(android.R.color.darker_gray, null))
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    16
                ).apply {
                    bottomMargin = 8
                }
            }
            skeleton.addView(line2)

            // Add skeleton line 3 (partial width)
            val line3 = View(container.context).apply {
                setBackgroundColor(container.resources.getColor(android.R.color.darker_gray, null))
                layoutParams = LinearLayout.LayoutParams(
                    (container.width * 0.7).toInt(),
                    16
                )
            }
            skeleton.addView(line3)

            container.addView(skeleton)
        }

        /**
         * Apply inset constraints to prevent cutoff on foldable devices
         */
        fun applyFoldableInsets(view: View, hinge: Pair<Int, Int>) {
            if (view is ConstraintLayout) {
                // Left pane: constrain to left of hinge
                // Right pane: constrain to right of hinge
                // Implementation depends on actual layout
            }
        }
    }
}
