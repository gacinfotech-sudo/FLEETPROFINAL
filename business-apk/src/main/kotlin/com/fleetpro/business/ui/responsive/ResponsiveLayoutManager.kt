package com.fleetpro.business.ui.responsive

import android.content.Context
import android.content.res.Configuration
import android.graphics.Point
import android.util.DisplayMetrics
import android.view.WindowManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

sealed class ScreenSize {
    object Phone : ScreenSize()
    object Tablet : ScreenSize()
    object Foldable : ScreenSize()
}

data class ScreenMetrics(
    val screenSize: ScreenSize,
    val widthDp: Int,
    val heightDp: Int,
    val isLandscape: Boolean,
    val isPortrait: Boolean,
    val density: Float,
    val densityDpi: Int,
    val aspectRatio: Float,
    val statusBarHeight: Int = 0,
    val navigationBarHeight: Int = 0,
)

@Singleton
class ResponsiveLayoutManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val displayMetrics = DisplayMetrics()

    private val _metrics = MutableStateFlow(calculateMetrics())
    val metrics: StateFlow<ScreenMetrics> = _metrics

    fun calculateMetrics(): ScreenMetrics {
        windowManager.defaultDisplay.getMetrics(displayMetrics)

        val widthDp = (displayMetrics.widthPixels / displayMetrics.density).toInt()
        val heightDp = (displayMetrics.heightPixels / displayMetrics.density).toInt()

        val isLandscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        val isPortrait = !isLandscape

        val screenSize = when {
            widthDp >= 820 -> ScreenSize.Tablet
            widthDp >= 600 && heightDp >= 600 -> ScreenSize.Foldable
            else -> ScreenSize.Phone
        }

        val aspectRatio = displayMetrics.widthPixels.toFloat() / displayMetrics.heightPixels.toFloat()

        val statusBarHeight = getStatusBarHeight()
        val navigationBarHeight = getNavigationBarHeight()

        return ScreenMetrics(
            screenSize = screenSize,
            widthDp = widthDp,
            heightDp = heightDp,
            isLandscape = isLandscape,
            isPortrait = isPortrait,
            density = displayMetrics.density,
            densityDpi = displayMetrics.densityDpi,
            aspectRatio = aspectRatio,
            statusBarHeight = statusBarHeight,
            navigationBarHeight = navigationBarHeight
        )
    }

    private fun getStatusBarHeight(): Int {
        val resourceId = context.resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (resourceId > 0) context.resources.getDimensionPixelSize(resourceId) else 24
    }

    private fun getNavigationBarHeight(): Int {
        val resourceId = context.resources.getIdentifier("navigation_bar_height", "dimen", "android")
        return if (resourceId > 0) context.resources.getDimensionPixelSize(resourceId) else 48
    }

    fun getOptimalColumnCount(): Int {
        return when (_metrics.value.screenSize) {
            ScreenSize.Tablet -> 3
            ScreenSize.Foldable -> 2
            ScreenSize.Phone -> if (_metrics.value.isLandscape) 2 else 1
        }
    }

    fun getOptimalPadding(): Int {
        return when (_metrics.value.screenSize) {
            ScreenSize.Tablet -> 24
            ScreenSize.Foldable -> 16
            ScreenSize.Phone -> 16
        }
    }

    fun getOptimalTextSize(baseSize: Float): Float {
        val scaleFactor = when {
            _metrics.value.widthDp >= 820 -> 1.2f
            _metrics.value.widthDp >= 600 -> 1.1f
            else -> 1.0f
        }
        return baseSize * scaleFactor
    }

    fun isMultiPaneLayout(): Boolean {
        return _metrics.value.screenSize == ScreenSize.Tablet ||
                (_metrics.value.screenSize == ScreenSize.Foldable && _metrics.value.isLandscape)
    }

    fun isFoldableDevice(): Boolean {
        return _metrics.value.screenSize == ScreenSize.Foldable
    }

    fun getWindowInsets(): Insets {
        return Insets(
            top = _metrics.value.statusBarHeight,
            bottom = _metrics.value.navigationBarHeight,
            left = if (_metrics.value.isLandscape) 0 else 0,
            right = if (_metrics.value.isLandscape) 0 else 0
        )
    }

    fun onConfigurationChanged() {
        _metrics.value = calculateMetrics()
    }

    data class Insets(val top: Int, val bottom: Int, val left: Int, val right: Int)
}
