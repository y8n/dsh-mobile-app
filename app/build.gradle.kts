plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "dev.dsh.mobile"
    compileSdk = 36
    defaultConfig {
        applicationId = "dev.dsh.mobile"
        minSdk = 26
        targetSdk = 36
        versionCode = 40
        versionName = "0.2.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        debug {
            buildConfigField("boolean", "DESIGN_PREVIEW", if (providers.gradleProperty("designPreview").orNull == "true") "true" else "false")
        }
        release {
            buildConfigField("boolean", "DESIGN_PREVIEW", "false")
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
}
dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:data"))
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    implementation(platform("androidx.compose:compose-bom:2025.04.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.navigation:navigation-compose:2.8.9")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.media3:media3-exoplayer:1.11.1")
    implementation("androidx.media3:media3-ui:1.11.1")
    implementation("com.caverock:androidsvg-aar:1.4")
    implementation("org.commonmark:commonmark:0.30.1")
    implementation("org.commonmark:commonmark-ext-gfm-tables:0.30.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation(platform("androidx.compose:compose-bom:2025.04.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.datastore:datastore-preferences:1.1.7")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("com.squareup.okhttp3:okhttp:4.12.0")
    androidTestImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    androidTestImplementation("com.squareup.okhttp3:okhttp-tls:4.12.0")
}

// License texts are readable ZIP assets in every future APK; no APK is built by this task.
val prepareLegalAssets by tasks.registering(Sync::class) {
    into(layout.buildDirectory.dir("generated/legal-assets/licenses"))
    from(rootProject.file("LICENSE"))
    from(rootProject.file("NOTICE"))
    from(rootProject.file("THIRD_PARTY_NOTICES.md"))
    from(rootProject.file("legal/ASSET-SOURCES.json"))
    from(rootProject.file("legal/dependencies/android-runtime.json"))
    from(rootProject.file("legal/dependencies/android-texts")) { into("dependencies") }
    from(rootProject.file("docs/licenses")) { into("third-party") }
}
android.sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/legal-assets"))
tasks.named("preBuild").configure { dependsOn(prepareLegalAssets) }
