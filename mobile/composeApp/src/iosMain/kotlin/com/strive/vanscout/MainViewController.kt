package com.strive.vanscout

import androidx.compose.ui.window.ComposeUIViewController
import com.strive.vanscout.di.IosAppComponent

@Suppress("ktlint:standard:function-naming")
fun MainViewController() = ComposeUIViewController {
    IosAppComponent.instance
    App()
}
