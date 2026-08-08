// Capacitor Configuration for ZHIROX Debt System (Native Application Readiness)
export const config = {
  appId: 'com.zhirox.debt',
  appName: 'ZHIROX',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000'
    }
  }
};

export default config;
