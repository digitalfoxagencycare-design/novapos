package com.novapos.terminal;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Uses Android's print dialog so Cancel/Back returns to the receipt preview. */
@CapacitorPlugin(name = "NovaPrint")
public class NovaPrintPlugin extends Plugin {
    private WebView printView;

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.isEmpty()) {
            call.reject("Receipt is empty");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                printView = new WebView(getActivity());
                printView.getSettings().setJavaScriptEnabled(false);
                printView.setWebViewClient(new WebViewClient() {
                    private boolean opened = false;
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (opened) return;
                        opened = true;
                        try {
                            PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                            if (manager == null) { call.reject("Android printing is unavailable"); return; }
                            String title = call.getString("title", "NovaPOS receipt");
                            manager.print(title, view.createPrintDocumentAdapter(title), new PrintAttributes.Builder().build());
                            call.resolve();
                        } catch (Exception error) { call.reject("Cannot open Android printing", error); }
                    }
                });
                printView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception error) { call.reject("Cannot prepare receipt", error); }
        });
    }
}
