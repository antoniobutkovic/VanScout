package com.strive.movago.categories.data

import kotlinx.serialization.Serializable

@Serializable
data class CategoriesResponse(val categories: List<Category>)

@Serializable
data class Category(val id: Int, val name: String, val createdAt: String)
