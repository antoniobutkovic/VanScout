# Architecture Rules

This project uses a small feature-based architecture in `composeApp/src/commonMain/kotlin/com/strive/movago`.

The goal is consistency:

- every feature has the same folder shape
- dependencies point in one direction
- UI stays dumb
- networking stays behind services and repositories
- dependency wiring stays in `AppComponent`

## Feature Structure

Each feature should live in its own package:

```text
com.strive.movago.<feature>/
  data/
  ui/
```

Use this structure:

```text
<feature>/
  data/
    <Feature>Service.kt
    <Feature>Repository.kt
    <Feature>Models.kt
  ui/
    <Feature>Screen.kt
    <Feature>ViewModel.kt
```

Rules:

- Put feature-specific network models and DTOs in `data/`.
- Put composables, UI state, and the view model in `ui/`.
- Keep platform-specific code out of feature packages unless it is truly platform-specific.

## Layer Responsibilities

### `Screen`

- Renders the UI from state only.
- Obtains the view model through `getAppComponent()`.
- Collects state with `collectAsStateWithLifecycle()`.
- Does not call services or repositories directly.
- Does not contain networking or parsing logic.

### `ViewModel`

- Owns `MutableStateFlow` internally and exposes `StateFlow`.
- Defines a sealed UI state for loading, success, and error cases.
- Starts loading data from `init` when the screen needs data immediately.
- Launches work in `viewModelScope`.
- Converts `Response` values into UI state.
- Can do small UI-facing mapping needed by the screen.

### `Repository`

- Is the view model's data entry point.
- Hides the service implementation from the UI layer.
- Delegates to the service when the feature is simple.
- Can grow later to handle caching, aggregation, or data composition if needed.

### `Service`

- Is the only layer that talks to `HttpClient`.
- Wraps HTTP calls with `safeResponse`.
- Returns `Response<T>`.
- Contains endpoint details and request setup.

## Dependency Direction

Keep dependencies one-way:

```text
Screen -> ViewModel -> Repository -> Service -> HttpClient
```

Rules:

- Never inject a service into a screen.
- Never inject `HttpClient` into a view model.
- Never make the UI layer aware of transport details such as status parsing or endpoint paths.

## Naming Rules

Use consistent feature-based names:

- `<Feature>Screen`
- `<Feature>ViewModel`
- `<Feature>UiState`
- `<Feature>Repository`
- `<Feature>RepositoryImpl`
- `<Feature>Service`
- `<Feature>ServiceImpl`

If a feature has request or response models, keep the names explicit:

- `<Feature>Response`
- `<Feature>Request`
- `<Entity>`

## Dependency Injection Rules

All shared wiring belongs in [composeApp/src/commonMain/kotlin/com/strive/movago/di/AppComponent.kt](/Users/antonio/AndroidStudioProjects/Movago/mobile/composeApp/src/commonMain/kotlin/com/strive/movago/di/AppComponent.kt).

Rules:

- Expose the feature view model as a property on `AppComponent`.
- Provide the service and repository through `@Provides` functions.
- Scope shared infrastructure such as `HttpClient`, services, and repositories with `@AppScope`.
- Construct the view model in `AppComponent` from the repository.

Expected pattern:

```kotlin
interface AppComponent {
    val featureViewModel: FeatureViewModel

    @AppScope
    @Provides
    fun provideFeatureService(httpClient: HttpClient): FeatureService =
        FeatureServiceImpl(httpClient)

    @AppScope
    @Provides
    fun provideFeatureRepository(service: FeatureService): FeatureRepository =
        FeatureRepositoryImpl(service)

    @Provides
    fun provideFeatureViewModel(repository: FeatureRepository): FeatureViewModel =
        FeatureViewModel(repository)
}
```

## State Rules

Every screen that loads remote data should model state explicitly.

Preferred shape:

```kotlin
sealed class FeatureUiState {
    data object Loading : FeatureUiState()
    data class Success(val data: List<String>) : FeatureUiState()
    data class Error(val message: String) : FeatureUiState()
}
```

Rules:

- Always handle loading, success, and error.
- Keep error state user-readable.
- Expose immutable state to the UI.

## Network Rules

Shared network result handling lives in [composeApp/src/commonMain/kotlin/com/strive/movago/network/Response.kt](/Users/antonio/AndroidStudioProjects/Movago/mobile/composeApp/src/commonMain/kotlin/com/strive/movago/network/Response.kt).

Rules:

- Feature services should return `Response<T>`.
- Wrap requests in `safeResponse { ... }`.
- Keep raw endpoint strings inside the service layer.
- Do not let screens or composables branch on transport exceptions directly.

Expected service pattern:

```kotlin
interface FeatureService {
    suspend fun getFeature(): Response<FeatureResponse>
}

class FeatureServiceImpl(private val httpClient: HttpClient) : FeatureService {
    override suspend fun getFeature(): Response<FeatureResponse> = safeResponse {
        httpClient.get("api/feature")
    }
}
```

## Compose Rules

Rules for screens:

- Resolve the view model with `viewModel { getAppComponent().featureViewModel }`.
- Observe state with `collectAsStateWithLifecycle()`.
- Render each branch of the UI state in a `when`.
- Keep composables focused on presentation.

## What To Avoid

- No feature should skip the repository and call the service from the view model.
- No composable should own networking code.
- Do not spread one feature across unrelated packages.
- Do not put dependency wiring inside screens or view models.
- Do not create a domain layer unless there is a real need for it in this project.

## Template For New Features

When adding a new feature, build it in this order:

1. Create the feature package with `data/` and `ui/`.
2. Add request/response models in `data/` if the API needs them.
3. Add `<Feature>Service` and `<Feature>ServiceImpl`.
4. Add `<Feature>Repository` and `<Feature>RepositoryImpl`.
5. Add `<Feature>UiState` and `<Feature>ViewModel`.
6. Add `<Feature>Screen`.
7. Wire the feature into `AppComponent`.
8. Hook the screen into navigation.

Following this structure keeps all features predictable and aligned with the current project architecture.
