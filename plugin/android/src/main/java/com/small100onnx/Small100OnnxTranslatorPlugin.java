package com.small100onnx;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

/**
 * Capacitor Plugin for SMALL100 ONNX Translation
 */
@CapacitorPlugin(name = "Small100OnnxTranslator")
public class Small100OnnxTranslatorPlugin extends Plugin {
    private static final String TAG = "Small100Onnx";
    private static final String PREFS_NAME = "Small100OnnxPrefs";
    private static final String KEY_VERSION = "model_version";
    private static final String KEY_DOWNLOAD_TIME = "download_time";

    private ModelManager modelManager;
    private Translator translator;

    @Override
    public void load() {
        modelManager = new ModelManager(getContext());
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (modelManager.isModelsReady()) {
            initTranslator(call);
        } else {
            downloadModels(call);
        }
    }

    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ready", modelManager.isModelsReady() && translator != null);
        call.resolve(result);
    }

    @PluginMethod
    public void downloadModels(PluginCall call) {
        modelManager.downloadModels(new ModelManager.DownloadCallback() {
            @Override
            public void onProgress(int downloaded, int total) {
                JSObject data = new JSObject();
                data.put("downloaded", downloaded);
                data.put("total", total);
                notifyListeners("onDownloadProgress", data);
            }

            @Override
            public void onSuccess(String version) {
                saveModelInfo(version);
                initTranslator(call);
            }

            @Override
            public void onError(Exception error) {
                call.reject("Download failed: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void translate(PluginCall call) {
        String text = call.getString("text");
        String sourceLanguage = call.getString("sourceLanguage", "auto");
        String targetLanguage = call.getString("targetLanguage", "en");

        if (text == null || text.isEmpty()) {
            call.reject("Text is required");
            return;
        }

        if (translator == null || !translator.isReady()) {
            call.reject("Translator not initialized. Call initialize() first.");
            return;
        }

        // Run in background thread
        new Thread(() -> {
            try {
                String srcLang = sourceLanguage.equals("auto") ? "en" : sourceLanguage;
                String result = translator.translate(text, targetLanguage);

                JSObject response = new JSObject();
                response.put("translatedText", result);
                response.put("sourceLanguage", srcLang);
                response.put("targetLanguage", targetLanguage);

                getActivity().runOnUiThread(() -> call.resolve(response));
            } catch (Exception e) {
                Log.e(TAG, "Translation error", e);
                getActivity().runOnUiThread(() -> call.reject("Translation failed: " + e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void getModelInfo(PluginCall call) {
        call.resolve(buildModelInfo());
    }

    @PluginMethod
    public void clearModels(PluginCall call) {
        try {
            if (translator != null) {
                translator.close();
                translator = null;
            }
            
            File modelDir = modelManager.getModelsDirectory();
            if (modelDir.exists()) {
                deleteRecursive(modelDir);
            }
            clearStoredModelInfo();
            call.resolve();
        } catch (Exception e) {
            call.reject("Clear failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void debugInfo(PluginCall call) {
        JSObject result = new JSObject();
        try {
            if (translator != null) {
                TranslationEngine engine = translator.getEngine();
                result.put("encoderInputs", Arrays.toString(engine.getEncoderInputNames()));
                result.put("encoderOutputs", Arrays.toString(engine.getEncoderOutputNames()));
                result.put("decoderInputs", Arrays.toString(engine.getDecoderInputNames()));
                result.put("decoderOutputs", Arrays.toString(engine.getDecoderOutputNames()));
            }
        } catch (Exception e) {
            result.put("error", e.getMessage());
        }
        call.resolve(result);
    }

    // Private methods

    private void initTranslator(PluginCall call) {
        new Thread(() -> {
            try {
                translator = Translator.create(modelManager.getModelsDirectory());
                JSObject result = buildModelInfo();
                getActivity().runOnUiThread(() -> call.resolve(result));
            } catch (Exception e) {
                Log.e(TAG, "Init error", e);
                getActivity().runOnUiThread(() -> call.reject("Init failed: " + e.getMessage()));
            }
        }).start();
    }

    private JSObject buildModelInfo() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("version", prefs.getString(KEY_VERSION, ""));
        String downloadTime = prefs.getString(KEY_DOWNLOAD_TIME, "");
        if (!downloadTime.isEmpty()) {
            result.put("downloadedAt", downloadTime);
        }
        result.put("modelPath", modelManager.getModelsDirectory().getAbsolutePath());
        return result;
    }

    private void saveModelInfo(String version) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String timestamp = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date());
        prefs.edit()
            .putString(KEY_VERSION, version)
            .putString(KEY_DOWNLOAD_TIME, timestamp)
            .apply();
    }

    private void clearStoredModelInfo() {
        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove(KEY_VERSION).remove(KEY_DOWNLOAD_TIME).apply();
    }

    private boolean deleteRecursive(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursive(child);
            }
        }
        return file.delete();
    }

    @Override
    protected void handleOnDestroy() {
        if (modelManager != null) modelManager.shutdown();
        if (translator != null) translator.close();
        super.handleOnDestroy();
    }
}
