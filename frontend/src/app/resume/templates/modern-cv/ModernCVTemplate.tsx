import { useCallback } from 'react';
import type { ResumeData, StyleSettings } from '../../types/resume';
import { darkenColor } from '../../utils/colorUtils';
import { EditableText } from '../../components/EditableText';
import { getLabel } from '../../lib/i18n/resumeLabels';
import './ModernCV.css';

interface Props {
    data: ResumeData;
    style: StyleSettings;
    onDataChange?: (data: ResumeData) => void;
}

export function ModernCVTemplate({ data, style, onDataChange }: Props) {
    const { personal, experience, education, skills, languages, projects } = data;
    const visibility = data.sectionVisibility;
    const showProjects = visibility?.projects ?? projects.length > 0;
    const lang = style.resumeLanguage || 'en';

    const cssVars = {
        '--primary-color': style.primaryColor,
        '--primary-dark': darkenColor(style.primaryColor, 15),
        '--font-size': `${style.fontSize}pt`,
        '--line-height': style.lineHeight,
        '--scale': style.fontSize / 10,
    } as React.CSSProperties;

    // Helper function for updating personal data
    const updatePersonal = useCallback((field: string, value: string) => {
        if (onDataChange) {
            onDataChange({
                ...data,
                personal: { ...data.personal, [field]: value },
            });
        }
    }, [data, onDataChange]);

    const updateExperience = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newExp = [...data.experience];
            newExp[index] = { ...newExp[index], [field]: value };
            onDataChange({ ...data, experience: newExp });
        }
    }, [data, onDataChange]);

    const updateEducation = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newEdu = [...data.education];
            newEdu[index] = { ...newEdu[index], [field]: value };
            onDataChange({ ...data, education: newEdu });
        }
    }, [data, onDataChange]);

    const updateProject = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newProjects = [...data.projects];
            newProjects[index] = { ...newProjects[index], [field]: value };
            onDataChange({ ...data, projects: newProjects });
        }
    }, [data, onDataChange]);

    const updateLanguage = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newLangs = [...data.languages];
            newLangs[index] = { ...newLangs[index], [field]: value };
            onDataChange({ ...data, languages: newLangs });
        }
    }, [data, onDataChange]);

    const updateHighlight = useCallback((expIndex: number, highlightIndex: number, value: string) => {
        if (onDataChange) {
            const newExp = [...data.experience];
            const newHighlights = [...(newExp[expIndex].highlights || [])];
            newHighlights[highlightIndex] = value;
            newExp[expIndex] = { ...newExp[expIndex], highlights: newHighlights };
            onDataChange({ ...data, experience: newExp });
        }
    }, [data, onDataChange]);

    return (
        <div className="modern-container" style={cssVars}>
            <header className="modern-header">
                <div className="modern-header-top">
                    <EditableText
                        tag="span"
                        value={personal.name || ''}
                        onChange={onDataChange ? (v) => updatePersonal('name', v) : undefined}
                        placeholder="Name"
                    />
                    <span className="modern-header-sep">·</span>
                    <EditableText
                        tag="span"
                        value={personal.title || ''}
                        onChange={onDataChange ? (v) => updatePersonal('title', v) : undefined}
                        placeholder="Title"
                    />
                    <span className="modern-header-sep">·</span>
                    <EditableText
                        tag="span"
                        value={personal.address || ''}
                        onChange={onDataChange ? (v) => updatePersonal('address', v) : undefined}
                        placeholder="Address"
                    />
                    <span className="modern-header-sep">·</span>
                    <EditableText
                        tag="span"
                        value={personal.email || ''}
                        onChange={onDataChange ? (v) => updatePersonal('email', v) : undefined}
                        placeholder="Email"
                    />
                    <span className="modern-header-sep">·</span>
                    <EditableText
                        tag="span"
                        value={personal.phone || ''}
                        onChange={onDataChange ? (v) => updatePersonal('phone', v) : undefined}
                        placeholder="Phone"
                    />
                </div>
                <div className="modern-name-area">
                    <EditableText
                        tag="h1"
                        className="modern-name"
                        value={personal.name || ''}
                        onChange={onDataChange ? (v) => updatePersonal('name', v) : undefined}
                        placeholder="Jan Küster"
                    />
                    <span className="modern-title-divider">|</span>
                    <span className="modern-title-text">Resume</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="modern-main">
                <div className="modern-info-cards">
                    <div className="modern-info-card">
                        <span className="modern-info-label">Status</span>
                        <EditableText
                            tag="span"
                            className="modern-info-value"
                            value={personal.title || ''}
                            onChange={onDataChange ? (v) => updatePersonal('title', v) : undefined}
                            placeholder="Your Title"
                        />
                    </div>
                    <div className="modern-info-card">
                        <span className="modern-info-label">Fields</span>
                        <span className="modern-info-value">
                            {skills.slice(0, 3).map(s => s.name).join(', ')}
                        </span>
                    </div>
                    <div className="modern-info-card">
                        <span className="modern-info-label">Tech</span>
                        <span className="modern-info-value">
                            {skills.filter(s => s.category === 'technical').slice(0, 4).map(s => s.name).join(', ') ||
                                skills.slice(3, 7).map(s => s.name).join(', ')}
                        </span>
                    </div>
                    <div className="modern-info-card">
                        <span className="modern-info-label">Loves</span>
                        <EditableText
                            tag="span"
                            className="modern-info-value"
                            value={personal.summary?.substring(0, 50) || ''}
                            onChange={onDataChange ? (v) => updatePersonal('summary', v) : undefined}
                            placeholder="What you love"
                        />
                    </div>
                </div>

                {/* Photo */}
                {personal.photo && (
                    <div className="modern-photo-container">
                        <img src={personal.photo} alt="" className="modern-photo" />
                    </div>
                )}

                {/* Experience Section */}
                <section className="modern-section">
                    <div className="modern-section-header">
                        <span className="modern-section-icon">☰</span>
                        <h2 className="modern-section-title">{getLabel('experience', lang)}</h2>
                    </div>
                    <div className="modern-entries">
                        {experience.map((exp, i) => (
                            <div key={exp.id || i} className="modern-entry">
                                <div className="modern-entry-date">
                                    <EditableText
                                        tag="span"
                                        value={exp.startDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(i, 'startDate', v) : undefined}
                                        placeholder="Start"
                                    /> – {exp.current ? 'present' : <EditableText
                                        tag="span"
                                        value={exp.endDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(i, 'endDate', v) : undefined}
                                        placeholder="End"
                                    />}
                                </div>
                                <div className="modern-entry-content">
                                    <EditableText
                                        tag="h3"
                                        className="modern-entry-title"
                                        value={exp.position || ''}
                                        onChange={onDataChange ? (v) => updateExperience(i, 'position', v) : undefined}
                                        placeholder="Position"
                                    />
                                    <EditableText
                                        tag="span"
                                        className="modern-entry-company"
                                        value={exp.company || ''}
                                        onChange={onDataChange ? (v) => updateExperience(i, 'company', v) : undefined}
                                        placeholder="Company"
                                    />
                                    <EditableText
                                        tag="p"
                                        className="modern-entry-desc"
                                        value={exp.description || ''}
                                        onChange={onDataChange ? (v) => updateExperience(i, 'description', v) : undefined}
                                        placeholder="Description"
                                    />
                                    {exp.highlights && exp.highlights.length > 0 && (
                                        <ul className="modern-entry-bullets">
                                            {exp.highlights.map((h, j) => (
                                                <li key={j}>○ <EditableText
                                                    tag="span"
                                                    value={h || ''}
                                                    onChange={onDataChange ? (v) => updateHighlight(i, j, v) : undefined}
                                                    placeholder="Highlight"
                                                /></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Education Section */}
                <section className="modern-section">
                    <div className="modern-section-header">
                        <span className="modern-section-icon">☰</span>
                        <h2 className="modern-section-title">{getLabel('education', lang)}</h2>
                    </div>
                    <div className="modern-entries">
                        {education.map((edu, i) => (
                            <div key={edu.id || i} className="modern-entry">
                                <div className="modern-entry-date">
                                    <EditableText
                                        tag="span"
                                        value={edu.startDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'startDate', v) : undefined}
                                        placeholder="Start"
                                    /> – <EditableText
                                        tag="span"
                                        value={edu.endDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'endDate', v) : undefined}
                                        placeholder="End"
                                    />
                                </div>
                                <div className="modern-entry-content">
                                    <EditableText
                                        tag="h3"
                                        className="modern-entry-title"
                                        value={edu.degree || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'degree', v) : undefined}
                                        placeholder="Degree"
                                    />
                                    <EditableText
                                        tag="span"
                                        className="modern-entry-company"
                                        value={edu.institution || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'institution', v) : undefined}
                                        placeholder="Institution"
                                    />
                                    {(edu.description || onDataChange) && (
                                        <ul className="modern-entry-bullets">
                                            <li>○ <EditableText
                                                tag="span"
                                                value={edu.description || ''}
                                                onChange={onDataChange ? (v) => updateEducation(i, 'description', v) : undefined}
                                                placeholder="Description"
                                            /></li>
                                        </ul>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Projects Section */}
                {showProjects && projects && projects.length > 0 && (
                    <section className="modern-section">
                        <div className="modern-section-header">
                            <span className="modern-section-icon">☰</span>
                            <h2 className="modern-section-title">{getLabel('projects', lang)}</h2>
                        </div>
                        <div className="modern-entries">
                            {projects.map((proj, i) => (
                                <div key={proj.id || i} className="modern-entry">
                                    <EditableText
                                        tag="div"
                                        className="modern-entry-date"
                                        value={proj.startDate || ''}
                                        onChange={onDataChange ? (v) => updateProject(i, 'startDate', v) : undefined}
                                        placeholder="Date"
                                    />
                                    <div className="modern-entry-content">
                                        <EditableText
                                            tag="h3"
                                            className="modern-entry-title"
                                            value={proj.name || ''}
                                            onChange={onDataChange ? (v) => updateProject(i, 'name', v) : undefined}
                                            placeholder="Project Name"
                                        />
                                        <EditableText
                                            tag="p"
                                            className="modern-entry-desc"
                                            value={proj.description ? `○ ${proj.description}` : ''}
                                            onChange={onDataChange ? (v) => updateProject(i, 'description', v.replace(/^○\s*/, '')) : undefined}
                                            placeholder="Description"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {languages.length > 0 && (
                    <section className="modern-section modern-section-inline">
                        <div className="modern-section-header">
                            <span className="modern-section-icon">☰</span>
                            <h2 className="modern-section-title">{getLabel('languages', lang)}</h2>
                        </div>
                        <div className="modern-languages">
                            {languages.map((langItem, i) => (
                                <span key={langItem.id || i} className="modern-language">
                                    <EditableText
                                        tag="span"
                                        value={langItem.name || ''}
                                        onChange={onDataChange ? (v) => updateLanguage(i, 'name', v) : undefined}
                                        placeholder="Language"
                                    /> (<EditableText
                                        tag="span"
                                        value={langItem.level || ''}
                                        onChange={onDataChange ? (v) => updateLanguage(i, 'level', v) : undefined}
                                        placeholder="Level"
                                    />)
                                </span>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            {/* Footer */}
            <footer className="modern-footer">
                <span>www.jankuester.com</span>
                <span>·</span>
                <span>github.com/jankapunkt</span>
            </footer>
        </div>
    );
}

export default ModernCVTemplate;
