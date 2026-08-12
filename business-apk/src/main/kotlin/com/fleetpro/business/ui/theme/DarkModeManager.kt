package com.fleetpro.business.ui.theme

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DarkModeManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val prefs: SharedPreferences = context.getSharedPreferences(
        "dark_mode_prefs",
        Context.MODE_PRIVATE
    )

    private val _darkModeEnabled = MutableStateFlow(isDarkModeEnabled())
    val darkModeEnabled: StateFlow<Boolean> = _darkModeEnabled

    private val _themeMode = MutableStateFlow(getThemeMode())
    val themeMode: StateFlow<Int> = _themeMode

    fun isDarkModeEnabled(): Boolean {
        val systemDefault = when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ->
                context.resources.configuration.uiMode and
                android.content.res.Configuration.UI_MODE_NIGHT_MASK ==
                android.content.res.Configuration.UI_MODE_NIGHT_YES
            else -> false
        }
        return prefs.getBoolean("dark_mode", systemDefault)
    }

    fun getThemeMode(): Int {
        return prefs.getInt(
            "theme_mode",
            AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
        )
    }

    fun setDarkMode(enabled: Boolean) {
        prefs.edit().putBoolean("dark_mode", enabled).apply()
        _darkModeEnabled.value = enabled

        val mode = if (enabled) {
            AppCompatDelegate.MODE_NIGHT_YES
        } else {
            AppCompatDelegate.MODE_NIGHT_NO
        }
        AppCompatDelegate.setDefaultNightMode(mode)
        _themeMode.value = mode
    }

    fun setThemeMode(mode: Int) {
        prefs.edit().putInt("theme_mode", mode).apply()
        _themeMode.value = mode
        AppCompatDelegate.setDefaultNightMode(mode)
    }

    fun useSystemDefault() {
        setThemeMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
    }

    fun toggleDarkMode() {
        setDarkMode(!isDarkModeEnabled())
    }

    fun resetToSystemDefault() {
        prefs.edit().clear().apply()
        setThemeMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
    }
}
