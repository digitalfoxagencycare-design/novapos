package com.novapos.terminal;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NovaCheckout")
public class NovaCheckoutPlugin extends Plugin {
    private boolean opening = false;

    @PluginMethod
    public void open(PluginCall call) {
        if (opening) { call.reject("Checkout is already open."); return; }
        if (call.getString("order_id") == null || call.getString("key") == null) {
            call.reject("A server-created order is required."); return;
        }
        opening = true;
        try {
            Intent intent = new Intent(getActivity(), NovaCheckoutActivity.class);
            intent.putExtra("options", call.getData().toString());
            startActivityForResult(call, intent, "checkoutResult");
        } catch (Exception error) {
            opening = false;
            call.reject("Could not open payment gateway.", error);
        }
    }

    @ActivityCallback
    private void checkoutResult(PluginCall call, ActivityResult result) {
        opening = false;
        // Process death is recovered by the signed webhook and next status refresh.
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK && data != null) {
            JSObject response = new JSObject();
            response.put("razorpay_payment_id", data.getStringExtra("paymentId"));
            response.put("razorpay_order_id", data.getStringExtra("orderId"));
            response.put("razorpay_signature", data.getStringExtra("signature"));
            call.resolve(response);
        } else {
            call.reject(data == null ? "Checkout closed. Refresh license status if debited." : data.getStringExtra("error"));
        }
    }
}
