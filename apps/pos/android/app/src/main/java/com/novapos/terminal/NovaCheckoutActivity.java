package com.novapos.terminal;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import com.razorpay.Checkout;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;
import org.json.JSONObject;

/** Isolates the payment SDK lifecycle from the Capacitor WebView. */
public class NovaCheckoutActivity extends Activity implements PaymentResultWithDataListener {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) return;
        try {
            JSONObject options = new JSONObject(getIntent().getStringExtra("options"));
            Checkout checkout = new Checkout();
            checkout.setKeyID(options.getString("key"));
            checkout.open(this, options);
        } catch (Exception error) {
            fail("Unable to start payment. Please retry.");
        }
    }

    @Override
    public void onPaymentSuccess(String paymentId, PaymentData data) {
        if (data == null || data.getOrderId() == null || data.getSignature() == null) {
            fail("Payment confirmation is pending. Refresh your license before paying again."); return;
        }
        Intent result = new Intent();
        result.putExtra("paymentId", paymentId);
        result.putExtra("orderId", data.getOrderId());
        result.putExtra("signature", data.getSignature());
        setResult(RESULT_OK, result);
        finish();
    }

    @Override
    public void onPaymentError(int code, String message, PaymentData data) {
        fail("Payment did not complete (" + code + "). Refresh license status if debited, or try another method.");
    }

    private void fail(String message) {
        Intent result = new Intent();
        result.putExtra("error", message);
        setResult(RESULT_CANCELED, result);
        finish();
    }
}
