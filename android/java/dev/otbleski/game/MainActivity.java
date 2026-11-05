package dev.otbleski.game;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Одна Activity вокруг WebView. Игра целиком лежит в assets/web и отдаётся
 * с виртуального адреса https://otbleski.local — так работают ES-модули
 * и service worker, которых на file:// не бывает.
 */
public class MainActivity extends Activity {

    private static final String ORIGIN = "https://otbleski.local";

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            w.setStatusBarColor(Color.parseColor("#0B0D11"));
            w.setNavigationBarColor(Color.parseColor("#0B0D11"));
        }
        // Края экрана: игра сама уважает safe-area, поэтому выводим под статус-бар.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            w.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        goFullscreen();

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0D11"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage — сохранение партии
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);                    // системный масштаб шрифта не ломает вёрстку
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        web.setWebViewClient(new LocalClient());
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);

        if (state == null) web.loadUrl(ORIGIN + "/index.html");
        else web.restoreState(state);
    }

    private void goFullscreen() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    /** Отдаём файлы из assets/web и притворяемся обычным https-сайтом. */
    private class LocalClient extends WebViewClient {

        private final Map<String, String> mime = new HashMap<>();

        LocalClient() {
            mime.put("html", "text/html");
            mime.put("js", "text/javascript");
            mime.put("css", "text/css");
            mime.put("json", "application/json");
            mime.put("webmanifest", "application/manifest+json");
            mime.put("svg", "image/svg+xml");
            mime.put("png", "image/png");
            mime.put("woff2", "font/woff2");
            mime.put("ico", "image/x-icon");
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (u == null || !ORIGIN.equals(u.getScheme() + "://" + u.getHost())) return null;
            String path = u.getPath();
            if (path == null || path.equals("/")) path = "/index.html";
            if (path.startsWith("/")) path = path.substring(1);

            try {
                InputStream in = getAssets().open("web/" + path);
                String ext = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : "html";
                String type = mime.containsKey(ext) ? mime.get(ext) : "application/octet-stream";
                String enc = type.startsWith("text/") || type.contains("json") || type.contains("svg")
                        ? "utf-8" : null;
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-cache");
                return new WebResourceResponse(type, enc, 200, "OK", headers, in);
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "utf-8",
                        404, "Not Found", new HashMap<String, String>(),
                        new ByteArrayInputStream("not found".getBytes()));
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (u != null && ORIGIN.equals(u.getScheme() + "://" + u.getHost())) return false;
            // Всё внешнее — в браузер, а не внутрь игры.
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
            return true;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        // Игра одностраничная: «назад» не должно выкидывать из партии случайно.
        moveTaskToBack(true);
    }
}
