package com.strive.movago

import androidx.compose.ui.window.ComposeUIViewController
import com.strive.movago.di.IosAppComponent

@Suppress("ktlint:standard:function-naming")
fun MainViewController() = ComposeUIViewController {
    IosAppComponent.instance
    App()
}
