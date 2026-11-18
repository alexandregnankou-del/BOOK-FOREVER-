package ci.adisen.bookforever;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * BOOK FOREVER — application Android, version 9.
 *
 * Écran d'ouverture maison, écran hors ligne avec bouton « Réessayer », sortie
 * confirmée par double appui, cookies persistants, téléchargements confiés au
 * gestionnaire système.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://book-forever.onrender.com/";
    private static final String HOME_HOST = "book-forever.onrender.com";
    private static final String OFFLINE_PAGE = "file:///android_asset/offline.html";
    private static final String UA_SUFFIX = " BookForeverApp/16.0";
    private static final String INK = "#14110E";
    private static final String GOLD = "#C9A227";

    private WebView webView;
    private ProgressBar spinner;
    private View splash;
    private long lastBackPress = 0L;
    private boolean pageReady = false;
    private LocalServer localServer;
    private String localUrl = null;
    private boolean fellBack = false;
    private int localPort = 0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.parseColor(INK));
            getWindow().setNavigationBarColor(Color.parseColor(INK));
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor(INK));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor(INK));
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        spinner = new ProgressBar(this);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        params.gravity = Gravity.CENTER;
        root.addView(spinner, params);

        splash = buildSplash();
        root.addView(splash, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + UA_SUFFIX);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new Bridge(), "BookForever");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl().toString());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                hideSplash();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int code, String description, String failingUrl) {
                showOffline();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                spinner.setVisibility(progress < 100 ? View.VISIBLE : View.GONE);
            }
        });

        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                try {
                    String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setTitle(name);
                    request.setDescription("Téléchargement BOOK FOREVER");
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                    DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (manager != null) manager.enqueue(request);
                    Toast.makeText(MainActivity.this,
                            "Téléchargement démarré — voir les notifications", Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                }
            }
        });

        /* Interface embarquée : serveur local sur 127.0.0.1, repli réseau si échec. */
        try {
            localServer = new LocalServer(getAssets());
            int port = localServer.start();
            localPort = port;
            localUrl = "http://127.0.0.1:" + port + "/";
            webView.loadUrl(localUrl);
            startWatchdog();
        } catch (Exception e) {
            fellBack = true;
            webView.loadUrl(START_URL);
        }
    }

    /** Si la page locale ne s'affiche pas en 8 s, on bascule sur le site distant. */
    private void startWatchdog() {
        webView.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!pageReady && !fellBack) {
                    fellBack = true;
                    webView.loadUrl(START_URL);
                }
            }
        }, 8000);
    }

    /** Écran d'ouverture : fond encre, monogramme doré, nom de la maison. */
    private View buildSplash() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.parseColor(INK));

        TextView mark = new TextView(this);
        mark.setText("A");
        mark.setTextSize(64);
        mark.setTextColor(Color.parseColor(GOLD));
        mark.setTypeface(Typeface.SERIF, Typeface.BOLD);
        mark.setGravity(Gravity.CENTER);
        box.addView(mark);

        TextView title = new TextView(this);
        title.setText("BOOK FOREVER");
        title.setTextSize(22);
        title.setLetterSpacing(0.18f);
        title.setTextColor(Color.parseColor("#F5EFE6"));
        title.setTypeface(Typeface.SERIF, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tp.topMargin = 18;
        box.addView(title, tp);

        TextView tag = new TextView(this);
        tag.setText("Lire · Rêver · Toujours");
        tag.setTextSize(11);
        tag.setLetterSpacing(0.3f);
        tag.setTextColor(Color.parseColor("#C4B8A4"));
        tag.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams gp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        gp.topMargin = 10;
        box.addView(tag, gp);

        box.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                hideSplash();
            }
        });
        return box;
    }

    private void hideSplash() {
        if (splash == null || splash.getVisibility() != View.VISIBLE) return;
        splash.animate().alpha(0f).setDuration(320).withEndAction(new Runnable() {
            @Override
            public void run() {
                splash.setVisibility(View.GONE);
            }
        });
    }

    private void showOffline() {
        if (webView.getUrl() != null && webView.getUrl().startsWith("file:")) return;
        webView.loadUrl(OFFLINE_PAGE);
        hideSplash();
    }

    /** Liens externes, e-mail, téléphone : hors du WebView. */
    private boolean handleUrl(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);

        // Lecture d'un chapitre : on bascule sur le lecteur natif.
        String path = uri.getPath() == null ? "" : uri.getPath();
        if (path.startsWith("/lire/")) {
            String[] segments = path.split("/");
            if (segments.length >= 4) {
                try {
                    int num = Integer.parseInt(segments[3]);
                    Intent intent = new Intent(this, ReaderActivity.class);
                    intent.putExtra("slug", segments[2]);
                    intent.putExtra("number", num);
                    intent.putExtra("port", localPort);
                    startActivity(intent);
                    return true;
                } catch (NumberFormatException ignored) {
                }
            }
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if ("http".equals(scheme) || "https".equals(scheme)) {
            String host = uri.getHost() == null ? "" : uri.getHost();
            if (host.equals("127.0.0.1") || host.equals("localhost")) return false;
            if (host.equals(HOME_HOST) || host.endsWith(".onrender.com")) return false;
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        }
        if ("mailto".equals(scheme) || "tel".equals(scheme) || "sms".equals(scheme)
                || "whatsapp".equals(scheme) || "intent".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
                // aucune application capable : on ne bloque pas la navigation
            }
            return true;
        }
        return false;
    }

    /** Pont minimal pour l'écran hors ligne et le partage. */
    private class Bridge {
        @JavascriptInterface
        public void retry() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    webView.loadUrl(START_URL);
                }
            });
        }

        @JavascriptInterface
        public void share(String title, String url) {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("text/plain");
            intent.putExtra(Intent.EXTRA_SUBJECT, title);
            intent.putExtra(Intent.EXTRA_TEXT, title + "\n" + url);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startActivity(Intent.createChooser(intent, "Partager"));
                }
            });
        }

        @JavascriptInterface
        public String version() {
            return "16.0";
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, android.view.KeyEvent event) {
        if (keyCode == android.view.KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        if (keyCode == android.view.KeyEvent.KEYCODE_BACK) {
            long now = System.currentTimeMillis();
            if (now - lastBackPress < 2000) return super.onKeyDown(keyCode, event);
            lastBackPress = now;
            Toast.makeText(this, "Appuyez encore pour quitter", Toast.LENGTH_SHORT).show();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String requested = intent.getStringExtra("open_url");
        if (requested != null) webView.loadUrl(requested);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        if (pageReady) hideSplash();
    }

    @Override
    protected void onDestroy() {
        CookieManager.getInstance().flush();
        if (localServer != null) localServer.stop();
        super.onDestroy();
    }
}
