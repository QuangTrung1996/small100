package com.small100onnx;

import android.content.Context;
import android.os.Environment;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ModelManager {
    private static final String HUGGINGFACE_BASE = "https://huggingface.co/lyphanthuc/small100-onnx/resolve/main";
    private static final String MODEL_DIR = "Small100Models";
    private static final String VERSION_FILE = "version.txt";
    
    private Context context;
    private ExecutorService executorService;
    
    private static final String[] MODEL_FILES = {
        "added_tokens.json",
        "decoder_int8.onnx",
        "encoder_int8.onnx",
        "sentencepiece.bpe.model",
        "special_tokens_map.json",
        "tokenizer_config.json",
        "vocab.json"
    };
    
    public ModelManager(Context context) {
        this.context = context;
        this.executorService = Executors.newSingleThreadExecutor();
    }
    
    public File getModelsDirectory() {
        File dir = new File(context.getFilesDir(), MODEL_DIR);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }
    
    public boolean isModelsReady() {
        File modelDir = getModelsDirectory();
        for (String file : MODEL_FILES) {
            if (!new File(modelDir, file).exists()) {
                return false;
            }
        }
        return true;
    }
    
    public void downloadModels(DownloadCallback callback) {
        executorService.execute(() -> {
            try {
                // Fetch version
                String version = fetchVersion();
                String versionDir = String.format("%s/%s", HUGGINGFACE_BASE, version);
                
                File modelDir = getModelsDirectory();
                int totalFiles = MODEL_FILES.length;
                int downloadedFiles = 0;
                
                for (String file : MODEL_FILES) {
                    String url = String.format("%s/%s", versionDir, file);
                    File targetFile = new File(modelDir, file);
                    
                    downloadFile(url, targetFile);
                    downloadedFiles++;
                    
                    if (callback != null) {
                        callback.onProgress(downloadedFiles, totalFiles);
                    }
                }
                
                if (callback != null) {
                    callback.onSuccess(version);
                }
            } catch (Exception e) {
                if (callback != null) {
                    callback.onError(e);
                }
            }
        });
    }
    
    private String fetchVersion() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(
            String.format("%s/version.txt", HUGGINGFACE_BASE)
        ).openConnection();
        
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new Exception("Failed to fetch version: " + connection.getResponseCode());
            }
            
            InputStream inputStream = connection.getInputStream();
            byte[] buffer = new byte[1024];
            StringBuilder result = new StringBuilder();
            int bytesRead;
            
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                result.append(new String(buffer, 0, bytesRead));
            }
            
            return result.toString().trim();
        } finally {
            connection.disconnect();
        }
    }
    
    private void downloadFile(String fileUrl, File targetFile) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(fileUrl).openConnection();
        
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new Exception("Failed to download: " + fileUrl);
            }
            
            InputStream inputStream = connection.getInputStream();
            FileOutputStream outputStream = new FileOutputStream(targetFile);
            byte[] buffer = new byte[8192];
            int bytesRead;
            
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                outputStream.write(buffer, 0, bytesRead);
            }
            
            outputStream.close();
            inputStream.close();
        } finally {
            connection.disconnect();
        }
    }
    
    public interface DownloadCallback {
        void onProgress(int downloaded, int total);
        void onSuccess(String version);
        void onError(Exception error);
    }
    
    public void shutdown() {
        if (executorService != null) {
            executorService.shutdown();
        }
    }
}
