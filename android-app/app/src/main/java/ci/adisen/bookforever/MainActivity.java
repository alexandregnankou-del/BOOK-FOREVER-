package ci.adisen.bookforever;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

/**
 * BOOK FOREVER — application Android, version 8.
 *
 * Coque native autour de la plateforme : la bibliothèque, le lecteur, les achats
 * et la console sont servis par le site, donc l'application suit automatiquement
 * les mises à jour du site.
 *
 * Nouveautés v8 : téléchargement des fichiers (APK, archive) géré par le
 * gestionnaire système, barre de progression pendant le chargement, reprise
 * propre après mise en veille.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "https://book-forever.onrender.com/";
    private static final String HOME_HOST = "book-forever.onrender.com";
    private static final String OFFLINE_PAGE = "file:///android_asset/offline.html";
    private static final String UA_SUFFIX = " BookForeverApp/8.0";

    private WebView webView;
    private ProgressBar spinner;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.parseColor("#14110E"));
            getWindow().setNavigationBarColor(Color.parseColor("#14110E"));
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#14110E"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#14110E"));
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        spinner = new ProgressBar(this);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        params.gravity = android.view.Gravity.CENTER;
        root.addView(spinner, params);
        setContentView(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + UA_SUFFIX);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (spinner == null) return;
                if (newProgress >= 85) {
                    spinner.setVisibility(View.GONE);
                } else {
                    spinner.setVisibility(View.VISIBLE);
                }
            }
        });

        /* Téléchargements : le WebView ne sait pas enregistrer un fichier.
           On confie le .apk ou l'archive au gestionnaire du système. */
        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimetype, long contentLength) {
                try {
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimetype);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setTitle(fileName);
                    request.setDescription("BOOK FOREVER");
                    request.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                    }
                    DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (manager != null) {
                        manager.enqueue(request);
                        Toast.makeText(MainActivity.this, "Téléchargement démarré : " + fileName,
                                Toast.LENGTH_LONG).show();
                    } else {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    }
                } catch (Exception e) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception ignored) {
                        Toast.makeText(MainActivity.this, "Téléchargement impossible",
                                Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (spinner != null) spinner.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (spinner != null) spinner.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (spinner != null) spinner.setVisibility(View.GONE);
                if (request.isForMainFrame()) {
                    view.loadUrl(OFFLINE_PAGE);
                }
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (spinner != null) spinner.setVisibility(View.GONE);
                view.loadUrl(OFFLINE_PAGE);
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    /** Les liens internes restent dans l'application, le reste part au navigateur. */
    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        String host = uri.getHost() == null ? "" : uri.getHost();

        if (host.equals(HOME_HOST) || host.endsWith(".onrender.com")) {
            return false;
        }
        if (scheme.startsWith("http")) {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        }
        if ("mailto".equals(scheme) || "tel".equals(scheme) || "whatsapp".equals(scheme)
                || "sms".equals(scheme) || "intent".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
            }
            return true;
        }
        return false;
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
        }
        super.onDestroy();
    }
}
