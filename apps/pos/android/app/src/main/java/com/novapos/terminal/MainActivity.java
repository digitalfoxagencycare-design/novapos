package com.novapos.terminal;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NovaPrintPlugin.class);
        registerPlugin(NovaCheckoutPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
