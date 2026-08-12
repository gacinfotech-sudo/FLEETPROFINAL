package com.fleetpro.business.ui.performance

import android.animation.ValueAnimator
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.DecelerateInterpolator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AnimationOptimizer @Inject constructor() {
    private val activeAnimations = AtomicInteger(0)
    private val _isAnimating = MutableStateFlow(false)
    val isAnimating: StateFlow<Boolean> = _isAnimating

    fun createSmoothTransition(
        duration: Long = 300,
        updateListener: (Float) -> Unit,
        onComplete: (() -> Unit)? = null
    ) {
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            this.duration = duration
            interpolator = AccelerateDecelerateInterpolator()

            addUpdateListener { animation ->
                val progress = animation.animatedValue as Float
                updateListener(progress)
            }

            addListener(object : android.animation.AnimatorListener {
                override fun onAnimationStart(animation: android.animation.Animator) {
                    activeAnimations.incrementAndGet()
                    _isAnimating.value = true
                }

                override fun onAnimationEnd(animation: android.animation.Animator) {
                    if (activeAnimations.decrementAndGet() == 0) {
                        _isAnimating.value = false
                    }
                    onComplete?.invoke()
                }

                override fun onAnimationCancel(animation: android.animation.Animator) {
                    if (activeAnimations.decrementAndGet() == 0) {
                        _isAnimating.value = false
                    }
                }

                override fun onAnimationRepeat(animation: android.animation.Animator) {}
            })
        }

        animator.start()
    }

    fun createDismissalAnimation(
        duration: Long = 200,
        updateListener: (Float) -> Unit,
        onComplete: (() -> Unit)? = null
    ) {
        val animator = ValueAnimator.ofFloat(1f, 0f).apply {
            this.duration = duration
            interpolator = DecelerateInterpolator()

            addUpdateListener { animation ->
                val progress = animation.animatedValue as Float
                updateListener(progress)
            }

            addListener(object : android.animation.AnimatorListener {
                override fun onAnimationStart(animation: android.animation.Animator) {
                    activeAnimations.incrementAndGet()
                }

                override fun onAnimationEnd(animation: android.animation.Animator) {
                    if (activeAnimations.decrementAndGet() == 0) {
                        _isAnimating.value = false
                    }
                    onComplete?.invoke()
                }

                override fun onAnimationCancel(animation: android.animation.Animator) {
                    if (activeAnimations.decrementAndGet() == 0) {
                        _isAnimating.value = false
                    }
                }

                override fun onAnimationRepeat(animation: android.animation.Animator) {}
            })
        }

        animator.start()
    }

    fun cancelAllAnimations() {
        activeAnimations.set(0)
        _isAnimating.value = false
    }

    fun areAnimationsDisabled(): Boolean {
        // Check system animation scale
        return try {
            android.provider.Settings.Global.getFloat(null, "animator_duration_scale", 1.0f) == 0f
        } catch (e: Exception) {
            false
        }
    }
}
