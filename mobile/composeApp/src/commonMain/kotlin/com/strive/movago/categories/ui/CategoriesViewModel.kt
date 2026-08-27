package com.strive.movago.categories.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.strive.movago.categories.data.CategoriesRepository
import com.strive.movago.network.Response
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class CategoriesUiState {
    data object Loading : CategoriesUiState()

    data class Success(val categories: List<String>) : CategoriesUiState()

    data class Error(val message: String) : CategoriesUiState()
}

class CategoriesViewModel(private val repository: CategoriesRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<CategoriesUiState>(CategoriesUiState.Loading)
    val uiState: StateFlow<CategoriesUiState> = _uiState.asStateFlow()

    init {
        loadCategories()
    }

    private fun loadCategories() {
        viewModelScope.launch {
            _uiState.value = CategoriesUiState.Loading
            _uiState.value = when (val response = repository.getCategories()) {
                is Response.Success -> CategoriesUiState.Success(response.data.categories.map { it.name })
                is Response.HttpError -> CategoriesUiState.Error("HTTP error ${response.statusCode}")
                is Response.Error -> CategoriesUiState.Error(response.e.message ?: "Unknown error")
            }
        }
    }
}
