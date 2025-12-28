package com.small100onnx.test;

import android.os.Bundle;
import android.util.Log;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import java.io.File;
import java.util.*;

import com.small100onnx.Translator;

/**
 * Test Activity for Small100 ONNX Translator (Android)
 * 
 * Usage:
 * 1. Add this activity to your test app
 * 2. Ensure models are downloaded to app's files directory
 * 3. Run the app and test translations
 */
public class TranslatorTestActivity extends AppCompatActivity {
    private static final String TAG = "TranslatorTest";
    
    private EditText inputText;
    private Spinner srcLangSpinner;
    private Spinner tgtLangSpinner;
    private Button translateBtn;
    private TextView resultText;
    private TextView logText;
    private Translator translator;
    
    private final String[] languages = {"en", "vi", "ja", "ko", "zh", "fr", "de", "es"};
    private final String[] languageNames = {
        "English", "Vietnamese", "Japanese", "Korean", 
        "Chinese", "French", "German", "Spanish"
    };
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Create UI programmatically
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 32, 32, 32);
        
        // Title
        TextView title = new TextView(this);
        title.setText("Small100 Translator Test");
        title.setTextSize(24);
        title.setPadding(0, 0, 0, 32);
        layout.addView(title);
        
        // Input text
        inputText = new EditText(this);
        inputText.setHint("Enter text to translate...");
        inputText.setText("Xin chào, tôi là một trợ lý AI.");
        inputText.setMinLines(3);
        layout.addView(inputText);
        
        // Language row
        LinearLayout langRow = new LinearLayout(this);
        langRow.setOrientation(LinearLayout.HORIZONTAL);
        langRow.setPadding(0, 16, 0, 16);
        
        // Source language
        srcLangSpinner = new Spinner(this);
        ArrayAdapter<String> srcAdapter = new ArrayAdapter<>(this, 
            android.R.layout.simple_spinner_dropdown_item, languageNames);
        srcLangSpinner.setAdapter(srcAdapter);
        srcLangSpinner.setSelection(1); // Vietnamese
        langRow.addView(srcLangSpinner, new LinearLayout.LayoutParams(0, 
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        
        // Arrow
        TextView arrow = new TextView(this);
        arrow.setText(" → ");
        arrow.setTextSize(18);
        langRow.addView(arrow);
        
        // Target language
        tgtLangSpinner = new Spinner(this);
        ArrayAdapter<String> tgtAdapter = new ArrayAdapter<>(this, 
            android.R.layout.simple_spinner_dropdown_item, languageNames);
        tgtLangSpinner.setAdapter(tgtAdapter);
        tgtLangSpinner.setSelection(0); // English
        langRow.addView(tgtLangSpinner, new LinearLayout.LayoutParams(0, 
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        
        layout.addView(langRow);
        
        // Translate button
        translateBtn = new Button(this);
        translateBtn.setText("Translate");
        translateBtn.setEnabled(false);
        translateBtn.setOnClickListener(v -> runTranslation());
        layout.addView(translateBtn);
        
        // Result
        resultText = new TextView(this);
        resultText.setPadding(0, 16, 0, 16);
        resultText.setTextSize(18);
        layout.addView(resultText);
        
        // Quick tests
        TextView testLabel = new TextView(this);
        testLabel.setText("Quick Tests:");
        testLabel.setPadding(0, 16, 0, 8);
        layout.addView(testLabel);
        
        LinearLayout testRow = new LinearLayout(this);
        testRow.setOrientation(LinearLayout.HORIZONTAL);
        addTestButton(testRow, "VI→EN", "Xin chào", "vi", "en");
        addTestButton(testRow, "EN→VI", "Hello", "en", "vi");
        addTestButton(testRow, "JA→EN", "こんにちは", "ja", "en");
        layout.addView(testRow);
        
        // Log area
        TextView logLabel = new TextView(this);
        logLabel.setText("Log:");
        logLabel.setPadding(0, 16, 0, 8);
        layout.addView(logLabel);
        
        ScrollView scrollView = new ScrollView(this);
        logText = new TextView(this);
        logText.setTextSize(12);
        logText.setTypeface(android.graphics.Typeface.MONOSPACE);
        scrollView.addView(logText);
        layout.addView(scrollView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 300));
        
        setContentView(layout);
        
        // Initialize translator
        initializeTranslator();
    }
    
    private void addTestButton(LinearLayout parent, String label, String text, String src, String tgt) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setOnClickListener(v -> {
            inputText.setText(text);
            srcLangSpinner.setSelection(indexOf(languages, src));
            tgtLangSpinner.setSelection(indexOf(languages, tgt));
            runTranslation();
        });
        parent.addView(btn, new LinearLayout.LayoutParams(0, 
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    }
    
    private int indexOf(String[] arr, String val) {
        for (int i = 0; i < arr.length; i++) {
            if (arr[i].equals(val)) return i;
        }
        return 0;
    }
    
    private void log(String msg) {
        Log.d(TAG, msg);
        runOnUiThread(() -> {
            String current = logText.getText().toString();
            String timestamp = new java.text.SimpleDateFormat("HH:mm:ss", 
                java.util.Locale.getDefault()).format(new Date());
            logText.setText(current + "[" + timestamp + "] " + msg + "\n");
        });
    }
    
    private void initializeTranslator() {
        log("Initializing translator...");
        
        new Thread(() -> {
            try {
                File modelDir = new File(getFilesDir(), "models");
                
                if (!modelDir.exists() || !new File(modelDir, "encoder_int8.onnx").exists()) {
                    log("ERROR: Models not found in " + modelDir.getAbsolutePath());
                    log("Please download models first using ModelManager");
                    return;
                }
                
                translator = Translator.create(modelDir.getAbsolutePath());
                
                log("✓ Translator initialized successfully");
                log("Supported languages: " + translator.getSupportedLanguages().size());
                
                runOnUiThread(() -> {
                    translateBtn.setEnabled(true);
                    resultText.setText("Ready to translate!");
                });
                
            } catch (Exception e) {
                log("ERROR: " + e.getMessage());
                e.printStackTrace();
            }
        }).start();
    }
    
    private void runTranslation() {
        if (translator == null) {
            log("Translator not initialized");
            return;
        }
        
        String text = inputText.getText().toString().trim();
        if (text.isEmpty()) {
            log("Please enter text");
            return;
        }
        
        String srcLang = languages[srcLangSpinner.getSelectedItemPosition()];
        String tgtLang = languages[tgtLangSpinner.getSelectedItemPosition()];
        
        translateBtn.setEnabled(false);
        resultText.setText("Translating...");
        
        new Thread(() -> {
            try {
                long start = System.currentTimeMillis();
                log("Translating: \"" + text + "\" (" + srcLang + " → " + tgtLang + ")");
                
                String result = translator.translate(text, tgtLang);
                
                long elapsed = System.currentTimeMillis() - start;
                log("✓ Result: \"" + result + "\" (" + elapsed + "ms)");
                
                runOnUiThread(() -> {
                    resultText.setText(result + "\n\n(" + elapsed + "ms)");
                    translateBtn.setEnabled(true);
                });
                
            } catch (Exception e) {
                log("ERROR: " + e.getMessage());
                runOnUiThread(() -> {
                    resultText.setText("Error: " + e.getMessage());
                    translateBtn.setEnabled(true);
                });
            }
        }).start();
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (translator != null) {
            translator.close();
        }
    }
}
