import { useCallback } from 'react';
import type { ResumeData, StyleSettings } from '../../types/resume';
import { darkenColor } from '../../utils/colorUtils';
import { EditableText } from '../../components/EditableText';
import { getLabel } from '../../lib/i18n/resumeLabels';
import './LuxSleekCV.css';

interface Props {
    data: ResumeData;
    style: StyleSettings;
    onDataChange?: (data: ResumeData) => void;
}

export function LuxSleekCVTemplate({ data, style, onDataChange }: Props) {
    const { personal, experience, education, skills, languages, publications, projects, awards } = data;
    const visibility = data.sectionVisibility;
    const showProjects = visibility?.projects ?? projects.length > 0;
    const showPublications = visibility?.publications ?? (publications?.length ?? 0) > 0;
    const showHobbies = visibility?.hobbies ?? ((data.hobbies?.length ?? 0) > 0 || (awards?.length ?? 0) > 0);
    const lang = style.resumeLanguage || 'en';

    const cssVars = {
        '--primary-color': style.primaryColor,
        '--primary-dark': darkenColor(style.primaryColor, 15),
        '--font-size': `${style.fontSize}pt`,
        '--line-height': style.lineHeight,
        '--sidebar-width': `${style.sidebarWidth}%`,
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
        <div className="luxsleek-container" style={cssVars}>
            {/* Left Sidebar */}
            <aside className="luxsleek-sidebar">
                {/* Photo */}
                {personal.photo && (
                    <div className="luxsleek-photo-container">
                        <img src={personal.photo} alt="" className="luxsleek-photo" />
                    </div>
                )}

                {/* Profile Section */}
                <section className="luxsleek-section">
                    <h2 className="luxsleek-section-title">{getLabel('summary', lang)}</h2>
                    <EditableText
                        tag="p"
                        className="luxsleek-profile-text"
                        value={personal.summary || ''}
                        onChange={onDataChange ? (v) => updatePersonal('summary', v) : undefined}
                        placeholder="Innovative and passionate professional with extensive experience in delivering exceptional results."
                    />
                </section>

                {/* Contact Details */}
                <section className="luxsleek-section">
                    <h2 className="luxsleek-section-title">{getLabel('contact', lang)}</h2>
                    <div className="luxsleek-contact-list">
                        {personal.email && (
                            <div className="luxsleek-contact-item">
                                <span className="luxsleek-contact-icon">✉</span>
                                <span>{personal.email}</span>
                            </div>
                        )}
                        {personal.phone && (
                            <div className="luxsleek-contact-item">
                                <span className="luxsleek-contact-icon">✆</span>
                                <span>{personal.phone}</span>
                            </div>
                        )}
                        {personal.website && (
                            <div className="luxsleek-contact-item">
                                <span className="luxsleek-contact-icon">⌘</span>
                                <span>{personal.website}</span>
                            </div>
                        )}
                        {personal.address && (
                            <div className="luxsleek-contact-item">
                                <span className="luxsleek-contact-icon">⌂</span>
                                <span>{personal.address}</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Personal Information */}
                {(personal.nationality || personal.birthday) && (
                    <section className="luxsleek-section">
                        <h2 className="luxsleek-section-title">Personal Information</h2>
                        <div className="luxsleek-info-list">
                            {personal.nationality && (
                                <div className="luxsleek-info-item">
                                    <span className="luxsleek-info-label">Citizenship:</span>
                                    <span>{personal.nationality}</span>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Skills */}
                {skills.length > 0 && (
                    <section className="luxsleek-section">
                        <h2 className="luxsleek-section-title">{getLabel('skills', lang)}</h2>
                        <ul className="luxsleek-skills-list">
                            {skills.map((skill, i) => (
                                <li key={skill.id || i} className="luxsleek-skill-item">
                                    <EditableText
                                        tag="span"
                                        value={skill.name || ''}
                                        onChange={onDataChange ? (v) => updateSkill(i, 'name', v) : undefined}
                                        placeholder="Skill"
                                    />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Languages */}
                {languages.length > 0 && (
                    <section className="luxsleek-section">
                        <h2 className="luxsleek-section-title">{getLabel('languages', lang)}</h2>
                        <div className="luxsleek-languages">
                            {languages.map((langItem, i) => (
                                <div key={langItem.id || i} className="luxsleek-language-item">
                                    <EditableText
                                        tag="span"
                                        className="luxsleek-language-name"
                                        value={langItem.name || ''}
                                        onChange={onDataChange ? (v) => updateLanguage(i, 'name', v) : undefined}
                                        placeholder="Language"
                                    />
                                    <EditableText
                                        tag="span"
                                        className="luxsleek-language-level"
                                        value={langItem.level || ''}
                                        onChange={onDataChange ? (v) => updateLanguage(i, 'level', v) : undefined}
                                        placeholder="Level"
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </aside>

            {/* Main Content */}
            <main className="luxsleek-main">
                {/* Header */}
                <header className="luxsleek-header">
                    <h1 className="luxsleek-name">{personal.name || 'Your Name'}</h1>
                </header>

                {/* Experience */}
                {experience.length > 0 && (
                    <section className="luxsleek-main-section">
                        <h2 className="luxsleek-main-title">{getLabel('experience', lang)}</h2>
                        <div className="luxsleek-entries">
                            {experience.map((exp, i) => (
                                <div key={exp.id || i} className="luxsleek-entry">
                                    <div className="luxsleek-entry-header">
                                        <EditableText
                                            tag="span"
                                            className="luxsleek-entry-role"
                                            value={exp.position || ''}
                                            onChange={onDataChange ? (v) => updateExperience(i, 'position', v) : undefined}
                                            placeholder="Position"
                                        />
                                        <span className="luxsleek-entry-company"> at <EditableText
                                            tag="span"
                                            value={exp.company || ''}
                                            onChange={onDataChange ? (v) => updateExperience(i, 'company', v) : undefined}
                                            placeholder="Company"
                                        /></span>
                                        <span className="luxsleek-entry-dates">
                                            <EditableText
                                                tag="span"
                                                value={exp.startDate || ''}
                                                onChange={onDataChange ? (v) => updateExperience(i, 'startDate', v) : undefined}
                                                placeholder="Start"
                                            />–{exp.current ? 'pres.' : <EditableText
                                                tag="span"
                                                value={exp.endDate || ''}
                                                onChange={onDataChange ? (v) => updateExperience(i, 'endDate', v) : undefined}
                                                placeholder="End"
                                            />}
                                        </span>
                                    </div>
                                    <EditableText
                                        tag="p"
                                        className="luxsleek-entry-description"
                                        value={exp.description ? `○ ${exp.description}` : ''}
                                        onChange={onDataChange ? (v) => updateExperience(i, 'description', v.replace(/^○\s*/, '')) : undefined}
                                        placeholder="Description"
                                    />
                                    {exp.highlights && exp.highlights.length > 0 && (
                                        <ul className="luxsleek-highlights">
                                            {exp.highlights.map((h, j) => (
                                                <li key={j}>○ {h}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Education */}
                {education.length > 0 && (
                    <section className="luxsleek-main-section">
                        <h2 className="luxsleek-main-title">{getLabel('education', lang)}</h2>
                        <div className="luxsleek-entries">
                            {education.map((edu, i) => (
                                <div key={edu.id || i} className="luxsleek-entry">
                                    <div className="luxsleek-entry-header">
                                        <EditableText
                                            tag="span"
                                            className="luxsleek-entry-role"
                                            value={edu.degree || ''}
                                            onChange={onDataChange ? (v) => updateEducation(i, 'degree', v) : undefined}
                                            placeholder="Degree"
                                        />
                                        <span className="luxsleek-entry-company">. <EditableText
                                            tag="span"
                                            value={edu.field || ''}
                                            onChange={onDataChange ? (v) => updateEducation(i, 'field', v) : undefined}
                                            placeholder="Field"
                                        />.</span>
                                        <span className="luxsleek-entry-dates">
                                            <EditableText
                                                tag="span"
                                                value={edu.startDate || ''}
                                                onChange={onDataChange ? (v) => updateEducation(i, 'startDate', v) : undefined}
                                                placeholder="Start"
                                            />–<EditableText
                                                tag="span"
                                                value={edu.endDate || ''}
                                                onChange={onDataChange ? (v) => updateEducation(i, 'endDate', v) : undefined}
                                                placeholder="End"
                                            />
                                        </span>
                                    </div>
                                    <div className="luxsleek-entry-institution">
                                        <EditableText
                                            tag="span"
                                            value={edu.institution || ''}
                                            onChange={onDataChange ? (v) => updateEducation(i, 'institution', v) : undefined}
                                            placeholder="Institution"
                                        />
                                    </div>
                                    {edu.description && (
                                        <p className="luxsleek-entry-description">
                                            ○ {edu.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Additional Education / Courses */}
                {showProjects && projects.length > 0 && (
                    <section className="luxsleek-main-section">
                        <h2 className="luxsleek-main-title">Additional Education</h2>
                        <div className="luxsleek-entries">
                            {projects.map((proj, i) => (
                                <div key={proj.id || i} className="luxsleek-entry">
                                    <div className="luxsleek-entry-header">
                                        <EditableText
                                            tag="span"
                                            className="luxsleek-entry-role"
                                            value={proj.name || ''}
                                            onChange={onDataChange ? (v) => updateProject(i, 'name', v) : undefined}
                                            placeholder="Name"
                                        />
                                        <span className="luxsleek-entry-dates">{proj.startDate}</span>
                                    </div>
                                    <EditableText
                                        tag="p"
                                        className="luxsleek-entry-description"
                                        value={proj.description ? `○ ${proj.description}` : ''}
                                        onChange={onDataChange ? (v) => updateProject(i, 'description', v.replace(/^○\s*/, '')) : undefined}
                                        placeholder="Description"
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Publications */}
                {showPublications && publications && publications.length > 0 && (
                    <section className="luxsleek-main-section">
                        <h2 className="luxsleek-main-title">{getLabel('publications', lang)}</h2>
                        <div className="luxsleek-entries">
                            {publications.map((pub, i) => (
                                <div key={pub.id || i} className="luxsleek-entry">
                                    <p className="luxsleek-publication">
                                        {pub.title}. <em>{pub.publisher}</em>. {pub.date}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Hobbies */}
                {showHobbies && awards && awards.length > 0 && (
                    <section className="luxsleek-main-section">
                        <h2 className="luxsleek-main-title">{getLabel('hobbies', lang)}</h2>
                        <div className="luxsleek-hobbies">
                            {awards.map((award, i) => (
                                <p key={award.id || i} className="luxsleek-hobby">
                                    <strong>{award.title}:</strong> {award.description}
                                </p>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default LuxSleekCVTemplate;
