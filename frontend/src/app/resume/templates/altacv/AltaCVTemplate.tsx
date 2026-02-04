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

    const updateAward = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newAwards = [...(data.awards || [])];
            newAwards[index] = { ...newAwards[index], [field]: value };
            onDataChange({ ...data, awards: newAwards });
        }
    }, [data, onDataChange]);

    const updateHobby = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newHobbies = [...(data.hobbies || [])];
            newHobbies[index] = { ...newHobbies[index], [field]: value };
            onDataChange({ ...data, hobbies: newHobbies });
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
                        {(data.personal.email || onDataChange) && (
                            <span className="altacv-contact-item">✉ <EditableText
                                tag="span"
                                value={data.personal.email || ''}
                                onChange={onDataChange ? (v) => updatePersonal('email', v) : undefined}
                                placeholder="email@example.com"
                            /></span>
                        )}
                        {(data.personal.phone || onDataChange) && (
                            <span className="altacv-contact-item">📞 <EditableText
                                tag="span"
                                value={data.personal.phone || ''}
                                onChange={onDataChange ? (v) => updatePersonal('phone', v) : undefined}
                                placeholder="+1 234 567 890"
                            /></span>
                        )}
                        {(data.personal.address || onDataChange) && (
                            <span className="altacv-contact-item">📍 <EditableText
                                tag="span"
                                value={data.personal.address || ''}
                                onChange={onDataChange ? (v) => updatePersonal('address', v) : undefined}
                                placeholder="City, Country"
                            /></span>
                        )}
                        {(data.personal.website || onDataChange) && (
                            <span className="altacv-contact-item">🌐 <EditableText
                                tag="span"
                                value={data.personal.website || ''}
                                onChange={onDataChange ? (v) => updatePersonal('website', v) : undefined}
                                placeholder="www.example.com"
                            /></span>
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
                                    <span className="altacv-entry-location">📍 <EditableText
                                        tag="span"
                                        value={exp.location || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'location', v) : undefined}
                                        placeholder="Location"
                                    /></span>
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
                                {(exp.description || onDataChange) && (
                                    <EditableText
                                        tag="p"
                                        className="altacv-entry-desc"
                                        value={exp.description || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'description', v) : undefined}
                                        placeholder="Description (use newlines for bullet points)"
                                    />
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
                                {data.hobbies.slice(0, 4).map((hobby, i) => (
                                    <EditableText
                                        key={hobby.id}
                                        tag="span"
                                        className="pie-label"
                                        value={hobby.name || ''}
                                        onChange={onDataChange ? (v) => updateHobby(i, 'name', v) : undefined}
                                        placeholder="Hobby"
                                    />
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
                {(data.personal.philosophy || onDataChange) && (
                    <section className="altacv-sidebar-section">
                        <h3 className="altacv-sidebar-title">MY LIFE PHILOSOPHY</h3>
                        <EditableText
                            tag="p"
                            className="altacv-philosophy"
                            value={data.personal.philosophy ? `"${data.personal.philosophy}"` : ''}
                            onChange={onDataChange ? (v) => updatePersonal('philosophy', v.replace(/^"|"$/g, '')) : undefined}
                            placeholder="Your philosophy here"
                        />
                    </section>
                )}

                {showAwards && data.awards.length > 0 && (
                    <section className="altacv-sidebar-section">
                        <h3 className="altacv-sidebar-title">MOST PROUD OF</h3>
                        {data.awards.map((award, i) => (
                            <div key={award.id} className="altacv-achievement">
                                <span className="achievement-icon">🏆</span>
                                <div className="achievement-content">
                                    <strong><EditableText
                                        tag="span"
                                        value={award.title || ''}
                                        onChange={onDataChange ? (v) => updateAward(i, 'title', v) : undefined}
                                        placeholder="Award Title"
                                    /></strong>
                                    <EditableText
                                        tag="p"
                                        value={award.description || ''}
                                        onChange={onDataChange ? (v) => updateAward(i, 'description', v) : undefined}
                                        placeholder="Description"
                                    />
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
                                {(edu.description || onDataChange) && (
                                    <EditableText
                                        tag="div"
                                        className="edu-desc"
                                        value={edu.description || ''}
                                        onChange={onDataChange ? (v) => updateEducation(i, 'description', v) : undefined}
                                        placeholder="Description"
                                    />
                                )}
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </div>
    );
}
