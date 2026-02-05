import { createClient } from '@supabase/supabase-js';
import type { PresentationData, Slide } from '../types/slides';

// Get Supabase client
const getSupabaseClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
    }

    return createClient(supabaseUrl, supabaseAnonKey);
};

export const savePresentation = async (
    data: Omit<PresentationData, 'created_at' | 'updated_at'>,
    accessToken?: string
): Promise<PresentationData> => {
    const supabase = getSupabaseClient();

    // Set auth header if token provided
    if (accessToken) {
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: ''
        });
    }

    const { data: result, error } = await supabase
        .from('slide_presentations')
        .upsert({
            id: data.id,
            user_id: data.user_id,
            title: data.title || data.topic || 'Untitled',
            topic: data.topic,
            slides: data.slides,
            attachments: data.attachments || [],
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving presentation:', error);
        throw error;
    }

    return result as PresentationData;
};

export const getPresentation = async (
    id: string,
    accessToken?: string
): Promise<PresentationData | null> => {
    const supabase = getSupabaseClient();

    if (accessToken) {
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: ''
        });
    }

    const { data, error } = await supabase
        .from('slide_presentations')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error('Error getting presentation:', error);
        throw error;
    }

    return data as PresentationData;
};

export const getAllPresentations = async (
    userId: string,
    accessToken?: string
): Promise<PresentationData[]> => {
    const supabase = getSupabaseClient();

    if (accessToken) {
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: ''
        });
    }

    const { data, error } = await supabase
        .from('slide_presentations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error getting presentations:', error);
        throw error;
    }

    return data as PresentationData[];
};

export const deletePresentation = async (
    id: string,
    accessToken?: string
): Promise<void> => {
    const supabase = getSupabaseClient();

    if (accessToken) {
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: ''
        });
    }

    const { error } = await supabase
        .from('slide_presentations')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting presentation:', error);
        throw error;
    }
};

export const updateSlideImage = async (
    presentationId: string,
    slideId: string,
    imageBase64: string,
    accessToken?: string
): Promise<void> => {
    const supabase = getSupabaseClient();

    if (accessToken) {
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: ''
        });
    }

    // First get the current presentation
    const { data: presentation, error: fetchError } = await supabase
        .from('slide_presentations')
        .select('slides')
        .eq('id', presentationId)
        .single();

    if (fetchError || !presentation) {
        console.error('Error fetching presentation:', fetchError);
        return;
    }

    // Update the specific slide's image
    const slides = presentation.slides as Slide[];
    const slideIndex = slides.findIndex(s => s.id === slideId);

    if (slideIndex !== -1) {
        slides[slideIndex].imageBase64 = imageBase64;
        slides[slideIndex].isGeneratingImage = false;

        const { error: updateError } = await supabase
            .from('slide_presentations')
            .update({
                slides,
                updated_at: new Date().toISOString()
            })
            .eq('id', presentationId);

        if (updateError) {
            console.error('Error updating slide image:', updateError);
        }
    }
};

export const updateSlideContent = async (
    presentationId: string,
    slideId: string,
    updates: { title?: string; content?: string; customCanvasJson?: string },
    accessToken?: string
): Promise<void> => {
    const supabase = getSupabaseClient();

    if (accessToken) {
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: ''
        });
    }

    const { data: presentation, error: fetchError } = await supabase
        .from('slide_presentations')
        .select('slides')
        .eq('id', presentationId)
        .single();

    if (fetchError || !presentation) {
        console.error('Error fetching presentation:', fetchError);
        return;
    }

    const slides = presentation.slides as Slide[];
    const slideIndex = slides.findIndex(s => s.id === slideId);

    if (slideIndex !== -1) {
        if (updates.title !== undefined) slides[slideIndex].title = updates.title;
        if (updates.content !== undefined) slides[slideIndex].content = updates.content;
        if (updates.customCanvasJson !== undefined) slides[slideIndex].customCanvasJson = updates.customCanvasJson;

        const { error: updateError } = await supabase
            .from('slide_presentations')
            .update({
                slides,
                updated_at: new Date().toISOString()
            })
            .eq('id', presentationId);

        if (updateError) {
            console.error('Error updating slide content:', updateError);
        }
    }
};
