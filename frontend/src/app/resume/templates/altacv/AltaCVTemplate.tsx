import { useCallback } from 'react';
import type { ResumeData, StyleSettings } from '../../types/resume';
import { darkenColor } from '../../utils/colorUtils';
import { EditableText } from '../../components/EditableText';
import { getLabel } from '../../lib/i18n/resumeLabels';
import './AltaCVTemplate.css';

interface AltaCVTemplateProps {
    data: ResumeData;
    style: StyleSettings;
    onDataChange?: (data: ResumeData) => void;
}

export function AltaCVTemplate({ data, style, onDataChange }: AltaCVTemplateProps) {
    const visibility = data.sectionVisibility;
    const showProjects = visibility?.projects ?? data.projects.length > 0;
    const showAwards = visibility?.awards ?? data.awards.length > 0;
    const showHobbies = visibility?.hobbies ?? data.hobbies.length > 0;
    const lang = style.resumeLanguage || 'en';

    const cssVars = {
        '--primary-color': style.primaryColor,
        '--primary-dark': darkenColor(style.primaryColor, 15),
        '--sidebar-width': `${style.sidebarWidth}%`,
        '--accent-color': '#c5392d',
        '--font-size': `${style.fontSize}pt`,
        '--line-height': style.lineHeight,
        '--scale': style.fontSize / 10,
    } as React.CSSProperties;

    // Helper functions for updating data
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

    const updateSkill = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newSkills = [...data.skills];
            newSkills[index] = { ...newSkills[index], [field]: value };
            onDataChange({ ...data, skills: newSkills });
        }
    }, [data, onDataChange]);

    const updateLanguage = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newLangs = [...data.languages];
            newLangs[index] = { ...newLangs[index], [field]: value };
            onDataChange({ ...data, languages: newLangs });
        }
    }, [data, onDataChange]);

    const updateProject = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newProjects = [...data.projects];
            newProjects[index] = { ...newProjects[index], [field]: value };
            onDataChange({ ...data, projects: newProjects });
        }
    }, [data, onDataChange]);

    return (
        <div className="altacv-container" style={cssVars}>
            {/* Left Column - Main Content */}
            <div className="altacv-main">
                {/* Header */}
                <header className="altacv-header">
                    <EditableText
                        tag="h1"
                        className="altacv-name"
                        value={data.personal.name || ''}
                        onChange={onDataChange ? (v) => updatePersonal('name', v) : undefined}
                        placeholder="YOUR NAME HERE"
                    />
                    <EditableText
                        tag="p"
                        className="altacv-tagline"
                        value={data.personal.title || ''}
                        onChange={onDataChange ? (v) => updatePersonal('title', v) : undefined}
                        placeholder="Your Position or Tagline Here"
                    />

                    <div className="altacv-contact-row">
                        {data.personal.email && (
                            <span className="altacv-contact-item">✉ {data.personal.email}</span>
                        )}
                        {data.personal.phone && (
                            <span className="altacv-contact-item">📞 {data.personal.phone}</span>
                        )}
                        {data.personal.address && (
                            <span className="altacv-contact-item">📍 {data.personal.address}</span>
                        )}
                        {data.personal.website && (
                            <span className="altacv-contact-item">🌐 {data.personal.website}</span>
                        )}
                    </div>
                </header>

                {/* Experience */}
                {data.experience.length > 0 && (
                    <section className="altacv-section">
                        <h2 className="altacv-section-title">{getLabel('experience', lang).toUpperCase()}</h2>
                        {data.experience.map((exp, index) => (
                            <div key={exp.id} className="altacv-entry">
                                <div className="altacv-entry-header">
                                    <EditableText
                                        tag="span"
                                        className="altacv-entry-title"
                                        value={exp.position || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'position', v) : undefined}
                                        placeholder="Position"
                                    />
                                    <span className="altacv-entry-location">📍 {exp.location}</span>
                                </div>
                                <EditableText
                                    tag="div"
                                    className="altacv-entry-company"
                                    value={exp.company || ''}
                                    onChange={onDataChange ? (v) => updateExperience(index, 'company', v) : undefined}
                                    placeholder="Company"
                                />
                                <div className="altacv-entry-date">
                                    📅 <EditableText
                                        tag="span"
                                        value={exp.startDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'startDate', v) : undefined}
                                        placeholder="Start"
                                    /> - {exp.current ? 'Ongoing' : <EditableText
                                        tag="span"
                                        value={exp.endDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'endDate', v) : undefined}
                                        placeholder="End"
                                    />}
                                </div>
                                {exp.description && (
                                    <ul className="altacv-entry-list">
                                        {exp.description.split('\n').filter(Boolean).map((line, i) => (
                                            <li key={i}>{line}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </section>
                )}

                {/* Projects */}
                {showProjects && data.projects.length > 0 && (
                    <section className="altacv-section">
                        <h2 className="altacv-section-title">{getLabel('projects', lang).toUpperCase()}</h2>
                        {data.projects.map((proj, i) => (
                            <div key={proj.id} className="altacv-entry">
                                <div className="altacv-entry-header">
                                    <EditableText
                                        tag="span"
                                        className="altacv-entry-title"
                                        value={proj.name || ''}
                                        onChange={onDataChange ? (v) => updateProject(i, 'name', v) : undefined}
                                        placeholder="Project Name"
                                    />
                                </div>
                                <EditableText
                                    tag="div"
                                    className="altacv-entry-company"
                                    value={proj.organization || ''}
                                    onChange={onDataChange ? (v) => updateProject(i, 'organization', v) : undefined}
                                    placeholder="Organization"
                                />
                                <EditableText
                                    tag="p"
                                    className="altacv-entry-desc"
                                    value={proj.description || ''}
                                    onChange={onDataChange ? (v) => updateProject(i, 'description', v) : undefined}
                                    placeholder="Description"
                                />
                            </div>
                        ))}
                    </section>
                )}

                {/* A Day of My Life - Pie Chart Placeholder */}
                {showHobbies && data.hobbies.length > 0 && (
                    <section className="altacv-section">
                        <h2 className="altacv-section-title">A DAY OF MY LIFE</h2>
                        <div className="altacv-pie-chart">
                            <div className="altacv-pie">
                                {/* Simple pie chart representation */}
                                <div className="pie-segment" style={{ '--rotation': '0deg', '--color': '#c5392d' } as React.CSSProperties} />
                                <div className="pie-segment" style={{ '--rotation': '90deg', '--color': '#e8a87c' } as React.CSSProperties} />
                                <div className="pie-segment" style={{ '--rotation': '180deg', '--color': '#85cdca' } as React.CSSProperties} />
                                <div className="pie-segment" style={{ '--rotation': '270deg', '--color': '#e27d60' } as React.CSSProperties} />
                            </div>
                            <div className="pie-labels">
                                {data.hobbies.slice(0, 4).map((hobby) => (
                                    <span key={hobby.id} className="pie-label">{hobby.name}</span>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="altacv-sidebar">
                {/* Photo */}
                {data.personal.photo && (
                    <div className="altacv-photo-section">
                        <img src={data.personal.photo} alt="" className="altacv-photo" />
                    </div>
                )}

                {/* Philosophy */}
                {data.personal.philosophy && (
                    <section className="altacv-sidebar-section">
                        <h3 className="altacv-sidebar-title">MY LIFE PHILOSOPHY</h3>
                        <p className="altacv-philosophy">"{data.personal.philosophy}"</p>
                    </section>
                )}

                {/* Achievements */}
                {showAwards && data.awards.length > 0 && (
                    <section className="altacv-sidebar-section">
                        <h3 className="altacv-sidebar-title">MOST PROUD OF</h3>
                        {data.awards.map((award) => (
                            <div key={award.id} className="altacv-achievement">
                                <span className="achievement-icon">🏆</span>
                                <div className="achievement-content">
                                    <strong>{award.title}</strong>
                                    <p>{award.description}</p>
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {/* Strengths / Skills */}
                {data.skills.length > 0 && (
                    <section className="altacv-sidebar-section">
                        <h3 className="altacv-sidebar-title">STRENGTHS</h3>
                        <div className="altacv-tags">
                            {data.skills.map((skill, i) => (
                                <span key={skill.id} className="altacv-tag">
                                    <EditableText
                                        tag="span"
                                        value={skill.name || ''}
                                        onChange={onDataChange ? (v) => updateSkill(i, 'name', v) : undefined}
                                        placeholder="Skill"
                                    />
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Languages */}
                {data.languages.length > 0 && (
                    <section className="altacv-sidebar-section">
                        <h3 className="altacv-sidebar-title">LANGUAGES</h3>
                        {data.languages.map((langItem, i) => (
                            <div key={langItem.id} className="altacv-language">
                                <EditableText
                                    tag="span"
                                    className="lang-name"
                                    value={langItem.name || ''}
                                    onChange={onDataChange ? (v) => updateLanguage(i, 'name', v) : undefined}
                                    placeholder="Language"
                                />
                                <span className="lang-dots">
                                    {[1, 2, 3, 4, 5].map((j) => (
                                        <span
                                            key={j}
                                            className={`lang-dot ${j <= langItem.levelNumber ? 'filled' : ''}`}
                                        />
                                    ))}
                                </span>
                            </div>
                        ))}
                    </section>
                )}

                {/* Education */}
                {data.education.length > 0 && (
                    <section className="altacv-sidebar-section">
                        <h3 className="altacv-sidebar-title">EDUCATION</h3>
                        {data.education.map((edu, i) => (
                            <div key={edu.id} className="altacv-edu">
                                <div className="edu-degree">
                                    <EditableText
                                        tag="span"
                                        value={edu.degree || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'degree', v) : undefined}
                                        placeholder="Degree"
                                    /> in <EditableText
                                        tag="span"
                                        value={edu.field || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'field', v) : undefined}
                                        placeholder="Field"
                                    />
                                </div>
                                <div className="edu-school">
                                    <EditableText
                                        tag="span"
                                        value={edu.institution || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'institution', v) : undefined}
                                        placeholder="Institution"
                                    />
                                </div>
                                <div className="edu-date">
                                    📅 <EditableText
                                        tag="span"
                                        value={edu.startDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'startDate', v) : undefined}
                                        placeholder="Start"
                                    /> - <EditableText
                                        tag="span"
                                        value={edu.endDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'endDate', v) : undefined}
                                        placeholder="End"
                                    />
                                </div>
                                {edu.description && <div className="edu-desc">{edu.description}</div>}
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </div>
    );
}
