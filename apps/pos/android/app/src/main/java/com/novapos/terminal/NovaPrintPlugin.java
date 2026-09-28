package com.novapos.terminal;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Native ESC/POS Thermal Printing Plugin for 58mm / 80mm Bluetooth & System Printers.
 * Supports:
 * - Direct RFCOMM SPP Socket connection to Classic Bluetooth thermal printers (Ezo, TVS, Everycom, Z91, etc.)
 * - Paired device discovery by MAC Address
 * - Raw ESC/POS byte streaming
 * - Android system printing dialog fallback
 */
@CapacitorPlugin(name = "NovaPrint")
public class NovaPrintPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static BluetoothSocket activeSocket = null;
    private static String activeAddress = null;
    private static String activeName = null;
    private WebView printView;

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth is not supported on this device");
                return;
            }
            if (!adapter.isEnabled()) {
                call.reject("Bluetooth is turned off. Please turn on Bluetooth in Android Settings.");
                return;
            }

            Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
            JSArray devicesArray = new JSArray();
            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject devObj = new JSObject();
                    try {
                        devObj.put("name", device.getName() != null ? device.getName() : "Unknown Printer");
                    } catch (SecurityException se) {
                        devObj.put("name", "Paired Printer");
                    }
                    devObj.put("address", device.getAddress());
                    devicesArray.put(devObj);
                }
            }

            JSObject result = new JSObject();
            result.put("devices", devicesArray);
            call.resolve(result);
        } catch (SecurityException se) {
            call.reject("Bluetooth permission not granted: " + se.getMessage());
        } catch (Exception ex) {
            call.reject("Failed to list paired Bluetooth devices: " + ex.getMessage());
        }
    }

    @PluginMethod
    public void connectBluetooth(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            call.reject("Bluetooth MAC address is required");
            return;
        }

        new Thread(() -> {
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) {
                    call.reject("Bluetooth is unavailable or disabled");
                    return;
                }

                // Close existing connection if any
                closeActiveSocket();

                BluetoothDevice device = adapter.getRemoteDevice(address.trim());
                BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                
                // Cancel discovery before connecting to speed up connection
                try {
                    adapter.cancelDiscovery();
                } catch (SecurityException ignored) {}

                socket.connect();
                activeSocket = socket;
                activeAddress = address.trim();
                try {
                    activeName = device.getName() != null ? device.getName() : "Bluetooth Printer";
                } catch (SecurityException se) {
                    activeName = "Bluetooth Printer";
                }

                JSObject ret = new JSObject();
                ret.put("connected", true);
                ret.put("address", activeAddress);
                ret.put("name", activeName);
                call.resolve(ret);
            } catch (SecurityException se) {
                closeActiveSocket();
                call.reject("Bluetooth permission missing: " + se.getMessage());
            } catch (Exception ex) {
                closeActiveSocket();
                call.reject("Could not connect to printer (" + address + "): " + ex.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void disconnectBluetooth(PluginCall call) {
        closeActiveSocket();
        JSObject ret = new JSObject();
        ret.put("connected", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void isBluetoothConnected(PluginCall call) {
        boolean isConnected = activeSocket != null && activeSocket.isConnected();
        JSObject ret = new JSObject();
        ret.put("connected", isConnected);
        ret.put("address", isConnected ? activeAddress : null);
        ret.put("name", isConnected ? activeName : null);
        call.resolve(ret);
    }

    @PluginMethod
    public void printRawEscPos(PluginCall call) {
        String base64Data = call.getString("data");
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("ESC/POS print data is empty");
            return;
        }

        new Thread(() -> {
            try {
                if (activeSocket == null || !activeSocket.isConnected()) {
                    call.reject("Printer is not connected via Bluetooth SPP");
                    return;
                }

                byte[] rawBytes = Base64.decode(base64Data, Base64.DEFAULT);
                OutputStream out = activeSocket.getOutputStream();
                out.write(rawBytes);
                out.flush();

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("bytesPrinted", rawBytes.length);
                call.resolve(ret);
            } catch (Exception ex) {
                closeActiveSocket();
                call.reject("Printing failed: " + ex.getMessage());
            }
        }).start();
    }

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

    private static synchronized void closeActiveSocket() {
        if (activeSocket != null) {
            try {
                activeSocket.close();
            } catch (Exception ignored) {}
            activeSocket = null;
        }
        activeAddress = null;
        activeName = null;
    }
}
