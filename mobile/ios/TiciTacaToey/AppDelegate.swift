import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

// Built against the iOS 26+ SDK, which **requires** the UIScene life
// cycle: an app that still creates its window in
// `didFinishLaunchingWithOptions` does not merely warn, it fails to
// launch outright -
//   "Application failed to launch: UIScene life cycle is required for
//    apps built with this SDK"
// - which is exactly what this app did the first time anyone ran it.
// React Native 0.86 had no scene support, so the adoption was written
// here by hand. Since 0.88 it has: `startReactNative(...connectionOptions:)`
// and `RCTLinkingManager.scene(...)`. Those are not optional niceties -
// in a scene app 0.88 turns the older `RCTLinkingManager.application(...)`
// calls into silent no-ops, so links only arrive through the scene ones.
//
// SceneDelegate lives in this file on purpose: a second Swift file would
// have to be registered in project.pbxproj by hand, and hand-editing that
// is a good way to produce a project that opens fine and builds wrong.

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  static var shared: AppDelegate {
    // Safe: UIKit guarantees the app delegate exists before any scene
    // connects, and this is only reached from the scene callbacks.
    UIApplication.shared.delegate as! AppDelegate
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Build React Native here, but do **not** make a window - under the
    // scene life cycle the window belongs to the scene, and creating one
    // here would leave an orphan behind the real one.
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
}

// Terminal near-black behind everything, so a bundle load never flashes
// white (keep in sync with C.bg in src/theme.ts).
private let terminalBackground = UIColor(
  red: 5.0 / 255.0, green: 9.0 / 255.0, blue: 5.0 / 255.0, alpha: 1
)

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }
    let window = UIWindow(windowScene: windowScene)
    self.window = window

    // Passing the connection options is what carries a cold-start link:
    // React Native turns the URL or user activity in them into the launch
    // options `Linking.getInitialURL()` reads, and missing it is why a
    // link-launched app would open on the lobby instead of the game.
    // `openGameLink` in src/state.ts queues it until the socket registers.
    AppDelegate.shared.reactNativeFactory?.startReactNative(
      withModuleName: "TiciTacaToey",
      in: window,
      connectionOptions: connectionOptions
    )

    window.backgroundColor = terminalBackground
    window.rootViewController?.view.backgroundColor = terminalBackground
  }

  // ticitacatoey:// game links, arriving while the app is already up.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
  }

  // Universal links (https://ticitacatoey.com/play/...), which need the
  // Associated Domains entitlement and the AASA file at
  // web/public/.well-known/ to actually arrive.
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
