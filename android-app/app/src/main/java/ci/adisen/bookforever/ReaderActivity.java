package ci.adisen.bookforever;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.RelativeSizeSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Lecteur natif : le texte du chapitre est affiché par Android, pas par une page
 * web. Défilement natif, typographie serif, taille et thème mémorisés, navigation
 * entre chapitres, enregistrement de la position.
 *
 * Les données viennent du serveur local de l'application, qui relaie vers le site
 * avec les cookies de session déjà présents dans le WebView.
 */
public class ReaderActivity extends Activity {

    private static final String PREFS = "bf.reader";
    private static final String INK = "#14110E";
    private static final String PAPER = "#F7F1E6";

    private int port;
    private String slug;
    private int number;
    private boolean night = false;
    private float size = 18f;
    private int totalChapters = 0;

    private LinearLayout root;
    private ScrollView scroller;
    private TextView body;
    private TextView chapterLabel;
    private ProgressBar spinner;
    private View paywall;
    private Button prevButton;
    private Button nextButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        slug = getIntent().getStringExtra("slug");
        number = getIntent().getIntExtra("number", 1);
        port = getIntent().getIntExtra("port", 0);

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        night = prefs.getBoolean("night", false);
        size = prefs.getFloat("size", 18f);

        buildUi();
        load();
    }

    private void buildUi() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(color(night ? "#14110E" : PAPER));

        /* Barre supérieure */
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(24, 32, 24, 12);
        bar.setBackgroundColor(color(night ? "#1C1814" : "#F1E8DA"));

        Button back = textButton("←", 20);
        back.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        bar.addView(back);

        chapterLabel = new TextView(this);
        chapterLabel.setTextColor(color(night ? "#E8DECB" : "#2B2318"));
        chapterLabel.setTypeface(Typeface.SERIF, Typeface.BOLD);
        chapterLabel.setTextSize(15);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp.leftMargin = 12;
        bar.addView(chapterLabel, lp);

        Button theme = textButton(night ? "☀" : "☾", 18);
        theme.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                night = !night;
                savePrefs();
                recreateUi();
            }
        });
        bar.addView(theme);
        root.addView(bar);

        spinner = new ProgressBar(this);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sp.gravity = Gravity.CENTER;
        sp.topMargin = 60;
        root.addView(spinner, sp);

        /* Zone de texte */
        scroller = new ScrollView(this);
        body = new TextView(this);
        body.setTextSize(size);
        body.setTextColor(color(night ? "#E8DECB" : "#2B2318"));
        body.setTypeface(Typeface.SERIF);
        body.setLineSpacing(size * 0.62f, 1f);
        body.setPadding(52, 34, 52, 40);
        scroller.addView(body);
        LinearLayout.LayoutParams scp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        root.addView(scroller, scp);

        /* Barre inférieure : taille et navigation */
        HorizontalScrollView footer = new HorizontalScrollView(this);
        footer.setBackgroundColor(color(night ? "#1C1814" : "#F1E8DA"));
        LinearLayout tools = new LinearLayout(this);
        tools.setOrientation(LinearLayout.HORIZONTAL);
        tools.setPadding(18, 14, 18, 26);
        tools.setGravity(Gravity.CENTER_VERTICAL);

        prevButton = textButton("‹ Chapitre", 14);
        prevButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openChapter(number - 1);
            }
        });
        tools.addView(prevButton);

        Button minus = textButton("A−", 15);
        minus.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                size = Math.max(15f, size - 1f);
                body.setTextSize(size);
                body.setLineSpacing(size * 0.62f, 1f);
                savePrefs();
            }
        });
        tools.addView(minus);

        Button plus = textButton("A+", 15);
        plus.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                size = Math.min(26f, size + 1f);
                body.setTextSize(size);
                body.setLineSpacing(size * 0.62f, 1f);
                savePrefs();
            }
        });
        tools.addView(plus);

        nextButton = textButton("Chapitre ›", 14);
        nextButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openChapter(number + 1);
            }
        });
        tools.addView(nextButton);

        footer.addView(tools);
        root.addView(footer);

        /* Volet de déblocage */
        paywall = buildPaywall();
        root.addView(paywall);

        setContentView(root);
    }

    private View buildPaywall() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(56, 40, 56, 40);
        box.setBackgroundColor(color(night ? "#1C1814" : "#F1E8DA"));
        box.setVisibility(View.GONE);

        TextView title = new TextView(this);
        title.setText("Chapitre verrouillé");
        title.setTypeface(Typeface.SERIF, Typeface.BOLD);
        title.setTextSize(22);
        title.setTextColor(color(night ? "#E8DECB" : "#2B2318"));
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        TextView hint = new TextView(this);
        hint.setText("Débloquez ce chapitre depuis l’application, par Wave ou Orange Money.");
        hint.setTextColor(color(night ? "#C4B8A4" : "#5A4F3F"));
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(0, 12, 0, 22);
        box.addView(hint);

        Button unlock = new Button(this);
        unlock.setText("Débloquer");
        unlock.setBackgroundColor(Color.parseColor("#C9A227"));
        unlock.setTextColor(Color.parseColor(INK));
        unlock.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                android.content.Intent intent = new android.content.Intent(
                        ReaderActivity.this, MainActivity.class);
                intent.putExtra("open_url",
                        "https://book-forever.onrender.com/lire/" + slug + "/" + number);
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(intent);
                finish();
            }
        });
        box.addView(unlock);
        return box;
    }

    private Button textButton(String label, int size) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextSize(size);
        button.setAllCaps(false);
        button.setTextColor(color(night ? "#E8DECB" : "#2B2318"));
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setPadding(20, 10, 20, 10);
        return button;
    }

    private void recreateUi() {
        int scroll = scroller.getScrollY();
        savePrefs();
        root.removeAllViews();
        buildUi();
        load();
        scroller.post(new Runnable() {
            @Override
            public void run() {
                scroller.scrollTo(0, scroll);
            }
        });
    }

    private void openChapter(int target) {
        if (target < 1) return;
        if (totalChapters > 0 && target > totalChapters) return;
        number = target;
        load();
    }

    private void savePrefs() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putBoolean("night", night)
                .putFloat("size", size)
                .apply();
    }

    /* ---------------- réseau ---------------- */

    private void load() {
        spinner.setVisibility(View.VISIBLE);
        paywall.setVisibility(View.GONE);
        scroller.setVisibility(View.GONE);
        chapterLabel.setText("Chargement…");

        new Thread(new Runnable() {
            @Override
            public void run() {
                final String payload = fetch("/api/books/" + slug + "/chapters/" + number);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        render(payload);
                    }
                });
            }
        }).start();
    }

    private void render(String payload) {
        spinner.setVisibility(View.GONE);
        if (payload == null) {
            chapterLabel.setText("Hors ligne");
            body.setText("Impossible de charger ce chapitre. Vérifiez votre connexion, ou "
                    + "revenez à la bibliothèque.");
            scroller.setVisibility(View.VISIBLE);
            return;
        }
        try {
            JSONObject json = new JSONObject(payload);
            if (json.has("error")) {
                showLocked();
                return;
            }
            JSONObject chapter = json.optJSONObject("chapter");
            JSONObject book = json.optJSONObject("book");
            if (chapter == null) {
                showLocked();
                return;
            }
            if (book != null && book.has("chaptersTotal")) {
                totalChapters = book.optInt("chaptersTotal", 0);
            }
            String title = chapter.optString("title", "");
            chapterLabel.setText(number + ". " + title);

            String text = chapter.optString("text", "");
            SpannableString styled = new SpannableString(text);
            body.setText(styled);

            scroller.setVisibility(View.VISIBLE);
            nextButton.setEnabled(totalChapters == 0 || number < totalChapters);
            prevButton.setEnabled(number > 1);
            saveProgress();
        } catch (Exception e) {
            body.setText("Chapitre illisible. Réessayez depuis la bibliothèque.");
            scroller.setVisibility(View.VISIBLE);
        }
    }

    private void showLocked() {
        spinner.setVisibility(View.GONE);
        scroller.setVisibility(View.GONE);
        chapterLabel.setText("Chapitre " + number);
        paywall.setVisibility(View.VISIBLE);
    }

    private String fetch(String path) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL("http://127.0.0.1:" + port + path);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(15000);
            String cookie = android.webkit.CookieManager.getInstance()
                    .getCookie("http://127.0.0.1:" + port + "/");
            if (cookie != null) conn.setRequestProperty("Cookie", cookie);
            int status = conn.getResponseCode();
            InputStream stream = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (stream == null) return null;
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int read;
            while ((read = stream.read(chunk)) != -1) buffer.write(chunk, 0, read);
            stream.close();
            return buffer.toString("UTF-8");
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void saveProgress() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    URL url = new URL("http://127.0.0.1:" + port + "/api/me/progress");
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(12000);
                    conn.setRequestProperty("Content-Type", "application/json");
                    String cookie = android.webkit.CookieManager.getInstance()
                            .getCookie("http://127.0.0.1:" + port + "/");
                    if (cookie != null) conn.setRequestProperty("Cookie", cookie);
                    String json = "{\"bookSlug\":\"" + slug + "\",\"chapterNumber\":" + number
                            + ",\"position\":0}";
                    OutputStream out = conn.getOutputStream();
                    out.write(json.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    out.close();
                    conn.getResponseCode();
                } catch (Exception ignored) {
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        }).start();
    }

    private int color(String hex) {
        return Color.parseColor(hex);
    }
}
