import { LayoutTemplate } from '../types';

const W = 1280;
const H = 720;

export const LAYOUTS: Record<string, LayoutTemplate> = {
    'title-hero': {
        id: 'title-hero',
        name: 'Title Hero',
        description: 'Large centered title with subtitle below',
        forTypes: ['cover'],
        objects: [
            { field: 'title', x: 100, y: H * 0.3, width: W - 200, fontSize: 56, align: 'center', fontStyle: 'bold' },
            { field: 'content', x: 200, y: H * 0.55, width: W - 400, fontSize: 22, align: 'center' },
        ]
    },
    'title-left': {
        id: 'title-left',
        name: 'Title Left',
        description: 'Left-aligned title with content below',
        forTypes: ['content'],
        objects: [
            { field: 'title', x: 80, y: 80, width: W * 0.6, fontSize: 40, align: 'left', fontStyle: 'bold' },
            { field: 'content', x: 80, y: 180, width: W * 0.55, fontSize: 20, align: 'left' },
        ]
    },
    'split-screen': {
        id: 'split-screen',
        name: 'Split Screen',
        description: 'Left text, right visual area',
        forTypes: ['content'],
        objects: [
            { field: 'title', x: 60, y: 100, width: W * 0.42, fontSize: 36, align: 'left', fontStyle: 'bold' },
            { field: 'content', x: 60, y: 200, width: W * 0.42, fontSize: 18, align: 'left' },
        ]
    },
    'big-statement': {
        id: 'big-statement',
        name: 'Big Statement',
        description: 'One large statement centered',
        forTypes: ['content'],
        objects: [
            { field: 'title', x: 120, y: H * 0.3, width: W - 240, fontSize: 48, align: 'center', fontStyle: 'bold' },
            { field: 'content', x: 200, y: H * 0.6, width: W - 400, fontSize: 18, align: 'center' },
        ]
    },
    'top-title': {
        id: 'top-title',
        name: 'Top Title',
        description: 'Title at top with content area below',
        forTypes: ['content'],
        objects: [
            { field: 'title', x: 80, y: 50, width: W - 160, fontSize: 36, align: 'left', fontStyle: 'bold' },
            { field: 'content', x: 80, y: 140, width: W - 160, fontSize: 18, align: 'left' },
        ]
    },
    'quote-callout': {
        id: 'quote-callout',
        name: 'Quote Callout',
        description: 'Large quote with attribution',
        forTypes: ['content'],
        objects: [
            { field: 'title', x: 140, y: H * 0.25, width: W - 280, fontSize: 32, align: 'center', fontStyle: 'italic' },
            { field: 'content', x: 300, y: H * 0.65, width: W - 600, fontSize: 18, align: 'center' },
        ]
    },
    'bottom-heavy': {
        id: 'bottom-heavy',
        name: 'Bottom Heavy',
        description: 'Visual top area, text at bottom',
        forTypes: ['content'],
        objects: [
            { field: 'title', x: 80, y: H * 0.55, width: W - 160, fontSize: 36, align: 'left', fontStyle: 'bold' },
            { field: 'content', x: 80, y: H * 0.7, width: W - 160, fontSize: 18, align: 'left' },
        ]
    },
    'closing': {
        id: 'closing',
        name: 'Closing',
        description: 'Final slide with call-to-action',
        forTypes: ['back-cover'],
        objects: [
            { field: 'title', x: 100, y: H * 0.3, width: W - 200, fontSize: 44, align: 'center', fontStyle: 'bold' },
            { field: 'content', x: 200, y: H * 0.55, width: W - 400, fontSize: 20, align: 'center' },
        ]
    },
};

export function getLayoutForSlide(layoutId?: string, slideType?: string): LayoutTemplate {
    if (layoutId && LAYOUTS[layoutId]) return LAYOUTS[layoutId];
    // fallback by slide type
    if (slideType === 'cover') return LAYOUTS['title-hero'];
    if (slideType === 'back-cover') return LAYOUTS['closing'];
    return LAYOUTS['title-left'];
}
