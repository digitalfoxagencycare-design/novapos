package com.novapos.terminal;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Native ESC/POS Thermal Printing Plugin for 58mm / 80mm Bluetooth & System Printers.
 * Supports:
 * - Direct RFCOMM SPP Socket connection to Classic Bluetooth thermal printers (Ezo, TVS, Everycom, Z91, etc.)
 * - Automatic Android 12+ (BLUETOOTH_CONNECT & BLUETOOTH_SCAN) runtime permission handling
 * - Paired device discovery by MAC Address
 * - Raw ESC/POS byte streaming
 * - Android system printing dialog fallback
 */
@CapacitorPlugin(name = "NovaPrint", permissions = {
    @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN })
})
public class NovaPrintPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private volatile BluetoothSocket activeSocket = null;
    private volatile String activeAddress = null;
    private volatile String activeName = null;
    private WebView printView;
    private final ExecutorService printerWorker = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService deadlines = Executors.newSingleThreadScheduledExecutor();
    private final AtomicInteger connectionVersion = new AtomicInteger();
    private volatile BluetoothSocket pendingSocket;

    private boolean bluetoothGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState("bluetooth") == PermissionState.GRANTED;
    }
    private boolean requireBluetooth(PluginCall call) {
        if (bluetoothGranted()) return true;
        call.reject("Allow Nearby devices permission before using the printer.", "BLUETOOTH_PERMISSION_DENIED");
        return false;
    }

    @PluginMethod
    public void requestBluetoothPermissions(PluginCall call) {
        if (bluetoothGranted()) { resolveBluetoothPermission(call); return; }
        getActivity().runOnUiThread(() -> requestPermissionForAlias("bluetooth", call, "bluetoothPermissionResult"));
    }

    @PermissionCallback
    private void bluetoothPermissionResult(PluginCall call) { resolveBluetoothPermission(call); }

    private void resolveBluetoothPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", bluetoothGranted());
        call.resolve(result);
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        try {
            if (!requireBluetooth(call)) return;

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth hardware is not available on this device");
                return;
            }
            if (!adapter.isEnabled()) {
                call.reject("Bluetooth is currently turned off. Please turn on Bluetooth in phone Settings.");
                return;
            }

            Set<BluetoothDevice> pairedDevices = adapter.getBondedDevices();
            JSArray devicesArray = new JSArray();
            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject devObj = new JSObject();
                    try {
                        String name = device.getName();
                        devObj.put("name", name != null && !name.isEmpty() ? name : "Thermal Printer");
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
        if (!requireBluetooth(call)) return;
        String address = call.getString("address");
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address.trim())) {
            call.reject("A valid Bluetooth MAC address is required"); return;
        }
        final int version = connectionVersion.incrementAndGet();
        closeSocket(pendingSocket);
        printerWorker.execute(() -> {
            BluetoothSocket socket = null;
            ScheduledFuture<?> timeout = null;
            AtomicBoolean finished = new AtomicBoolean(false);
            try {
                if (connectionVersion.get() != version) { call.reject("Connection cancelled"); return; }
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) { call.reject("Turn on Bluetooth in Android Settings."); return; }
                closeActiveSocket();
                BluetoothDevice device = adapter.getRemoteDevice(address.trim());
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                pendingSocket = socket;
                final BluetoothSocket connecting = socket;
                timeout = deadlines.schedule(() -> { if (!finished.get()) closeSocket(connecting); }, 15, TimeUnit.SECONDS);
                adapter.cancelDiscovery();
                socket.connect();
                finished.set(true);
                if (connectionVersion.get() != version) { closeSocket(socket); call.reject("Connection cancelled"); return; }
                activeSocket = socket;
                activeAddress = address.trim();
                activeName = device.getName() == null ? "Bluetooth Printer" : device.getName();
                JSObject result = new JSObject();
                result.put("connected", true); result.put("address", activeAddress); result.put("name", activeName);
                call.resolve(result);
            } catch (Exception error) {
                closeSocket(socket);
                closeActiveSocket();
                call.reject("Printer connection failed or timed out. Check power, pairing and Nearby devices permission.", error);
            } finally {
                finished.set(true);
                if (timeout != null) timeout.cancel(false);
                pendingSocket = null;
            }
        });
    }

    @PluginMethod
    public void disconnectBluetooth(PluginCall call) {
        connectionVersion.incrementAndGet();
        closeSocket(pendingSocket);
        closeActiveSocket();
        JSObject result = new JSObject(); result.put("connected", false); call.resolve(result);
    }

    @PluginMethod
    public void isBluetoothConnected(PluginCall call) {
        BluetoothSocket socket = activeSocket;
        boolean connected = bluetoothGranted() && socket != null && socket.isConnected();
        JSObject result = new JSObject();
        result.put("connected", connected);
        result.put("address", connected ? activeAddress : null);
        result.put("name", connected ? activeName : null);
        call.resolve(result);
    }

    @PluginMethod
    public void printRawEscPos(PluginCall call) {
        if (!requireBluetooth(call)) return;
        String data = call.getString("data");
        if (data == null || data.isEmpty() || data.length() > 2_000_000) { call.reject("Invalid or oversized receipt"); return; }
        final BluetoothSocket target = activeSocket;
        printerWorker.execute(() -> {
            ScheduledFuture<?> timeout = null;
            AtomicBoolean finished = new AtomicBoolean(false);
            try {
                if (target == null || target != activeSocket || !target.isConnected()) { call.reject("Printer is disconnected"); return; }
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                if (bytes.length == 0) { call.reject("Receipt is empty"); return; }
                timeout = deadlines.schedule(() -> { if (!finished.get()) closeSocket(target); }, 30, TimeUnit.SECONDS);
                OutputStream output = target.getOutputStream();
                for (int offset = 0; offset < bytes.length; offset += 256) {
                    output.write(bytes, offset, Math.min(256, bytes.length - offset));
                    output.flush();
                    if (offset + 256 < bytes.length) Thread.sleep(10);
                }
                finished.set(true);
                JSObject result = new JSObject(); result.put("success", true);
                // Socket delivery is not a physical paper/status acknowledgement.
                result.put("bytesPrinted", bytes.length); call.resolve(result);
            } catch (Exception error) {
                closeSocket(target);
                if (activeSocket == target) closeActiveSocket();
                call.reject("Print failed or timed out; some paper may already have printed. Check before reprinting.", error);
            } finally {
                finished.set(true);
                if (timeout != null) timeout.cancel(false);
            }
        });
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
                printView.getSettings().setAllowFileAccess(false);
                printView.getSettings().setAllowContentAccess(false);
                printView.getSettings().setBlockNetworkLoads(true);
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

    private synchronized void closeActiveSocket() {
        if (activeSocket != null) {
            try {
                activeSocket.close();
            } catch (Exception ignored) {}
            activeSocket = null;
        }
        activeAddress = null;
        activeName = null;
    }
    private static void closeSocket(BluetoothSocket socket) {
        if (socket != null) try { socket.close(); } catch (Exception ignored) {}
    }

    @Override
    protected void handleOnDestroy() {
        connectionVersion.incrementAndGet();
        closeSocket(pendingSocket);
        closeActiveSocket();
        printerWorker.shutdownNow(); deadlines.shutdownNow();
        if (printView != null) getActivity().runOnUiThread(() -> { printView.destroy(); printView = null; });
        super.handleOnDestroy();
    }

}
