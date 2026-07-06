/**
 * SmartResume Backend Client
 * Calls the data-analyst backend for resume parsing
 */
import type { ResumeData } from '../types/resume';

// Backend URL - uses Next.js environment variable or defaults to backend origin
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Parse a resume PDF using the SmartResume backend
 * Uses YOLOv10 layout detection and index-based extraction
 */
export async function parseResumeWithBackend(file: File): Promise<ResumeData> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BACKEND_URL}/api/resume/parse`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `解析失败: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || '解析失败');
    }

    return result.data as ResumeData;
}

/**
 * Check if the SmartResume backend is available
 */
export async function isBackendAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${BACKEND_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
        });
        return response.ok;
    } catch {
        return false;
    }
}
