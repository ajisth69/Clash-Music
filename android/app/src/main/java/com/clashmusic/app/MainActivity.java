package com.clashmusic.app;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.Manifest;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    public static JSObject pendingAudioIntent = null;

    @CapacitorPlugin(name = "PublicDownloads")
    public static class PublicDownloadsPlugin extends Plugin {
        @PluginMethod
        public void saveToPublicDownloads(PluginCall call) {
            String fileName = call.getString("fileName");
            String base64Data = call.getString("base64Data");
            String mimeType = call.getString("mimeType", "audio/mpeg");

            if (fileName == null || base64Data == null) {
                call.reject("Missing fileName or base64Data");
                return;
            }

            try {
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        OutputStream out = getContext().getContentResolver().openOutputStream(uri);
                        if (out != null) {
                            out.write(fileBytes);
                            out.close();
                        }
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("uri", uri.toString());
                        call.resolve(ret);
                        return;
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File file = new File(downloadsDir, fileName);
                    FileOutputStream out = new FileOutputStream(file);
                    out.write(fileBytes);
                    out.close();

                    android.media.MediaScannerConnection.scanFile(
                        getContext(),
                        new String[]{file.getAbsolutePath()},
                        new String[]{mimeType},
                        null
                    );

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("path", file.getAbsolutePath());
                    call.resolve(ret);
                    return;
                }
            } catch (Exception e) {
                call.reject("Failed to save file to system Downloads: " + e.getMessage());
                return;
            }
            call.reject("Could not create download entry");
        }
    }

    @CapacitorPlugin(
        name = "LocalAudioScanner",
        permissions = {
            @Permission(
                alias = "audio",
                strings = {
                    Manifest.permission.READ_MEDIA_AUDIO,
                    Manifest.permission.READ_EXTERNAL_STORAGE
                }
            )
        }
    )
    public static class LocalAudioScannerPlugin extends Plugin {
        public static LocalAudioScannerPlugin instance = null;

        @Override
        public void load() {
            instance = this;
            if (pendingAudioIntent != null) {
                notifyAudioIntent(pendingAudioIntent);
            }
        }

        public void notifyAudioIntent(JSObject song) {
            notifyListeners("onAudioIntentReceived", song);
        }

        @PluginMethod
        public void requestAudioPermission(PluginCall call) {
            if (getPermissionState("audio") != PermissionState.GRANTED) {
                requestPermissionForAlias("audio", call, "audioPermissionCallback");
            } else {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                call.resolve(ret);
            }
        }

        @PermissionCallback
        private void audioPermissionCallback(PluginCall call) {
            boolean granted = getPermissionState("audio") == PermissionState.GRANTED;
            JSObject ret = new JSObject();
            ret.put("granted", granted);
            call.resolve(ret);
        }

        @PluginMethod
        public void getPendingAudioIntent(PluginCall call) {
            JSObject ret = new JSObject();
            if (pendingAudioIntent != null) {
                ret.put("song", pendingAudioIntent);
                pendingAudioIntent = null;
            } else {
                ret.put("song", null);
            }
            call.resolve(ret);
        }

        @PluginMethod
        public void scanDeviceAudio(PluginCall call) {
            if (getPermissionState("audio") != PermissionState.GRANTED) {
                requestPermissionForAlias("audio", call, "scanPermissionCallback");
                return;
            }
            performScan(call);
        }

        @PermissionCallback
        private void scanPermissionCallback(PluginCall call) {
            if (getPermissionState("audio") == PermissionState.GRANTED) {
                performScan(call);
            } else {
                call.reject("Permission denied to access audio files");
            }
        }

        private void performScan(PluginCall call) {
            JSArray tracks = new JSArray();
            ContentResolver resolver = getContext().getContentResolver();
            Uri audioUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;

            String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.ALBUM_ID,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.MIME_TYPE,
                "relative_path"
            };

            // Scan ALL audio files (including opus files where IS_MUSIC or duration is not indexed yet)
            String selection = MediaStore.Audio.Media.SIZE + " > 0";
            String sortOrder = MediaStore.Audio.Media.TITLE + " ASC";

            try (Cursor cursor = resolver.query(audioUri, projection, selection, null, sortOrder)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                    int titleCol = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                    int artistCol = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                    int albumCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                    int albumIdCol = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID);
                    int durationCol = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
                    int dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA);
                    int sizeCol = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE);
                    int mimeCol = cursor.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE);
                    int relPathCol = cursor.getColumnIndex("relative_path");

                    do {
                        long id = cursor.getLong(idCol);
                        String title = titleCol != -1 ? cursor.getString(titleCol) : null;
                        String artist = artistCol != -1 ? cursor.getString(artistCol) : null;
                        String album = albumCol != -1 ? cursor.getString(albumCol) : null;
                        long albumId = albumIdCol != -1 ? cursor.getLong(albumIdCol) : -1;
                        long durationMs = durationCol != -1 ? cursor.getLong(durationCol) : 0;
                        String dataPath = dataCol != -1 ? cursor.getString(dataCol) : null;
                        long sizeBytes = sizeCol != -1 ? cursor.getLong(sizeCol) : 0;
                        String mimeType = mimeCol != -1 ? cursor.getString(mimeCol) : null;
                        String relPath = relPathCol != -1 ? cursor.getString(relPathCol) : null;

                        Uri trackContentUri = ContentUris.withAppendedId(audioUri, id);
                        
                        // Build album art URI using the proper content:// scheme
                        Uri albumArtUri = null;
                        if (albumId != -1) {
                            albumArtUri = ContentUris.withAppendedId(
                                Uri.parse("content://media/external/audio/albumart"), albumId);
                        }

                        String fileTitle = title;
                        if (fileTitle == null || fileTitle.isEmpty()) {
                            if (dataPath != null) {
                                fileTitle = new File(dataPath).getName().replaceAll("\\.[^/.]+$", "");
                            } else {
                                fileTitle = "Track " + id;
                            }
                        }

                        String folderName = "Phone Storage";
                        if (relPath != null && !relPath.isEmpty()) {
                            // Use relative path for folder name (Android 10+)
                            String[] parts = relPath.split("/");
                            folderName = parts.length > 0 ? parts[0] : "Phone Storage";
                        } else if (dataPath != null) {
                            File f = new File(dataPath);
                            if (f.getParentFile() != null) {
                                folderName = f.getParentFile().getName();
                            }
                        }

                        JSObject track = new JSObject();
                        track.put("id", "local_ms_" + id);
                        track.put("title", fileTitle);
                        track.put("name", fileTitle);
                        track.put("artist", (artist != null && !artist.equals("<unknown>")) ? artist : "Local Artist");
                        track.put("album", (album != null && !album.equals("<unknown>")) ? album : "Local Collection");
                        track.put("duration", durationMs > 0 ? durationMs / 1000 : 0);
                        track.put("url", trackContentUri.toString());
                        track.put("streamUrl", trackContentUri.toString());
                        track.put("downloadUrl", trackContentUri.toString());
                        track.put("filePath", dataPath);
                        track.put("coverUrl", albumArtUri != null ? albumArtUri.toString() : null);
                        track.put("sizeBytes", sizeBytes);
                        track.put("mimeType", mimeType);
                        track.put("isLocal", true);
                        track.put("folderName", folderName);

                        tracks.put(track);
                    } while (cursor.moveToNext());
                }
            } catch (Exception e) {
                call.reject("MediaStore scan failed: " + e.getMessage());
                return;
            }

            JSObject result = new JSObject();
            result.put("tracks", tracks);
            call.resolve(result);
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action) || Intent.ACTION_SEND.equals(action)) {
            Uri uri = intent.getData();
            if (uri == null && Intent.ACTION_SEND.equals(action)) {
                uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            }
            if (uri != null) {
                String scheme = uri.getScheme();
                String displayName = null;
                long size = 0;
                if ("content".equals(scheme)) {
                    try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                        if (cursor != null && cursor.moveToFirst()) {
                            int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                            if (nameIndex != -1) displayName = cursor.getString(nameIndex);
                            int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                            if (sizeIndex != -1) size = cursor.getLong(sizeIndex);
                        }
                    } catch (Exception ignored) {}
                } else if ("file".equals(scheme)) {
                    displayName = uri.getLastPathSegment();
                }
                if (displayName == null) displayName = "External Audio File";

                JSObject song = new JSObject();
                song.put("id", "intent_audio_" + System.currentTimeMillis());
                song.put("title", displayName.replaceAll("\\.[^/.]+$", ""));
                song.put("name", displayName.replaceAll("\\.[^/.]+$", ""));
                song.put("artist", "External File");
                song.put("album", "File Manager");
                song.put("url", uri.toString());
                song.put("streamUrl", uri.toString());
                song.put("downloadUrl", uri.toString());
                song.put("filePath", uri.getPath());
                song.put("isLocal", true);
                song.put("sizeBytes", size);

                pendingAudioIntent = song;
                if (LocalAudioScannerPlugin.instance != null) {
                    LocalAudioScannerPlugin.instance.notifyAudioIntent(song);
                }
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PublicDownloadsPlugin.class);
        registerPlugin(LocalAudioScannerPlugin.class);
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }
}

