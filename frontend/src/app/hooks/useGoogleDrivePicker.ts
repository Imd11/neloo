"use client";

import { useCallback, useRef, useState } from "react";

// Google Drive Picker configuration. These browser-side values must be
// restricted in Google Cloud Console by HTTP referrer and OAuth origins.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.trim();
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

interface UseGoogleDrivePickerResult {
    openPicker: () => void;
    isLoading: boolean;
    error: string | null;
}

declare global {
    interface Window {
        google: any;
        gapi: any;
    }
}

export function useGoogleDrivePicker(
    onFileSelected: (file: File) => void
): UseGoogleDrivePickerResult {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const accessTokenRef = useRef<string | null>(null);
    const pickerInited = useRef(false);
    const gisInited = useRef(false);
    const tokenClient = useRef<any>(null);

    // Load Google API scripts
    const loadScript = useCallback((src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }, []);

    // Initialize Picker API
    const initPickerApi = useCallback(async () => {
        if (pickerInited.current) return;

        await loadScript("https://apis.google.com/js/api.js");

        await new Promise<void>((resolve) => {
            window.gapi.load("picker", { callback: resolve });
        });

        pickerInited.current = true;
    }, [loadScript]);

    // Initialize Google Identity Services
    const initGis = useCallback(async () => {
        if (gisInited.current) return;

        if (!GOOGLE_CLIENT_ID) {
            throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
        }

        await loadScript("https://accounts.google.com/gsi/client");

        tokenClient.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: "", // Will be set when requesting token
        });

        gisInited.current = true;
    }, [loadScript]);

    // Download file from Google Drive
    const downloadFile = useCallback(async (
        fileId: string,
        fileName: string,
        mimeType: string,
        accessToken: string
    ): Promise<File> => {
        // For Google Workspace files (Docs, Sheets, Slides), export as PDF or appropriate format
        const isGoogleWorkspaceFile = mimeType.startsWith("application/vnd.google-apps");

        let downloadUrl: string;
        let exportMimeType: string | null = null;

        if (isGoogleWorkspaceFile) {
            // Export Google Workspace files
            if (mimeType === "application/vnd.google-apps.document") {
                exportMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                fileName = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
            } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
                exportMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                fileName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
            } else if (mimeType === "application/vnd.google-apps.presentation") {
                exportMimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                fileName = fileName.endsWith(".pptx") ? fileName : `${fileName}.pptx`;
            } else {
                // Default to PDF for other Google Workspace files
                exportMimeType = "application/pdf";
                fileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
            }
            downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
        } else {
            // Regular file - direct download
            downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        }

        const response = await fetch(downloadUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const blob = await response.blob();
        return new File([blob], fileName, { type: exportMimeType || mimeType });
    }, []);

    // Create and show picker
    const createPicker = useCallback((accessToken: string) => {
        if (!GOOGLE_API_KEY) {
            setError("Google Drive API key 未配置");
            return;
        }

        const view = new window.google.picker.DocsView()
            .setIncludeFolders(true)
            .setSelectFolderEnabled(false);

        const picker = new window.google.picker.PickerBuilder()
            .addView(view)
            .addView(new window.google.picker.DocsUploadView())
            .setOAuthToken(accessToken)
            .setDeveloperKey(GOOGLE_API_KEY)
            .setCallback(async (data: any) => {
                if (data.action === window.google.picker.Action.PICKED) {
                    const doc = data.docs[0];
                    setIsLoading(true);
                    try {
                        const file = await downloadFile(
                            doc.id,
                            doc.name,
                            doc.mimeType,
                            accessToken
                        );
                        onFileSelected(file);
                    } catch (err) {
                        console.error("Failed to download file:", err);
                        setError("下载文件失败，请重试");
                    } finally {
                        setIsLoading(false);
                    }
                }
            })
            .setTitle("从 Google Drive 选择文件")
            .setLocale("zh-CN")
            .build();

        picker.setVisible(true);
    }, [downloadFile, onFileSelected]);

    // Main function to open picker
    const openPicker = useCallback(async () => {
        setError(null);
        setIsLoading(true);

        try {
            // Initialize APIs
            await Promise.all([initPickerApi(), initGis()]);

            // Request access token
            tokenClient.current.callback = async (response: any) => {
                if (response.error !== undefined) {
                    setError("授权失败，请重试");
                    setIsLoading(false);
                    return;
                }
                accessTokenRef.current = response.access_token;
                setIsLoading(false);
                createPicker(response.access_token);
            };

            // Check if we already have a valid token
            if (accessTokenRef.current) {
                setIsLoading(false);
                createPicker(accessTokenRef.current);
            } else {
                // Request new token
                tokenClient.current.requestAccessToken({ prompt: "consent" });
            }
        } catch (err) {
            console.error("Failed to initialize Google Drive picker:", err);
            setError("初始化 Google Drive 失败");
            setIsLoading(false);
        }
    }, [initPickerApi, initGis, createPicker]);

    return {
        openPicker,
        isLoading,
        error,
    };
}
